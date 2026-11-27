import { describe, expect, it } from "vitest";
import {
  candidateRuleMet,
  candidateStageFor,
  checkCandidateAgainstCriteria,
  rankCandidates,
  type FinanceCompanyProfile,
} from "@/lib/finance/screen-rules";
import {
  financeCandidateSignalSchema,
  financeCriteriaInputSchema,
} from "@/lib/validations/finance";

const profile = (
  overrides: Partial<FinanceCompanyProfile> = {},
): FinanceCompanyProfile => ({
  ticker: "AAPL",
  name: "Apple Inc",
  marketCapitalization: 3_000_000,
  industry: "Technology",
  exchange: "NASDAQ",
  ...overrides,
});

describe("finance criteria", () => {
  it("fills a preset's words and lower-cases its tags", () => {
    const parsed = financeCriteriaInputSchema.parse({
      preset: "steady_dividend_growers",
      industries: ["Banks", "BANKS", "Energy"],
      leaveOut: ["Tobacco"],
      howManyStocks: "10",
    });
    expect(parsed.words.length).toBeGreaterThan(20);
    expect(parsed.industries).toEqual(["banks", "energy"]);
    expect(parsed.leaveOut).toEqual(["tobacco"]);
    expect(parsed.howManyStocks).toBe(10);
  });

  it("requires the owner's own words, an allowed stock count, and no overlap", () => {
    expect(
      financeCriteriaInputSchema.safeParse({ preset: "own_words", words: "short" })
        .success,
    ).toBe(false);
    expect(
      financeCriteriaInputSchema.safeParse({
        preset: "own_words",
        words: "Long enough words to describe the companies I want.",
        howManyStocks: 7,
      }).success,
    ).toBe(false);
    expect(
      financeCriteriaInputSchema.safeParse({
        preset: "own_words",
        words: "Long enough words to describe the companies I want.",
        industries: ["banks"],
        leaveOut: ["Banks"],
      }).success,
    ).toBe(false);
  });
});

describe("finance candidate submissions", () => {
  const valid = {
    runId: "run-1",
    ticker: "aapl",
    whyItFits: [{ criterion: "Growing dividend", why: "Raised it for 12 years." }],
    sources: ["https://www.sec.gov/edgar/search/"],
  };

  it("normalises a lower-case ticker and defaults to a proposal", () => {
    const parsed = financeCandidateSignalSchema.parse(valid);
    expect(parsed.ticker).toBe("AAPL");
    expect(parsed.kind).toBe("proposed");
  });

  it("refuses a bad ticker, a missing reason and a missing source", () => {
    expect(
      financeCandidateSignalSchema.safeParse({ ...valid, ticker: "1BAD!" }).success,
    ).toBe(false);
    expect(
      financeCandidateSignalSchema.safeParse({ ...valid, whyItFits: [] }).success,
    ).toBe(false);
    expect(
      financeCandidateSignalSchema.safeParse({ ...valid, sources: [] }).success,
    ).toBe(false);
  });
});

describe("screening rule", () => {
  it("moves a stock on at two proposals, or one proposal and one confirmation", () => {
    expect(candidateRuleMet({ proposals: 2, confirmations: 0 })).toBe(true);
    expect(candidateRuleMet({ proposals: 1, confirmations: 1 })).toBe(true);
    expect(candidateRuleMet({ proposals: 1, confirmations: 0 })).toBe(false);
    expect(candidateRuleMet({ proposals: 0, confirmations: 2 })).toBe(false);
  });

  it("drops a failed code check even when the rule is met", () => {
    expect(
      candidateStageFor({
        codeCheckStatus: "failed",
        proposals: 3,
        confirmations: 1,
      }),
    ).toBe("dropped");
    expect(
      candidateStageFor({
        codeCheckStatus: "unavailable",
        proposals: 2,
        confirmations: 0,
      }),
    ).toBe("issue");
  });
});

describe("code checks against free data", () => {
  it("checks nothing when the criteria have no numeric tag", () => {
    expect(
      checkCandidateAgainstCriteria(
        { companySize: "any", industries: [], leaveOut: [] },
        null,
      ),
    ).toEqual({ status: "not_checked", checks: [] });
  });

  it("never drops a candidate when the data is missing", () => {
    expect(
      checkCandidateAgainstCriteria(
        { companySize: "large", industries: [], leaveOut: [] },
        null,
      ).status,
    ).toBe("unavailable");
    expect(
      checkCandidateAgainstCriteria(
        { companySize: "any", industries: ["banks"], leaveOut: [] },
        profile({ industry: null }),
      ).status,
    ).toBe("unavailable");
  });

  it("passes a large company, fails a small one and respects leave-out", () => {
    expect(
      checkCandidateAgainstCriteria(
        { companySize: "large", industries: ["technology"], leaveOut: [] },
        profile(),
      ).status,
    ).toBe("matched");

    const small = checkCandidateAgainstCriteria(
      { companySize: "large", industries: [], leaveOut: [] },
      profile({ marketCapitalization: 1_200 }),
    );
    expect(small.status).toBe("failed");
    expect(small.checks[0]?.passed).toBe(false);

    expect(
      checkCandidateAgainstCriteria(
        { companySize: "any", industries: [], leaveOut: ["tech"] },
        profile(),
      ).status,
    ).toBe("failed");
  });
});

describe("candidate ranking", () => {
  it("ranks by proposals, then confirmations, then age", () => {
    const ranked = rankCandidates([
      { ticker: "A", proposals: 1, confirmations: 1, createdAt: new Date(1) },
      { ticker: "B", proposals: 2, confirmations: 0, createdAt: new Date(2) },
      { ticker: "C", proposals: 1, confirmations: 1, createdAt: new Date(0) },
    ]);
    expect(ranked.map((row) => row.ticker)).toEqual(["B", "C", "A"]);
  });
});
