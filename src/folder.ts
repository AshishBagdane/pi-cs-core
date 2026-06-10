import * as fs from "fs";
import * as path from "path";

// ─── Types ─────────────────────────────────────────────────────────────────

export type ProjectType =
  | "python"
  | "typescript"
  | "java"
  | "cpp"
  | "rust"
  | "go"
  | "web"
  | "monorepo"
  | "unknown";

export interface ProjectContext {
  type: ProjectType;
  root: string;
  name: string;
  hasTests: boolean;
  hasCi: boolean;
  hasDocker: boolean;
  hasReadme: boolean;
  entrypoint?: string;
  testCommand?: string;
  buildCommand?: string;
}

export interface FolderDetectionResult {
  isUniversityWorkspace: boolean;
  semesterFolder?: string;
  courseFolder?: string;
  project?: ProjectContext;
}

// ─── Marker Files ──────────────────────────────────────────────────────────

const PYTHON_MARKERS = ["requirements.txt", "pyproject.toml", "setup.py", "Pipfile"];
const TS_MARKERS = ["package.json", "tsconfig.json"];
const JAVA_MARKERS = ["pom.xml", "build.gradle", "*.java"];
const CPP_MARKERS = ["CMakeLists.txt", "Makefile", "*.cpp", "*.h"];
const RUST_MARKERS = ["Cargo.toml"];
const GO_MARKERS = ["go.mod"];
const WEB_MARKERS = ["index.html", "vite.config.*", "next.config.*", "webpack.config.*"];

// ─── University Structure Patterns ─────────────────────────────────────────

// Matches patterns like: FALL2025, SPRING24, SEM1, SEMESTER2, etc.
export const SEMESTER_FOLDER_PATTERN = /^(fall|spring|summer|winter|sem|semester)\d{0,4}$/i;

// Matches patterns like: CS301, ECE202, COS226, etc.
export const COURSE_FOLDER_PATTERN = /^[A-Z]{2,4}\d{2,4}$/;

// ─── Helpers ───────────────────────────────────────────────────────────────

function listDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function detectProjectType(dir: string): ProjectType {
  const files = listDir(dir);
  const fileSet = new Set(files);

  if (RUST_MARKERS.some((m) => fileSet.has(m))) return "rust";
  if (GO_MARKERS.some((m) => fileSet.has(m))) return "go";
  if (PYTHON_MARKERS.some((m) => fileSet.has(m))) return "python";
  if (JAVA_MARKERS.some((m) => fileSet.has(m))) return "java";
  if (CPP_MARKERS.some((m) => fileSet.has(m))) return "cpp";
  if (WEB_MARKERS.some((m) => fileSet.has(m))) return "web";
  if (TS_MARKERS.some((m) => fileSet.has(m))) return "typescript";

  return "unknown";
}

function buildProjectContext(dir: string): ProjectContext {
  const type = detectProjectType(dir);
  const files = listDir(dir);
  const fileSet = new Set(files);

  const ctx: ProjectContext = {
    type,
    root: dir,
    name: path.basename(dir),
    hasTests: fileSet.has("tests") || fileSet.has("test") || fileSet.has("__tests__"),
    hasCi: fileSet.has(".github"),
    hasDocker: fileSet.has("Dockerfile") || fileSet.has("docker-compose.yml"),
    hasReadme: fileSet.has("README.md") || fileSet.has("readme.md"),
  };

  switch (type) {
    case "python":
      ctx.entrypoint = fileSet.has("main.py") ? "main.py" : "src/main.py";
      ctx.testCommand = "pytest";
      ctx.buildCommand = "pip install -r requirements.txt";
      break;
    case "typescript":
      ctx.entrypoint = "src/index.ts";
      ctx.testCommand = "npm test";
      ctx.buildCommand = "npm run build";
      break;
    case "java":
      ctx.testCommand = fileSet.has("pom.xml") ? "mvn test" : "gradle test";
      ctx.buildCommand = fileSet.has("pom.xml") ? "mvn package" : "gradle build";
      break;
    case "cpp":
      ctx.testCommand = "make test";
      ctx.buildCommand = "make";
      break;
    case "rust":
      ctx.testCommand = "cargo test";
      ctx.buildCommand = "cargo build";
      break;
    case "go":
      ctx.testCommand = "go test ./...";
      ctx.buildCommand = "go build ./...";
      break;
  }

  return ctx;
}

// ─── Main Detector ─────────────────────────────────────────────────────────

export function detectFolderContext(cwd?: string): FolderDetectionResult {
  const dir = cwd ?? process.cwd();
  const cwdParts = dir.split(path.sep);

  const result: FolderDetectionResult = {
    isUniversityWorkspace: false,
  };

  for (let i = cwdParts.length - 1; i >= 0; i--) {
    const part = cwdParts[i];

    if (["university", "uni", "college", "school"].includes(part.toLowerCase())) {
      result.isUniversityWorkspace = true;

      const semesterCandidate = cwdParts[i + 1];
      if (semesterCandidate && SEMESTER_FOLDER_PATTERN.test(semesterCandidate)) {
        result.semesterFolder = semesterCandidate;
      }

      const courseCandidate = cwdParts[i + 2];
      if (courseCandidate && COURSE_FOLDER_PATTERN.test(courseCandidate)) {
        result.courseFolder = courseCandidate;
      }

      break;
    }
  }

  result.project = buildProjectContext(dir);

  return result;
}

// ─── Context Summary ───────────────────────────────────────────────────────

export function summarizeFolderContext(result: FolderDetectionResult): string {
  const lines: string[] = [];

  if (result.isUniversityWorkspace) {
    lines.push(`📂 University workspace detected`);
    if (result.semesterFolder) lines.push(`   Semester: ${result.semesterFolder}`);
    if (result.courseFolder) lines.push(`   Course: ${result.courseFolder}`);
  }

  if (result.project && result.project.type !== "unknown") {
    const p = result.project;
    lines.push(`🔧 Project: ${p.name} (${p.type})`);
    if (!p.hasReadme) lines.push(`   ⚠️  No README.md found`);
    if (!p.hasTests) lines.push(`   ⚠️  No test directory found`);
    if (!p.hasCi) lines.push(`   💡 Consider adding CI (.github/workflows)`);
    if (p.testCommand) lines.push(`   Test: \`${p.testCommand}\``);
  }

  return lines.join("\n");
}
