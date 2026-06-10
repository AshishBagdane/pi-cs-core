import type { PiCsConfig } from "./config";
import type { SemesterContext } from "./semester";
import type { FolderDetectionResult } from "./folder";

// ─── Skill Interface ───────────────────────────────────────────────────────

/** Metadata present in every pi-cs skill's YAML frontmatter. */
export interface BaseSkillMetadata {
  name: string;
  description: string;
}

// ─── Session State ─────────────────────────────────────────────────────────

export interface SessionState {
  startTime: Date;
  skillsUsed: string[];
  topicsWorked: string[];
  semesterContext: SemesterContext | null;
  folderContext: FolderDetectionResult | null;
  warningIssuedAt: number | null; // minute mark when burnout warning was sent
}

export function createSessionState(): SessionState {
  return {
    startTime: new Date(),
    skillsUsed: [],
    topicsWorked: [],
    semesterContext: null,
    folderContext: null,
    warningIssuedAt: null,
  };
}

// ─── Lifecycle Hook Shapes ─────────────────────────────────────────────────

export interface SkillCallContext {
  skillName: string;
  userInput: string;
  sessionState: SessionState;
}

export interface StartupResult {
  contextInjection: string;
  greeting: string;
  config: PiCsConfig;
}

export interface SkillCallResult {
  proceed: boolean;
  injection: string;
}

export interface SessionEndResult {
  nudge: string | null;
  summary: string | null;
}

// ─── Context Injection Builder ─────────────────────────────────────────────

/**
 * Builds a config-derived injection block that nudges the agent's behavior
 * based on the user's preferences without overriding the system prompt.
 */
export function buildConfigInjection(config: PiCsConfig): string {
  const hints: string[] = [];

  if (config.student?.name) {
    hints.push(`Student name: ${config.student.name}`);
  }

  if (config.student?.year_of_study) {
    const yearLabels: Record<number, string> = {
      1: "Freshman (1st year)",
      2: "Sophomore (2nd year)",
      3: "Junior (3rd year)",
      4: "Senior (4th year)",
      5: "Graduate (1st year)",
      6: "Graduate (2nd year+)",
    };
    hints.push(
      `Year of study: ${yearLabels[config.student.year_of_study] ?? config.student.year_of_study}`
    );
  }

  if (config.student?.primary_language) {
    hints.push(`Primary language: ${config.student.primary_language}`);
  }

  if (config.explanations?.default_depth) {
    hints.push(`Explanation depth preference: ${config.explanations.default_depth}`);
  }

  if (config.code?.always_include_complexity) {
    hints.push("Always annotate algorithm time/space complexity");
  }

  if (config.code?.always_include_tests) {
    hints.push("Always suggest test cases alongside code");
  }

  if (!hints.length) return "";

  return [
    "<!-- USER CONFIG PREFERENCES -->",
    ...hints.map((h) => `<!-- ${h} -->`),
  ].join("\n");
}
