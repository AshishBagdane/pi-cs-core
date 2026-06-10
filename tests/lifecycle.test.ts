import { createSessionState, buildConfigInjection, PiCsConfig } from "../src/index";

describe("createSessionState", () => {
  it("returns a fresh state with empty collections", () => {
    const state = createSessionState();
    expect(state.skillsUsed).toEqual([]);
    expect(state.topicsWorked).toEqual([]);
    expect(state.semesterContext).toBeNull();
    expect(state.folderContext).toBeNull();
    expect(state.warningIssuedAt).toBeNull();
  });

  it("captures the current time as startTime", () => {
    const before = Date.now();
    const state = createSessionState();
    const after = Date.now();
    expect(state.startTime.getTime()).toBeGreaterThanOrEqual(before);
    expect(state.startTime.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("buildConfigInjection", () => {
  it("returns empty string for an empty config", () => {
    expect(buildConfigInjection({})).toBe("");
  });

  it("injects student name when present", () => {
    const config: PiCsConfig = { student: { name: "Alice" } };
    const injection = buildConfigInjection(config);
    expect(injection).toContain("Student name: Alice");
  });

  it("maps year_of_study to human-readable label", () => {
    const config: PiCsConfig = { student: { year_of_study: 1 } };
    expect(buildConfigInjection(config)).toContain("Freshman");
  });

  it("includes primary language hint", () => {
    const config: PiCsConfig = { student: { primary_language: "rust" } };
    expect(buildConfigInjection(config)).toContain("rust");
  });

  it("includes complexity and test hints when enabled", () => {
    const config: PiCsConfig = {
      code: { always_include_complexity: true, always_include_tests: true },
    };
    const injection = buildConfigInjection(config);
    expect(injection).toContain("complexity");
    expect(injection).toContain("test cases");
  });

  it("wraps all hints in HTML comment markers", () => {
    const config: PiCsConfig = { student: { name: "Bob" } };
    const injection = buildConfigInjection(config);
    expect(injection).toMatch(/^<!-- USER CONFIG PREFERENCES -->/);
    expect(injection).toContain("<!-- Student name: Bob -->");
  });
});
