import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SessionRecord {
  date: string; // ISO date string
  durationMinutes: number;
  skillsUsed: string[];
  topicsWorked: string[];
}

export interface WeeklyStats {
  totalMinutes: number;
  sessionCount: number;
  skillBreakdown: Record<string, number>;
  longestSession: number;
  streak: number; // days in a row with activity
}

// ─── Storage ───────────────────────────────────────────────────────────────

export const TRACKER_DIR = path.join(os.homedir(), ".pi-cs");
export const SESSIONS_FILE = path.join(TRACKER_DIR, "sessions.json");

function ensureTrackerDir(): void {
  if (!fs.existsSync(TRACKER_DIR)) {
    fs.mkdirSync(TRACKER_DIR, { recursive: true });
  }
}

export function loadSessions(): SessionRecord[] {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return [];
    const raw = fs.readFileSync(SESSIONS_FILE, "utf-8");
    return JSON.parse(raw) as SessionRecord[];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: SessionRecord[]): void {
  try {
    ensureTrackerDir();
    // Keep only last 90 days of sessions
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const recent = sessions.filter((s) => new Date(s.date) > cutoff);
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(recent, null, 2));
  } catch {
    // Fail silently — tracker is a nice-to-have, not critical
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export function getWeeklyStats(sessions: SessionRecord[]): WeeklyStats {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const weekSessions = sessions.filter(
    (s) => new Date(s.date) > oneWeekAgo
  );

  const skillBreakdown: Record<string, number> = {};
  let totalMinutes = 0;
  let longestSession = 0;

  for (const session of weekSessions) {
    totalMinutes += session.durationMinutes;
    longestSession = Math.max(longestSession, session.durationMinutes);

    for (const skill of session.skillsUsed) {
      skillBreakdown[skill] = (skillBreakdown[skill] ?? 0) + 1;
    }
  }

  // Calculate streak
  let streak = 0;
  const sessionDays = new Set(sessions.map((s) => new Date(s.date).toDateString()));
  const checkDate = new Date();

  while (sessionDays.has(checkDate.toDateString())) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    totalMinutes,
    sessionCount: weekSessions.length,
    skillBreakdown,
    longestSession,
    streak,
  };
}

// ─── Nudges ────────────────────────────────────────────────────────────────

export function getBurnoutNudge(
  sessionDurationMinutes: number,
  stats: WeeklyStats
): string | null {
  if (sessionDurationMinutes >= 180) {
    return "🐠 You've been coding for 3+ hours. Seriously — take a 15-minute break. Your brain consolidates learning during rest, not during grinding.";
  }

  if (stats.totalMinutes > 40 * 60) {
    return "📊 You've put in 40+ hours of study this week. That's impressive, but rest is part of learning. Don't skip sleep before your exam.";
  }

  if (stats.streak >= 7) {
    return `🔥 ${stats.streak}-day streak! Consistent daily practice beats marathon sessions. Keep this up.`;
  }

  return null;
}

// ─── Weekly Summary ────────────────────────────────────────────────────────

export function buildWeeklySummary(stats: WeeklyStats): string {
  if (stats.sessionCount === 0) {
    return "📅 No activity recorded this week. When you're ready to start, just ask!";
  }

  const hours = Math.floor(stats.totalMinutes / 60);
  const minutes = stats.totalMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const topSkills = Object.entries(stats.skillBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([skill, count]) => `  - /${skill}: ${count} session${count > 1 ? "s" : ""}`)
    .join("\n");

  return [
    `📊 **This Week's Summary**`,
    ``,
    `⏱  Total study time: **${timeStr}**`,
    `📅 Sessions: **${stats.sessionCount}**`,
    `🔥 Current streak: **${stats.streak} day${stats.streak !== 1 ? "s" : ""}**`,
    topSkills ? `\n🛠  Most used skills:\n${topSkills}` : "",
    ``,
    stats.totalMinutes < 5 * 60
      ? `💡 Tip: Even 30 minutes a day compounds significantly over a semester.`
      : `✅ Solid week. Keep the consistency going.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── Record Session ────────────────────────────────────────────────────────

export interface RecordSessionInput {
  sessionDurationMinutes: number;
  skillsUsed: string[];
  topicsWorked?: string[];
}

export interface RecordSessionResult {
  nudge: string | null;
  weeklySummary: string;
}

/**
 * Persists a session record and returns the computed burnout nudge + weekly summary.
 */
export function recordSession(input: RecordSessionInput): RecordSessionResult {
  const sessions = loadSessions();

  const record: SessionRecord = {
    date: new Date().toISOString(),
    durationMinutes: input.sessionDurationMinutes,
    skillsUsed: input.skillsUsed,
    topicsWorked: input.topicsWorked ?? [],
  };

  sessions.push(record);
  saveSessions(sessions);

  const stats = getWeeklyStats(sessions);
  const nudge = getBurnoutNudge(input.sessionDurationMinutes, stats);
  const weeklySummary = buildWeeklySummary(stats);

  return { nudge, weeklySummary };
}
