import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { loadConfig } from "./config";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Course {
  code: string;
  name: string;
  assignments?: Assignment[];
}

export interface Assignment {
  name: string;
  due: string; // ISO date string
  submitted?: boolean;
}

export interface SemesterContext {
  semester: string;
  year: number;
  week?: number;
  year_of_study?: number;
  courses: Course[];
  active_project?: string;
  notes?: string;
}

export interface DetectionResult {
  found: boolean;
  source?: string;
  context?: SemesterContext;
  error?: string;
  wrongCasing?: string; // actual filename when casing differs from 'SEMESTER.md'
}

// ─── Search Paths ──────────────────────────────────────────────────────────

export function getSemesterSearchPaths(): string[] {
  const standard = [
    process.cwd(),
    path.join(os.homedir(), "university"),
    path.join(os.homedir(), "uni"),
    path.join(os.homedir(), "college"),
    path.join(os.homedir(), "school"),
    path.join(os.homedir(), "Documents", "university"),
    path.join(os.homedir(), "Documents", "uni"),
    path.join(os.homedir(), "Documents", "college"),
    path.join(os.homedir(), "Documents", "school"),
  ];

  const custom = (loadConfig().workspace?.customPaths ?? []).map((p) =>
    p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p
  );

  return [...standard, ...custom];
}

const SEMESTER_FILE = "SEMESTER.md";

/**
 * Finds SEMESTER.md in a directory, accepting any casing of the filename.
 * Always reads the directory listing to get the actual on-disk filename so
 * that wrong-casing detection works correctly on case-insensitive filesystems
 * (e.g. macOS) where existsSync cannot distinguish 'SEMESTER.md' from 'semester.md'.
 */
export function findSemesterFile(
  dir: string
): { filePath: string; wrongCasing: boolean } | null {
  try {
    const entries = fs.readdirSync(dir);
    const match = entries.find(
      (f) => f.toLowerCase() === SEMESTER_FILE.toLowerCase()
    );
    if (!match) return null;
    return { filePath: path.join(dir, match), wrongCasing: match !== SEMESTER_FILE };
  } catch {
    return null;
  }
}

// ─── Parser ────────────────────────────────────────────────────────────────

/**
 * Parses a SEMESTER.md file into a SemesterContext object.
 * Format is lenient — extracts what it can, leaves the rest as notes.
 */
export function parseSemesterMd(content: string): SemesterContext {
  const lines = content.split("\n");
  const context: SemesterContext = {
    semester: "Unknown",
    year: new Date().getFullYear(),
    courses: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // semester: Fall 2025
    const semMatch = trimmed.match(/^semester[:\s]+(.+)/i);
    if (semMatch) context.semester = semMatch[1].trim();

    // year: 2025
    const yearMatch = trimmed.match(/^year[:\s]+(\d{4})/i);
    if (yearMatch) context.year = parseInt(yearMatch[1]);

    // week: 7
    const weekMatch = trimmed.match(/^week[:\s]+(\d+)/i);
    if (weekMatch) context.week = parseInt(weekMatch[1]);

    // year_of_study: 2
    const studyYearMatch = trimmed.match(/^year.of.study[:\s]+(\d)/i);
    if (studyYearMatch) context.year_of_study = parseInt(studyYearMatch[1]);

    // - CS301: Operating Systems
    const courseMatch = trimmed.match(/^[-*]\s+([A-Z]{2,4}\d{2,4})[:\s]+(.+)/);
    if (courseMatch) {
      context.courses.push({
        code: courseMatch[1],
        name: courseMatch[2].trim(),
      });
    }

    // active_project: my-compiler
    const projectMatch = trimmed.match(/^active.project[:\s]+(.+)/i);
    if (projectMatch) context.active_project = projectMatch[1].trim();
  }

  return context;
}

// ─── Detector ──────────────────────────────────────────────────────────────

/**
 * Searches candidate paths for SEMESTER.md and returns the parsed context if found.
 */
export function detectSemesterContext(): DetectionResult {
  for (const searchPath of getSemesterSearchPaths()) {
    const found = findSemesterFile(searchPath);
    if (!found) continue;

    try {
      const content = fs.readFileSync(found.filePath, "utf-8");
      const context = parseSemesterMd(content);

      return {
        found: true,
        source: found.filePath,
        context,
        ...(found.wrongCasing && {
          wrongCasing: path.basename(found.filePath),
        }),
      };
    } catch {
      continue;
    }
  }

  return { found: false };
}

// ─── Context Block ─────────────────────────────────────────────────────────

/**
 * Builds a compact system prompt context block from a semester context.
 * Suitable for injection into a Pi session's system prompt.
 */
export function semesterContextBlock(ctx: SemesterContext): string {
  return [
    `[pi-cs] Semester: ${ctx.semester} ${ctx.year}`,
    ctx.week != null ? `[pi-cs] Week: ${ctx.week}` : "",
    ctx.year_of_study != null ? `[pi-cs] Year of study: ${ctx.year_of_study}` : "",
    ctx.courses.length
      ? `[pi-cs] Courses: ${ctx.courses.map((c) => `${c.code} (${c.name})`).join(", ")}`
      : "",
    ctx.active_project ? `[pi-cs] Active project: ${ctx.active_project}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── Greeting Generator ────────────────────────────────────────────────────

export interface GreetingOptions {
  /** Package display name shown in greetings (default: "Pisces") */
  packageName?: string;
  /** Skill names to list in the "no context" nudge */
  skills?: string[];
}

/**
 * Generates a contextual greeting based on the detected semester context.
 * Injected into the Pi session at startup.
 */
export function generateGreeting(
  result: DetectionResult,
  options: GreetingOptions = {}
): string {
  const pkg = options.packageName ?? "Pisces";
  const skillList = (options.skills ?? [
    "homework", "project", "review", "explain", "leetcode", "exam", "research",
  ])
    .map((s) => `/skill:${s}`)
    .join(", ");

  if (!result.found || !result.context) {
    return [
      `👋 Hey! I'm **${pkg}**, your CS co-pilot.`,
      "",
      "I don't see a `SEMESTER.md` in your workspace yet. Want to set one up so I can stay context-aware of your courses and deadlines?",
      "",
      "Run `/skill:semester --init` to get started, or just tell me what you're working on!",
    ].join("\n");
  }

  const ctx = result.context;
  const weekStr = ctx.week ? ` (Week ${ctx.week})` : "";
  const courseList =
    ctx.courses.length > 0
      ? ctx.courses.map((c) => `  - ${c.code}: ${c.name}`).join("\n")
      : "  - (no courses listed)";

  const projectLine = ctx.active_project
    ? `\n🔧 Active project: **${ctx.active_project}**`
    : "";

  return [
    `👋 Hey! I'm **${pkg}** — loaded up for **${ctx.semester} ${ctx.year}**${weekStr}.`,
    "",
    "📚 Your courses:",
    courseList,
    projectLine,
    "",
    `What are we tackling today? ${skillList}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}
