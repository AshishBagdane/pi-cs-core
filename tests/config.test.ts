import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadConfig, deepMerge, getConfigSearchPaths, PiCsConfig } from "../src/config";

describe("deepMerge", () => {
  it("overlays top-level scalar values", () => {
    const base = { a: 1, b: 2 };
    const override = { b: 99 };
    expect(deepMerge(base, override)).toEqual({ a: 1, b: 99 });
  });

  it("deep-merges nested objects", () => {
    const base: PiCsConfig = { integrity: { enabled: true, strictness: "balanced" } };
    const override: Partial<PiCsConfig> = { integrity: { strictness: "strict" } };
    const result = deepMerge(base, override);
    expect(result.integrity?.enabled).toBe(true);
    expect(result.integrity?.strictness).toBe("strict");
  });

  it("does not add keys absent from override", () => {
    const base = { a: 1, b: { x: 10 } };
    const override = {};
    expect(deepMerge(base, override)).toEqual({ a: 1, b: { x: 10 } });
  });
});

describe("getConfigSearchPaths", () => {
  it("returns three search paths in priority order", () => {
    const paths = getConfigSearchPaths();
    expect(paths).toHaveLength(3);
    expect(paths[0]).toContain(".pi-cs.json");
    expect(paths[1]).toContain(path.join(".pi", "pi-cs.json"));
    expect(paths[2]).toContain(path.join("pi-cs", "config.json"));
  });
});

describe("loadConfig", () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-cs-core-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when no config file exists", () => {
    const config = loadConfig();
    expect(config.integrity?.enabled).toBe(true);
    expect(config.productivity?.burnout_nudges).toBe(true);
  });

  it("merges a local .pi-cs.json over defaults", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".pi-cs.json"),
      JSON.stringify({ integrity: { enabled: false } })
    );
    const config = loadConfig();
    expect(config.integrity?.enabled).toBe(false);
    // Other defaults should still be present
    expect(config.integrity?.strictness).toBe("balanced");
  });

  it("ignores malformed JSON and falls back to defaults", () => {
    fs.writeFileSync(path.join(tmpDir, ".pi-cs.json"), "{ bad json }");
    const config = loadConfig();
    expect(config.integrity?.enabled).toBe(true);
  });
});
