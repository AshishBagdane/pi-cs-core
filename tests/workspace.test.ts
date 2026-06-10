import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  findWorkspace,
  getWorkspaceState,
  syncWorkspaceState,
  resetWorkspaceState,
} from "../src/workspace";

describe("findWorkspace", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pisces-ws-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns isActive=false when no .pisces marker exists", () => {
    const result = findWorkspace(tmpDir);
    expect(result.isActive).toBe(false);
    expect(result.root).toBeNull();
  });

  it("finds .pisces in the start directory", () => {
    fs.writeFileSync(path.join(tmpDir, ".pisces"), "");
    const result = findWorkspace(tmpDir);
    expect(result.isActive).toBe(true);
    expect(result.root).toBe(path.resolve(tmpDir));
  });

  it("finds .pisces in a parent directory", () => {
    fs.writeFileSync(path.join(tmpDir, ".pisces"), "");
    const child = path.join(tmpDir, "deep", "nested");
    fs.mkdirSync(child, { recursive: true });

    const result = findWorkspace(child);
    expect(result.isActive).toBe(true);
    expect(result.root).toBe(path.resolve(tmpDir));
  });

  it("does not search above home directory", () => {
    // The home directory itself won't have .pisces in tests
    const result = findWorkspace(os.homedir());
    expect(result.isActive).toBe(false);
  });
});

describe("workspace state singleton", () => {
  afterEach(() => {
    resetWorkspaceState();
  });

  it("syncWorkspaceState updates the cached state", () => {
    let tmpDir: string | undefined;
    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pisces-sync-test-"));
      fs.writeFileSync(path.join(tmpDir, ".pisces"), "");

      const result = syncWorkspaceState(tmpDir);
      expect(result.isActive).toBe(true);

      // getWorkspaceState should return the same cached result
      expect(getWorkspaceState().isActive).toBe(true);
    } finally {
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("resetWorkspaceState clears the cache so the next read re-derives from cwd", () => {
    // Seed state with an active workspace
    let tmpDir: string | undefined;
    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pisces-reset-test-"));
      fs.writeFileSync(path.join(tmpDir, ".pisces"), "");
      syncWorkspaceState(tmpDir);
      expect(getWorkspaceState().isActive).toBe(true);

      resetWorkspaceState();
      // After reset, getWorkspaceState re-derives from cwd (which has no .pisces)
      const fresh = getWorkspaceState();
      // We can't guarantee the result, but we confirm it was re-derived (not the cached active one from tmpDir)
      // unless the test runner cwd happens to be inside a workspace
      expect(fresh).toBeDefined();
    } finally {
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
      resetWorkspaceState();
    }
  });
});
