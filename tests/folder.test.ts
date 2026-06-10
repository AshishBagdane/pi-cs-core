jest.mock("fs");

import * as fs from "fs";
import {
  detectFolderContext,
  summarizeFolderContext,
  SEMESTER_FOLDER_PATTERN,
  COURSE_FOLDER_PATTERN,
  type FolderDetectionResult,
} from "../src/folder";

const mFs = jest.mocked(fs);

function mockDir(files: string[]): void {
  (mFs.readdirSync as jest.Mock).mockReturnValue(files);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDir([]);
});

// ─── SEMESTER_FOLDER_PATTERN ───────────────────────────────────────────────

describe("SEMESTER_FOLDER_PATTERN", () => {
  it.each(["FALL2025", "spring2024", "SUMMER23", "SEM1", "SEMESTER2", "winter2024"])(
    "matches '%s'",
    (name) => expect(SEMESTER_FOLDER_PATTERN.test(name)).toBe(true)
  );

  it.each(["CS301", "homework", "projects", "2024fall"])(
    "does not match '%s'",
    (name) => expect(SEMESTER_FOLDER_PATTERN.test(name)).toBe(false)
  );
});

// ─── COURSE_FOLDER_PATTERN ─────────────────────────────────────────────────

describe("COURSE_FOLDER_PATTERN", () => {
  it.each(["CS301", "ECE202", "COS226", "MATH101", "ECON4400"])(
    "matches '%s'",
    (name) => expect(COURSE_FOLDER_PATTERN.test(name)).toBe(true)
  );

  it.each(["homework", "cs301", "C1", "X12345"])(
    "does not match '%s'",
    (name) => expect(COURSE_FOLDER_PATTERN.test(name)).toBe(false)
  );
});

// ─── detectFolderContext — university detection ────────────────────────────

describe("detectFolderContext — university detection", () => {
  it("detects 'university' in path", () => {
    expect(detectFolderContext("/home/user/university/FALL2024/CS301").isUniversityWorkspace).toBe(true);
  });

  it("detects 'uni' alias in path", () => {
    expect(detectFolderContext("/home/user/uni/FALL2024/CS301").isUniversityWorkspace).toBe(true);
  });

  it("detects 'college' alias in path", () => {
    expect(detectFolderContext("/home/user/college/FALL2024").isUniversityWorkspace).toBe(true);
  });

  it("detects 'school' alias in path", () => {
    expect(detectFolderContext("/home/user/school/SPRING2025").isUniversityWorkspace).toBe(true);
  });

  it("sets semesterFolder when the segment after university matches the pattern", () => {
    const result = detectFolderContext("/home/user/university/FALL2024/CS301");
    expect(result.semesterFolder).toBe("FALL2024");
  });

  it("sets courseFolder when the segment after semester matches the pattern", () => {
    const result = detectFolderContext("/home/user/university/FALL2024/CS301");
    expect(result.courseFolder).toBe("CS301");
  });

  it("leaves semesterFolder undefined when next segment does not match", () => {
    const result = detectFolderContext("/home/user/university/projects");
    expect(result.semesterFolder).toBeUndefined();
  });

  it("leaves courseFolder undefined when no course segment is present", () => {
    const result = detectFolderContext("/home/user/university/FALL2024");
    expect(result.semesterFolder).toBe("FALL2024");
    expect(result.courseFolder).toBeUndefined();
  });

  it("returns isUniversityWorkspace false for a non-university path", () => {
    const result = detectFolderContext("/home/user/projects/my-app");
    expect(result.isUniversityWorkspace).toBe(false);
    expect(result.semesterFolder).toBeUndefined();
    expect(result.courseFolder).toBeUndefined();
  });
});

// ─── detectFolderContext — project type detection ──────────────────────────

describe("detectFolderContext — project type detection", () => {
  it("detects rust project (Cargo.toml)", () => {
    mockDir(["Cargo.toml", "src"]);
    const result = detectFolderContext("/projects/crate");
    expect(result.project?.type).toBe("rust");
    expect(result.project?.testCommand).toBe("cargo test");
    expect(result.project?.buildCommand).toBe("cargo build");
  });

  it("detects go project (go.mod)", () => {
    mockDir(["go.mod", "main.go"]);
    const result = detectFolderContext("/projects/app");
    expect(result.project?.type).toBe("go");
    expect(result.project?.testCommand).toBe("go test ./...");
    expect(result.project?.buildCommand).toBe("go build ./...");
  });

  it("detects python project with requirements.txt and main.py", () => {
    mockDir(["requirements.txt", "main.py"]);
    const result = detectFolderContext("/projects/app");
    expect(result.project?.type).toBe("python");
    expect(result.project?.entrypoint).toBe("main.py");
    expect(result.project?.testCommand).toBe("pytest");
    expect(result.project?.buildCommand).toBe("pip install -r requirements.txt");
  });

  it("uses src/main.py as python entrypoint when main.py is absent", () => {
    mockDir(["requirements.txt"]);
    const result = detectFolderContext("/projects/app");
    expect(result.project?.type).toBe("python");
    expect(result.project?.entrypoint).toBe("src/main.py");
  });

  it("detects python project via pyproject.toml", () => {
    mockDir(["pyproject.toml"]);
    expect(detectFolderContext("/projects/app").project?.type).toBe("python");
  });

  it("detects java project with pom.xml using mvn commands", () => {
    mockDir(["pom.xml", "src"]);
    const result = detectFolderContext("/projects/app");
    expect(result.project?.type).toBe("java");
    expect(result.project?.testCommand).toBe("mvn test");
    expect(result.project?.buildCommand).toBe("mvn package");
  });

  it("detects java project with build.gradle using gradle commands", () => {
    mockDir(["build.gradle", "src"]);
    const result = detectFolderContext("/projects/app");
    expect(result.project?.type).toBe("java");
    expect(result.project?.testCommand).toBe("gradle test");
    expect(result.project?.buildCommand).toBe("gradle build");
  });

  it("detects cpp project via CMakeLists.txt", () => {
    mockDir(["CMakeLists.txt", "main.cpp"]);
    const result = detectFolderContext("/projects/app");
    expect(result.project?.type).toBe("cpp");
    expect(result.project?.testCommand).toBe("make test");
    expect(result.project?.buildCommand).toBe("make");
  });

  it("detects web project via index.html", () => {
    mockDir(["index.html", "styles.css"]);
    expect(detectFolderContext("/projects/app").project?.type).toBe("web");
  });

  it("detects typescript project via package.json", () => {
    mockDir(["package.json", "tsconfig.json"]);
    const result = detectFolderContext("/projects/app");
    expect(result.project?.type).toBe("typescript");
    expect(result.project?.entrypoint).toBe("src/index.ts");
    expect(result.project?.testCommand).toBe("npm test");
    expect(result.project?.buildCommand).toBe("npm run build");
  });

  it("returns unknown for an empty directory", () => {
    mockDir([]);
    expect(detectFolderContext("/projects/app").project?.type).toBe("unknown");
  });

  it("handles readdirSync errors without throwing", () => {
    (mFs.readdirSync as jest.Mock).mockImplementation(() => { throw new Error("EACCES"); });
    expect(() => detectFolderContext("/restricted")).not.toThrow();
  });
});

// ─── detectFolderContext — project context flags ───────────────────────────

describe("detectFolderContext — project context flags", () => {
  it("sets hasTests when tests/ is present", () => {
    mockDir(["tests", "src", "package.json"]);
    expect(detectFolderContext("/app").project?.hasTests).toBe(true);
  });

  it("sets hasTests when test/ is present", () => {
    mockDir(["test", "src", "package.json"]);
    expect(detectFolderContext("/app").project?.hasTests).toBe(true);
  });

  it("sets hasTests when __tests__/ is present", () => {
    mockDir(["__tests__", "src", "package.json"]);
    expect(detectFolderContext("/app").project?.hasTests).toBe(true);
  });

  it("sets hasCi when .github is present", () => {
    mockDir([".github", "src", "package.json"]);
    expect(detectFolderContext("/app").project?.hasCi).toBe(true);
  });

  it("sets hasDocker when Dockerfile is present", () => {
    mockDir(["Dockerfile", "src"]);
    expect(detectFolderContext("/app").project?.hasDocker).toBe(true);
  });

  it("sets hasDocker when docker-compose.yml is present", () => {
    mockDir(["docker-compose.yml", "src"]);
    expect(detectFolderContext("/app").project?.hasDocker).toBe(true);
  });

  it("sets hasReadme when README.md is present", () => {
    mockDir(["README.md", "src"]);
    expect(detectFolderContext("/app").project?.hasReadme).toBe(true);
  });

  it("sets hasReadme when readme.md (lowercase) is present", () => {
    mockDir(["readme.md", "src"]);
    expect(detectFolderContext("/app").project?.hasReadme).toBe(true);
  });

  it("sets project name from the directory basename", () => {
    mockDir([]);
    expect(detectFolderContext("/projects/my-cool-app").project?.name).toBe("my-cool-app");
  });

  it("sets all flags to false when directory is empty", () => {
    mockDir([]);
    const p = detectFolderContext("/app").project!;
    expect(p.hasTests).toBe(false);
    expect(p.hasCi).toBe(false);
    expect(p.hasDocker).toBe(false);
    expect(p.hasReadme).toBe(false);
  });
});

// ─── summarizeFolderContext ────────────────────────────────────────────────

describe("summarizeFolderContext", () => {
  it("returns empty string for non-university workspace with unknown project type", () => {
    const result: FolderDetectionResult = {
      isUniversityWorkspace: false,
      project: { type: "unknown", root: "/x", name: "x", hasTests: true, hasCi: true, hasDocker: false, hasReadme: true },
    };
    expect(summarizeFolderContext(result)).toBe("");
  });

  it("returns empty string when there is no project at all", () => {
    const result: FolderDetectionResult = { isUniversityWorkspace: false };
    expect(summarizeFolderContext(result)).toBe("");
  });

  it("includes university workspace header with semester and course", () => {
    const result: FolderDetectionResult = {
      isUniversityWorkspace: true,
      semesterFolder: "FALL2024",
      courseFolder: "CS301",
    };
    const summary = summarizeFolderContext(result);
    expect(summary).toContain("University workspace");
    expect(summary).toContain("FALL2024");
    expect(summary).toContain("CS301");
  });

  it("includes university workspace header without semester when absent", () => {
    const result: FolderDetectionResult = { isUniversityWorkspace: true };
    const summary = summarizeFolderContext(result);
    expect(summary).toContain("University workspace");
    expect(summary).not.toContain("Semester:");
  });

  it("includes project name and type for a known project", () => {
    const result: FolderDetectionResult = {
      isUniversityWorkspace: false,
      project: { type: "python", root: "/x", name: "my-project", hasTests: true, hasCi: true, hasDocker: false, hasReadme: true, testCommand: "pytest" },
    };
    const summary = summarizeFolderContext(result);
    expect(summary).toContain("my-project");
    expect(summary).toContain("python");
    expect(summary).toContain("pytest");
  });

  it("warns about missing README", () => {
    const result: FolderDetectionResult = {
      isUniversityWorkspace: false,
      project: { type: "python", root: "/x", name: "x", hasTests: true, hasCi: true, hasDocker: false, hasReadme: false },
    };
    expect(summarizeFolderContext(result)).toContain("README");
  });

  it("warns about missing test directory", () => {
    const result: FolderDetectionResult = {
      isUniversityWorkspace: false,
      project: { type: "rust", root: "/x", name: "x", hasTests: false, hasCi: true, hasDocker: false, hasReadme: true },
    };
    expect(summarizeFolderContext(result)).toContain("test directory");
  });

  it("suggests adding CI when hasCi is false", () => {
    const result: FolderDetectionResult = {
      isUniversityWorkspace: false,
      project: { type: "go", root: "/x", name: "x", hasTests: true, hasCi: false, hasDocker: false, hasReadme: true },
    };
    expect(summarizeFolderContext(result)).toContain("CI");
  });
});
