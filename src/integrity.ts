// ─── Types ─────────────────────────────────────────────────────────────────

export type IntegrityRisk = "none" | "low" | "medium" | "high";

export interface IntegrityCheckResult {
  risk: IntegrityRisk;
  reason?: string;
  warning?: string;
  shouldAskUser?: boolean;
}

// ─── Risk Signals ──────────────────────────────────────────────────────────

export const HIGH_RISK_PATTERNS: RegExp[] = [
  /write.*(my|the)\s+(entire|whole|complete|full)\s+(assignment|homework|lab|project)/i,
  /do\s+my\s+(homework|assignment|lab|project)/i,
  /complete\s+(my|the)\s+(assignment|homework|lab|task)/i,
  /submit.*(this|it)\s+as\s+my\s+own/i,
  /just\s+give\s+me\s+the\s+(code|answer|solution)\s+(for|to)\s+my/i,
  /finish\s+my\s+(assignment|homework|lab)\s+for\s+me/i,
];

export const MEDIUM_RISK_PATTERNS: RegExp[] = [
  /\bassignment\b/i,
  /\bhomework\b/i,
  /\bdue\s+(tomorrow|tonight|today|friday|monday)\b/i,
  /\blab\s+\d+\b/i,
  /\bproject\s+\d+\b/i,
  /\bgraded\b/i,
  /\bsubmit\b/i,
  /\bprofessor\s+(wants|requires|said)\b/i,
];

// Safe patterns that override medium-risk (clearly practice/learning)
export const SAFE_OVERRIDE_PATTERNS: RegExp[] = [
  /\bpractic/i,
  /\blearn\b/i,
  /\bunderstand\b/i,
  /\bjust\s+curious\b/i,
  /\bnot\s+for\s+grade/i,
  /\bpersonal\s+project\b/i,
  /\bside\s+project\b/i,
  /\bleetcode\b/i,
];

// ─── Warning Messages ──────────────────────────────────────────────────────

export function buildHighRiskWarning(): string {
  return `⚠️ **Academic Integrity Notice**

It sounds like you're asking me to complete a graded assignment for you. I won't do that — not because I can't, but because it would genuinely hurt your learning and could get you in serious trouble.

Here's what I *can* do:
- Break down the problem and explain the concepts involved
- Give you hints and guided pseudocode
- Help you debug your own attempts
- Explain similar example problems

Tell me where you're actually stuck, and let's work through it together. 🐠`;
}

export function buildMediumRiskWarning(): string {
  return `Before I dive in — **is this for a graded assignment?**

- If **yes**: I'll use guided-mode (hints, pseudocode, concept explanations — no complete solutions)
- If **no**: I'll give you a full solution with explanation

Just let me know!`;
}

// ─── Checker ───────────────────────────────────────────────────────────────

export interface IntegrityCheckOptions {
  /** Skill names that always bypass the integrity check (default: ["leetcode", "project"]) */
  safeSkills?: string[];
}

export function checkIntegrityRisk(
  userInput: string,
  skillName: string,
  options: IntegrityCheckOptions = {}
): IntegrityCheckResult {
  const safeSkills = options.safeSkills ?? ["leetcode", "project"];

  if (safeSkills.includes(skillName)) {
    return { risk: "none" };
  }

  const isSafe = SAFE_OVERRIDE_PATTERNS.some((p) => p.test(userInput));
  if (isSafe) {
    return { risk: "none" };
  }

  const highRiskMatch = HIGH_RISK_PATTERNS.find((p) => p.test(userInput));
  if (highRiskMatch) {
    return {
      risk: "high",
      reason: "User appears to be asking for a complete, submittable solution",
      warning: buildHighRiskWarning(),
      shouldAskUser: false,
    };
  }

  const mediumRiskMatch = MEDIUM_RISK_PATTERNS.find((p) => p.test(userInput));
  if (mediumRiskMatch) {
    return {
      risk: "medium",
      reason: `Input mentions "${mediumRiskMatch.source}" — may be graded work`,
      warning: buildMediumRiskWarning(),
      shouldAskUser: true,
    };
  }

  return { risk: "none" };
}
