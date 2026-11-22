import { describe, expect, it } from "vitest";
import {
  backoffMinutes,
  evaluationBodySchema,
  evidenceBodySchema,
  isEnrichmentComplete,
  nextRetryAt,
  overallVerdict,
  scoreBreakdown,
  sectionIsCapped,
  sectionStatuses,
} from "@/lib/finance/pipeline";
import { DEFAULT_PIPELINE_SETTINGS, parsePipelineSettings } from "@/lib/finance/pipeline-settings";

describe("enrichment jobs: retry and backoff (Stream B, job 6)", () => {
  it("waits 2, 4, 8 … minutes, capped at 60", () => {
    expect(backoffMinutes(1)).toBe(2);
    expect(backoffMinutes(2)).toBe(4);
    expect(backoffMinutes(3)).toBe(8);
    expect(backoffMinutes(6)).toBe(60);
    expect(backoffMinutes(50)).toBe(60);
  });

  it("puts the next attempt that far after now", () => {
    const now = new Date("2026-11-19T10:00:00.000Z");
    expect(nextRetryAt(now, 2).toISOString()).toBe("2026-11-19T10:04:00.000Z");
  });
});

describe("dossier items: caps and completeness (Stream B, job 5)", () => {
  it("caps a section only when its cap is set and reached", () => {
    expect(sectionIsCapped("news", 3, { news: 3 })).toBe(true);
    expect(sectionIsCapped("news", 2, { news: 3 })).toBe(false);
    expect(sectionIsCapped("news", 99, {})).toBe(false);
  });

  it("is complete only when every required section has a tier 1–2 item", () => {
    const almost = [
      { section: "business" as const, tier: 1 },
      { section: "numbers" as const, tier: 2 },
      { section: "filings" as const, tier: 1 },
      { section: "news" as const, tier: 2 },
    ];
    expect(isEnrichmentComplete(almost)).toBe(false);
    expect(isEnrichmentComplete([...almost, { section: "market_context" as const, tier: 1 }])).toBe(true);
    // Social is not required, and a tier 3–4 item in a required section doesn't count.
    expect(isEnrichmentComplete([...almost, { section: "market_context" as const, tier: 3 }])).toBe(false);
  });

  it("reports each section's coverage", () => {
    const statuses = sectionStatuses([
      { section: "business", tier: 1 },
      { section: "news", tier: 3 },
    ]);
    expect(statuses.find((s) => s.section === "business")).toMatchObject({ items: 1, tierOneOrTwo: 1, done: true });
    expect(statuses.find((s) => s.section === "news")).toMatchObject({ items: 1, tierOneOrTwo: 0, done: false });
    expect(statuses.find((s) => s.section === "social")).toMatchObject({ done: true });
  });

  it("refuses a dossier item with a bad tier or a non-http link", () => {
    const base = { section: "news", summary: "A full sentence about the source.", url: "https://example.com/a", tier: 1 };
    expect(evidenceBodySchema.safeParse(base).success).toBe(true);
    expect(evidenceBodySchema.safeParse({ ...base, tier: 5 }).success).toBe(false);
    expect(evidenceBodySchema.safeParse({ ...base, url: "ftp://example.com/a" }).success).toBe(false);
  });
});

describe("evaluation rubric: citations and the Against role (Stream B, job 7)", () => {
  const base = {
    call: "buy",
    confidence: 70,
    reasons: ["Cash flow has grown every year for a decade."],
    risks: [],
    changeMind: "A dividend cut would change my mind.",
    holdDuration: "3–5 years",
    citedEvidenceIds: ["evidence-1"],
  };

  it("accepts an evaluation that cites dossier items", () => {
    expect(evaluationBodySchema.safeParse(base).success).toBe(true);
  });

  it("refuses an evaluation with no citations", () => {
    expect(evaluationBodySchema.safeParse({ ...base, citedEvidenceIds: [] }).success).toBe(false);
    expect(evaluationBodySchema.safeParse({ ...base, citedEvidenceIds: undefined }).success).toBe(false);
  });

  it("keeps confidence within 0–100 and calls to the three allowed values", () => {
    expect(evaluationBodySchema.safeParse({ ...base, confidence: 101 }).success).toBe(false);
    expect(evaluationBodySchema.safeParse({ ...base, confidence: -1 }).success).toBe(false);
    expect(evaluationBodySchema.safeParse({ ...base, call: "strong_buy" }).success).toBe(false);
    expect(evaluationBodySchema.safeParse({ ...base, against: true }).success).toBe(true);
  });
});

describe("score breakdown and verdict (Stream B, job 8)", () => {
  it("counts calls and averages confidence without letting it vote", () => {
    const breakdown = scoreBreakdown([
      { call: "buy", confidence: 90, against: false },
      { call: "buy", confidence: 60, against: false },
      { call: "dont_buy", confidence: 40, against: true },
    ]);
    expect(breakdown).toEqual({ total: 3, buy: 2, hold: 0, dontBuy: 1, against: 1, averageConfidence: 63 });
    expect(overallVerdict(breakdown)).toBe("buy");
  });

  it("reads Hold on a tie and Don't buy when most say no", () => {
    expect(overallVerdict(scoreBreakdown([{ call: "buy", confidence: 50, against: false }, { call: "dont_buy", confidence: 50, against: false }]))).toBe("hold");
    // Buy level with Hold is still a tie.
    expect(
      overallVerdict(
        scoreBreakdown([
          { call: "buy", confidence: 50, against: false },
          { call: "hold", confidence: 50, against: false },
        ]),
      ),
    ).toBe("hold");
    expect(overallVerdict(scoreBreakdown([{ call: "dont_buy", confidence: 30, against: false }]))).toBe("dont_buy");
    expect(overallVerdict(scoreBreakdown([]))).toBe("hold");
  });
});

describe("pipeline settings staff set (PRD §3)", () => {
  const valid = {
    researchersScreen: "3",
    researchersEnrich: "3",
    researchersEvaluate: "5",
    reviewersPerStock: "3",
    reviewersWhoMustAgree: "2",
    candidateRule: "proposed_by_2",
    stageTimeLimitMinutes: "20",
    balanceShare: "35",
    browsingRules: "Polite browsing only.",
    oneTaskPerAgent: true,
    dossierCaps: { news: "8" },
  };

  it("accepts the defaults", () => {
    const parsed = parsePipelineSettings(valid);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.values.dossierCaps).toEqual({ news: 8 });
      expect(parsed.values.oneTaskPerAgent).toBe(true);
    }
  });

  it("refuses an unknown candidate rule and reviewers above the slots", () => {
    expect(parsePipelineSettings({ ...valid, candidateRule: "magic" })).toEqual({ ok: false, error: "invalid_candidate_rule" });
    expect(parsePipelineSettings({ ...valid, reviewersWhoMustAgree: "4" })).toEqual({ ok: false, error: "reviewers_above_slots" });
  });

  it("refuses a balance share over 100 and a bad cap", () => {
    expect(parsePipelineSettings({ ...valid, balanceShare: "101" })).toEqual({ ok: false, error: "invalid_share" });
    expect(parsePipelineSettings({ ...valid, dossierCaps: { news: "x" } })).toEqual({ ok: false, error: "invalid_dossier_cap" });
  });

  it("has sensible defaults", () => {
    expect(DEFAULT_PIPELINE_SETTINGS.researchersEvaluate).toBe(5);
    expect(DEFAULT_PIPELINE_SETTINGS.candidateRule).toBe("proposed_by_2");
  });
});
