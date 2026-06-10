// Config
export type { PiCsConfig } from "./config";
export { loadConfig, deepMerge, getConfigSearchPaths } from "./config";

// Workspace
export type { WorkspaceResult } from "./workspace";
export {
  findWorkspace,
  getWorkspaceState,
  syncWorkspaceState,
  resetWorkspaceState,
} from "./workspace";

// Semester
export type {
  Course,
  Assignment,
  SemesterContext,
  DetectionResult,
  GreetingOptions,
} from "./semester";
export {
  getSemesterSearchPaths,
  findSemesterFile,
  parseSemesterMd,
  detectSemesterContext,
  semesterContextBlock,
  generateGreeting,
} from "./semester";

// Folder
export type { ProjectType, ProjectContext, FolderDetectionResult } from "./folder";
export {
  detectFolderContext,
  summarizeFolderContext,
  SEMESTER_FOLDER_PATTERN,
  COURSE_FOLDER_PATTERN,
} from "./folder";

// Integrity
export type { IntegrityRisk, IntegrityCheckResult, IntegrityCheckOptions } from "./integrity";
export {
  HIGH_RISK_PATTERNS,
  MEDIUM_RISK_PATTERNS,
  SAFE_OVERRIDE_PATTERNS,
  buildHighRiskWarning,
  buildMediumRiskWarning,
  checkIntegrityRisk,
} from "./integrity";

// Progress
export type {
  SessionRecord,
  WeeklyStats,
  RecordSessionInput,
  RecordSessionResult,
} from "./progress";
export {
  TRACKER_DIR,
  SESSIONS_FILE,
  loadSessions,
  saveSessions,
  getWeeklyStats,
  getBurnoutNudge,
  buildWeeklySummary,
  recordSession,
} from "./progress";

// Lifecycle
export type {
  BaseSkillMetadata,
  SessionState,
  SkillCallContext,
  StartupResult,
  SkillCallResult,
  SessionEndResult,
} from "./lifecycle";
export { createSessionState, buildConfigInjection } from "./lifecycle";
