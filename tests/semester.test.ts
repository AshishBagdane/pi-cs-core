import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  parseSemesterMd,
  detectSemesterContext,
  generateGreeting,
  semesterContextBlock,
  findSemesterFile,
  SemesterContext,
} from "../src/semester";

// ─── parseSemesterMd ───────────────────────────────────────────────────────

describe("parseSemesterMd", () => {
  it("parses a complete SEMESTER.md", () => {
    const content = `
semester: Fall 2025
year: 2025
week: 7
year_of_study: 2
- CS301: Operating Systems
- CS401: Compiler Design
active_project: my-compiler
    `.trim();

    const ctx = parseSemesterMd(content);
    expect(ctx.semester).toBe("Fall 2025");
    expect(ctx.year).toBe(2025);
    expect(ctx.week).toBe(7);
    expect(ctx.year_of_study).toBe(2);
    expect(ctx.courses).toHaveLength(2);
    expect(ctx.courses[0]).toEqual({ code: "CS301", name: "Operating Systems" });
    expect(ctx.courses[1]).toEqual({ code: "CS401", name: "Compiler Design" });
    expect(ctx.active_project).toBe("my-compiler");
  });

  it("uses defaults for missing fields", () => {
    const ctx = parseSemesterMd("semester: Spring 2026");
    expect(ctx.semester).toBe("Spring 2026");
    expect(ctx.year).toBe(new Date().getFullYear());
    expect(ctx.week).toBeUndefined();
    expect(ctx.courses).toEqual([]);
    expect(ctx.active_project).toBeUndefined();
  });

  it("ignores lines that do not match any field", () => {
    const ctx = parseSemesterMd("# Header\nsome random line\nsemester: Summer 2024");
    expect(ctx.semester).toBe("Summer 2024");
    expect(ctx.courses).toEqual([]);
  });

  it("parses courses marked with * as well as -", () => {
    const ctx = parseSemesterMd("* CS101: Intro to CS");
    expect(ctx.courses).toHaveLength(1);
    expect(ctx.courses[0].code).toBe("CS101");
  });
});

// ─── findSemesterFile ──────────────────────────────────────────────────────

describe("findSemesterFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sem-file-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no SEMESTER.md exists", () => {
    expect(findSemesterFile(tmpDir)).toBeNull();
  });

  it("finds SEMESTER.md with correct casing", () => {
    fs.writeFileSync(path.join(tmpDir, "SEMESTER.md"), "semester: Fall 2025");
    const result = findSemesterFile(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.wrongCasing).toBe(false);
  });

  it("detects wrong casing", () => {
    fs.writeFileSync(path.join(tmpDir, "semester.md"), "semester: Fall 2025");
    const result = findSemesterFile(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.wrongCasing).toBe(true);
  });
});

// ─── detectSemesterContext ─────────────────────────────────────────────────

describe("detectSemesterContext", () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sem-detect-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns found=false when no SEMESTER.md exists", () => {
    const result = detectSemesterContext();
    expect(result.found).toBe(false);
    expect(result.context).toBeUndefined();
  });

  it("finds and parses SEMESTER.md in cwd", () => {
    fs.writeFileSync(
      path.join(tmpDir, "SEMESTER.md"),
      "semester: Fall 2025\n- CS301: OS"
    );
    const result = detectSemesterContext();
    expect(result.found).toBe(true);
    expect(result.context?.semester).toBe("Fall 2025");
    expect(result.context?.courses).toHaveLength(1);
  });

  it("reports wrongCasing when the file has incorrect casing", () => {
    fs.writeFileSync(path.join(tmpDir, "semester.md"), "semester: Fall 2025");
    const result = detectSemesterContext();
    expect(result.found).toBe(true);
    expect(result.wrongCasing).toBeDefined();
  });
});

// ─── semesterContextBlock ──────────────────────────────────────────────────

describe("semesterContextBlock", () => {
  it("builds the system prompt block from a full context", () => {
    const ctx: SemesterContext = {
      semester: "Fall 2025",
      year: 2025,
      week: 7,
      year_of_study: 2,
      courses: [{ code: "CS301", name: "Operating Systems" }],
      active_project: "my-compiler",
    };
    const block = semesterContextBlock(ctx);
    expect(block).toContain("[pi-cs] Semester: Fall 2025 2025");
    expect(block).toContain("[pi-cs] Week: 7");
    expect(block).toContain("[pi-cs] Year of study: 2");
    expect(block).toContain("CS301");
    expect(block).toContain("[pi-cs] Active project: my-compiler");
  });

  it("omits optional lines when fields are absent", () => {
    const ctx: SemesterContext = {
      semester: "Spring 2026",
      year: 2026,
      courses: [],
    };
    const block = semesterContextBlock(ctx);
    expect(block).not.toContain("Week:");
    expect(block).not.toContain("Year of study:");
    expect(block).not.toContain("Courses:");
    expect(block).not.toContain("Active project:");
  });
});

// ─── generateGreeting ──────────────────────────────────────────────────────

describe("generateGreeting", () => {
  it("generates a 'no context' greeting when not found", () => {
    const greeting = generateGreeting({ found: false });
    expect(greeting).toContain("SEMESTER.md");
  });

  it("generates a context-aware greeting when found", () => {
    const ctx: SemesterContext = {
      semester: "Fall 2025",
      year: 2025,
      week: 7,
      courses: [{ code: "CS301", name: "Operating Systems" }],
    };
    const greeting = generateGreeting({ found: true, context: ctx });
    expect(greeting).toContain("Fall 2025");
    expect(greeting).toContain("Week 7");
    expect(greeting).toContain("CS301");
  });

  it("respects packageName option", () => {
    const greeting = generateGreeting({ found: false }, { packageName: "PiPro" });
    expect(greeting).toContain("PiPro");
  });

  it("includes custom skill list", () => {
    const ctx: SemesterContext = {
      semester: "Fall 2025",
      year: 2025,
      courses: [],
    };
    const greeting = generateGreeting(
      { found: true, context: ctx },
      { skills: ["thesis", "research"] }
    );
    expect(greeting).toContain("/skill:thesis");
    expect(greeting).toContain("/skill:research");
  });
});
