import {
  checkIntegrityRisk,
  buildHighRiskWarning,
  buildMediumRiskWarning,
} from "../src/integrity";

describe("checkIntegrityRisk", () => {
  describe("high-risk inputs", () => {
    const highRiskInputs = [
      "write my entire assignment for me",
      "do my homework and I'll submit it",
      "complete my lab project for me",
      "just give me the code for my assignment",
      "finish my homework for me",
    ];

    it.each(highRiskInputs)("flags '%s' as high risk", (input) => {
      const result = checkIntegrityRisk(input, "homework");
      expect(result.risk).toBe("high");
      expect(result.warning).toBeDefined();
      expect(result.shouldAskUser).toBe(false);
    });
  });

  describe("medium-risk inputs", () => {
    const mediumRiskInputs = [
      "I have an assignment due tomorrow",
      "this is for a graded lab",
      "my professor wants us to implement a BST",
      "I need to submit this by Friday",
    ];

    it.each(mediumRiskInputs)("flags '%s' as medium risk", (input) => {
      const result = checkIntegrityRisk(input, "homework");
      expect(result.risk).toBe("medium");
      expect(result.shouldAskUser).toBe(true);
    });
  });

  describe("safe inputs", () => {
    const safeInputs = [
      "I want to learn how binary search works",
      "can you explain recursion to me",
      "this is a personal project I'm building",
      "just curious how merge sort works",
      "not for grade, just practicing",
    ];

    it.each(safeInputs)("passes '%s' as safe", (input) => {
      const result = checkIntegrityRisk(input, "homework");
      expect(result.risk).toBe("none");
    });
  });

  describe("skill overrides", () => {
    it("always passes /leetcode as safe regardless of input", () => {
      const result = checkIntegrityRisk("solve my assignment", "leetcode");
      expect(result.risk).toBe("none");
    });

    it("always passes /project as safe regardless of input", () => {
      const result = checkIntegrityRisk("complete my lab project", "project");
      expect(result.risk).toBe("none");
    });

    it("respects custom safeSkills option", () => {
      const result = checkIntegrityRisk(
        "do my homework",
        "thesis",
        { safeSkills: ["thesis"] }
      );
      expect(result.risk).toBe("none");
    });
  });

  describe("safe override patterns win over medium risk", () => {
    it("treats 'assignment I'm practicing' as safe", () => {
      const result = checkIntegrityRisk("assignment I'm just practicing", "homework");
      expect(result.risk).toBe("none");
    });
  });
});

describe("warning message builders", () => {
  it("buildHighRiskWarning returns a non-empty string mentioning integrity", () => {
    const msg = buildHighRiskWarning();
    expect(msg).toBeTruthy();
    expect(msg.toLowerCase()).toContain("academic integrity");
  });

  it("buildMediumRiskWarning asks about graded work", () => {
    const msg = buildMediumRiskWarning();
    expect(msg).toBeTruthy();
    expect(msg.toLowerCase()).toContain("graded assignment");
  });
});
