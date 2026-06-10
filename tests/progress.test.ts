jest.mock("fs");

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  getBurnoutNudge,
  buildWeeklySummary,
  getWeeklyStats,
  loadSessions,
  saveSessions,
  recordSession,
  TRACKER_DIR,
  SESSIONS_FILE,
  type WeeklyStats,
  type SessionRecord,
} from "../src/progress";

const mFs = jest.mocked(fs);

function makeStats(overrides: Partial<WeeklyStats> = {}): WeeklyStats {
  return {
    totalMinutes: 0,
    sessionCount: 0,
    skillBreakdown: {},
    longestSession: 0,
    streak: 0,
    ...overrides,
  };
}

// ─── getBurnoutNudge ───────────────────────────────────────────────────────

describe("getBurnoutNudge", () => {
  it("returns null for a short session with a light week", () => {
    const stats = makeStats({ totalMinutes: 60 });
    expect(getBurnoutNudge(30, stats)).toBeNull();
  });

  it("nudges after a 3+ hour session", () => {
    const stats = makeStats({ totalMinutes: 200 });
    const nudge = getBurnoutNudge(180, stats);
    expect(nudge).not.toBeNull();
    expect(nudge).toContain("3+");
  });

  it("nudges after a very heavy week (40+ hours)", () => {
    const stats = makeStats({ totalMinutes: 41 * 60 });
    const nudge = getBurnoutNudge(60, stats);
    expect(nudge).not.toBeNull();
    expect(nudge).toContain("40+");
  });

  it("surfaces a streak message for a 7-day streak", () => {
    const stats = makeStats({ streak: 7 });
    const nudge = getBurnoutNudge(60, stats);
    expect(nudge).not.toBeNull();
    expect(nudge).toContain("7-day streak");
  });
});

// ─── buildWeeklySummary ────────────────────────────────────────────────────

describe("buildWeeklySummary", () => {
  it("returns a 'no activity' message for zero sessions", () => {
    const stats = makeStats({ sessionCount: 0 });
    const summary = buildWeeklySummary(stats);
    expect(summary).toContain("No activity");
  });

  it("formats hours and minutes correctly", () => {
    const stats = makeStats({
      sessionCount: 2,
      totalMinutes: 90,
      streak: 2,
      skillBreakdown: { homework: 2 },
    });
    const summary = buildWeeklySummary(stats);
    expect(summary).toContain("1h 30m");
    expect(summary).toContain("homework");
  });

  it("shows only minutes when under an hour", () => {
    const stats = makeStats({ sessionCount: 1, totalMinutes: 45, streak: 1 });
    const summary = buildWeeklySummary(stats);
    expect(summary).toContain("45m");
    expect(summary).not.toContain("0h");
  });
});

// ─── getWeeklyStats ────────────────────────────────────────────────────────

describe("getWeeklyStats", () => {
  it("counts only sessions from the last 7 days", () => {
    const today = new Date();
    const old = new Date(today);
    old.setDate(old.getDate() - 10);

    const sessions: SessionRecord[] = [
      { date: today.toISOString(), durationMinutes: 60, skillsUsed: ["homework"], topicsWorked: [] },
      { date: old.toISOString(), durationMinutes: 120, skillsUsed: ["review"], topicsWorked: [] },
    ];

    const stats = getWeeklyStats(sessions);
    expect(stats.sessionCount).toBe(1);
    expect(stats.totalMinutes).toBe(60);
    expect(stats.skillBreakdown["homework"]).toBe(1);
    expect(stats.skillBreakdown["review"]).toBeUndefined();
  });

  it("calculates the streak from consecutive days", () => {
    const days: SessionRecord[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString(), durationMinutes: 30, skillsUsed: [], topicsWorked: [] });
    }

    const stats = getWeeklyStats(days);
    expect(stats.streak).toBe(3);
  });

  it("returns zero stats for an empty session list", () => {
    const stats = getWeeklyStats([]);
    expect(stats.totalMinutes).toBe(0);
    expect(stats.sessionCount).toBe(0);
    expect(stats.streak).toBe(0);
  });
});

// ─── loadSessions ──────────────────────────────────────────────────────────

describe("loadSessions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns empty array when sessions file does not exist", () => {
    (mFs.existsSync as jest.Mock).mockReturnValue(false);
    expect(loadSessions()).toEqual([]);
  });

  it("returns parsed sessions when file exists", () => {
    const sessions: SessionRecord[] = [
      { date: new Date().toISOString(), durationMinutes: 30, skillsUsed: ["homework"], topicsWorked: [] },
    ];
    (mFs.existsSync as jest.Mock).mockReturnValue(true);
    (mFs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(sessions));
    expect(loadSessions()).toHaveLength(1);
    expect(loadSessions()[0].skillsUsed).toEqual(["homework"]);
  });

  it("returns empty array when sessions file contains malformed JSON", () => {
    (mFs.existsSync as jest.Mock).mockReturnValue(true);
    (mFs.readFileSync as jest.Mock).mockReturnValue("{ not valid json }");
    expect(loadSessions()).toEqual([]);
  });
});

// ─── saveSessions ──────────────────────────────────────────────────────────

describe("saveSessions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates the tracker directory when it does not exist", () => {
    (mFs.existsSync as jest.Mock).mockReturnValue(false);
    saveSessions([]);
    expect(mFs.mkdirSync).toHaveBeenCalledWith(TRACKER_DIR, { recursive: true });
  });

  it("skips mkdir when tracker directory already exists", () => {
    (mFs.existsSync as jest.Mock).mockReturnValue(true);
    saveSessions([]);
    expect(mFs.mkdirSync).not.toHaveBeenCalled();
  });

  it("writes sessions to disk as JSON", () => {
    (mFs.existsSync as jest.Mock).mockReturnValue(true);
    const sessions: SessionRecord[] = [
      { date: new Date().toISOString(), durationMinutes: 45, skillsUsed: ["explain"], topicsWorked: [] },
    ];
    saveSessions(sessions);
    expect(mFs.writeFileSync).toHaveBeenCalledWith(SESSIONS_FILE, expect.any(String));
  });

  it("prunes sessions older than 90 days before writing", () => {
    (mFs.existsSync as jest.Mock).mockReturnValue(true);
    const old = new Date();
    old.setDate(old.getDate() - 91);
    const sessions: SessionRecord[] = [
      { date: old.toISOString(), durationMinutes: 60, skillsUsed: [], topicsWorked: [] },
      { date: new Date().toISOString(), durationMinutes: 30, skillsUsed: [], topicsWorked: [] },
    ];
    saveSessions(sessions);
    const written = JSON.parse((mFs.writeFileSync as jest.Mock).mock.calls[0][1] as string) as SessionRecord[];
    expect(written).toHaveLength(1);
    expect(written[0].durationMinutes).toBe(30);
  });

  it("does not throw when writeFileSync fails", () => {
    (mFs.existsSync as jest.Mock).mockReturnValue(true);
    (mFs.writeFileSync as jest.Mock).mockImplementation(() => { throw new Error("disk full"); });
    expect(() => saveSessions([])).not.toThrow();
  });
});

// ─── recordSession ─────────────────────────────────────────────────────────

describe("recordSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mFs.existsSync as jest.Mock).mockReturnValue(false);
    (mFs.readFileSync as jest.Mock).mockReturnValue("[]");
  });

  it("returns a weekly summary string", () => {
    const { weeklySummary } = recordSession({ sessionDurationMinutes: 30, skillsUsed: ["homework"] });
    expect(typeof weeklySummary).toBe("string");
    expect(weeklySummary.length).toBeGreaterThan(0);
  });

  it("returns null nudge for a short session", () => {
    const { nudge } = recordSession({ sessionDurationMinutes: 30, skillsUsed: [] });
    expect(nudge).toBeNull();
  });

  it("returns a non-null nudge for a long session", () => {
    const { nudge } = recordSession({ sessionDurationMinutes: 200, skillsUsed: [] });
    expect(nudge).not.toBeNull();
  });

  it("persists the session to disk", () => {
    recordSession({ sessionDurationMinutes: 30, skillsUsed: ["review"] });
    expect(mFs.writeFileSync).toHaveBeenCalled();
    const written = JSON.parse((mFs.writeFileSync as jest.Mock).mock.calls[0][1] as string) as SessionRecord[];
    expect(written[0].skillsUsed).toEqual(["review"]);
  });

  it("includes topicsWorked when provided", () => {
    recordSession({ sessionDurationMinutes: 30, skillsUsed: [], topicsWorked: ["trees", "graphs"] });
    const written = JSON.parse((mFs.writeFileSync as jest.Mock).mock.calls[0][1] as string) as SessionRecord[];
    expect(written[0].topicsWorked).toEqual(["trees", "graphs"]);
  });
});
