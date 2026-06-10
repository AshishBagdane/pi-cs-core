import {
  getBurnoutNudge,
  buildWeeklySummary,
  getWeeklyStats,
  WeeklyStats,
  SessionRecord,
} from "../src/progress";

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
