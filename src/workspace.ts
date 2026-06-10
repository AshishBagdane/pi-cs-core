import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { homedir } from "os";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface WorkspaceResult {
  isActive: boolean;
  root: string | null;
}

// ─── Finder ────────────────────────────────────────────────────────────────

/**
 * Walks up from startCwd looking for a .pisces marker file.
 * Stops at the home directory or filesystem root (whichever comes first).
 * Caps at 15 levels to bound the cost — each check is a single synchronous stat.
 */
export function findWorkspace(startCwd: string): WorkspaceResult {
  const home = resolve(homedir());
  let current = resolve(startCwd);
  let depth = 0;

  while (depth < 15) {
    if (current === home || current.length < home.length) break;
    if (current === "/") break;

    if (existsSync(join(current, ".pisces"))) {
      return { isActive: true, root: current };
    }

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
    depth++;
  }

  return { isActive: false, root: null };
}

// ─── State Singleton ───────────────────────────────────────────────────────

// Module-level singleton owned by the gatekeeper, read by all extensions.
// Lazy-initialises on first read so tests that mock findWorkspace work
// without needing an explicit setup call.
let _state: WorkspaceResult | null = null;

export function getWorkspaceState(): WorkspaceResult {
  if (_state === null) {
    _state = findWorkspace(process.cwd());
  }
  return _state;
}

export function syncWorkspaceState(cwd: string): WorkspaceResult {
  _state = findWorkspace(cwd);
  return _state;
}

/** Resets the cached state — useful in tests. */
export function resetWorkspaceState(): void {
  _state = null;
}
