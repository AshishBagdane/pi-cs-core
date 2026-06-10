import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Type ──────────────────────────────────────────────────────────────────

export interface PiCsConfig {
  student?: {
    name?: string;
    year_of_study?: number;
    primary_language?: string;
    timezone?: string;
  };
  explanations?: {
    default_depth?: "beginner" | "intermediate" | "advanced";
    prefer_visuals?: boolean;
    use_analogies?: boolean;
  };
  code?: {
    style?: "verbose" | "balanced" | "concise";
    always_include_complexity?: boolean;
    always_include_tests?: boolean;
  };
  integrity?: {
    enabled?: boolean;
    strictness?: "strict" | "balanced" | "relaxed";
  };
  productivity?: {
    burnout_nudges?: boolean;
    session_warning_minutes?: number;
    weekly_summary?: boolean;
  };
  model?: {
    default?: string;
    code_heavy?: string;
    quick?: string;
  };
  workspace?: {
    customPaths?: string[];
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Works from both src/ (dev) and dist/ (compiled) — one level up to package root, then into config/.
const DEFAULTS_PATH = path.join(__dirname, "../config/defaults.json");

export function getConfigSearchPaths(): string[] {
  return [
    path.join(process.cwd(), ".pi-cs.json"),
    path.join(os.homedir(), ".pi", "pi-cs.json"),
    path.join(os.homedir(), ".config", "pi-cs", "config.json"),
  ];
}

export function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };

  for (const key of Object.keys(override) as (keyof T)[]) {
    const baseVal = base[key];
    const overrideVal = override[key];

    if (
      overrideVal !== null &&
      typeof overrideVal === "object" &&
      !Array.isArray(overrideVal) &&
      typeof baseVal === "object" &&
      baseVal !== null
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>
      ) as T[keyof T];
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal as T[keyof T];
    }
  }

  return result;
}

// ─── Loader ────────────────────────────────────────────────────────────────

/**
 * Loads and merges user config over package defaults.
 * Never throws — falls back to defaults on any read/parse error.
 */
export function loadConfig(): PiCsConfig {
  let defaults: PiCsConfig = {};

  try {
    const raw = fs.readFileSync(DEFAULTS_PATH, "utf-8");
    defaults = JSON.parse(raw) as PiCsConfig;
  } catch {
    defaults = {
      explanations: { default_depth: "intermediate", prefer_visuals: true, use_analogies: true },
      code: { style: "balanced", always_include_complexity: true, always_include_tests: false },
      integrity: { enabled: true, strictness: "balanced" },
      productivity: { burnout_nudges: true, session_warning_minutes: 180, weekly_summary: true },
    };
  }

  for (const configPath of getConfigSearchPaths()) {
    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf-8");
        const userConfig = JSON.parse(raw) as PiCsConfig;
        return deepMerge(defaults, userConfig);
      }
    } catch {
      continue;
    }
  }

  return defaults;
}
