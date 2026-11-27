import { describe, expect, it } from "vitest";
import { assertDeciderVerdict, decisionBodySchema, nextWeeklyCheck, reasonStatus, reviewOutcome } from "@/lib/finance/decision-rules";
import { holdingFromTrades, industryWarning, tradeBodySchema } from "@/lib/finance/portfolio-ledger";
import { submitDecision, submitReview } from "@/lib/finance/decisions";
import type { PrismaClient } from "@prisma/client";

const verdict = decisionBodySchema.parse({ call: "go", sentence: "The evidence supports a patient investment.", reasons: ["Cash flow is stable.", "Debt is manageable.", "Demand remains resilient."],
  answerAgainst: "Debt and patent risks are addressed in the cited filings.", changeMind: "A sustained decline in recurring cash flow.", buyRangeLow: 85, buyRangeHigh: 95,
  reviewIfBelow: 70, holdDuration: "3–5 years", reasonPoints: [{ text: "Recurring cash flow stays positive.", main: true }, { text: "Debt remains below one year of earnings.", main: false }] });

describe("Stream C review and decision gates", () => {
  const split = [{ call: "go" }, { call: "go" }, { call: "no_go" }];
  it("waits for the quota and applies the staff bar by head", () => {
    expect(reviewOutcome(split.slice(0, 2), 3, 2).passed).toBe(false);
    expect(reviewOutcome(split, 3, 2)).toMatchObject({ complete: true, passed: true, split: true, go: 2 });
    expect(reviewOutcome(split, 3, 3).passed).toBe(false);
  });
  it("never lets a Decider override rejected review, even with an answer", () => {
    expect(() => assertDeciderVerdict({ ...verdict, answerDissent: "The new evidence resolves the cash-flow concern." }, [{ call: "go" }, { call: "no_go" }, { call: "no_go" }], 3, 2)).toThrow(/cannot override/);
  });
  it("requires a written answer to a split and permits a reasoned unanimous No-go", () => {
    expect(() => assertDeciderVerdict(verdict, split, 3, 2)).toThrow(/dissent/);
    expect(assertDeciderVerdict({ ...verdict, answerDissent: "The cited cash-flow data addresses the dissent." }, split, 3, 2).passed).toBe(true);
    expect(assertDeciderVerdict({ ...verdict, call: "no_go", sentence: "Unanimous reviewers missed the approaching debt maturity." }, [{ call: "go" }, { call: "go" }, { call: "go" }], 3, 2).passed).toBe(true);
  });
  it("refuses inverted levels and a thesis without exactly one main reason", () => {
    expect(decisionBodySchema.safeParse({ ...verdict, buyRangeLow: 100 }).success).toBe(false);
    expect(decisionBodySchema.safeParse({ ...verdict, reasonPoints: verdict.reasonPoints.map(p => ({ ...p, main: false })) }).success).toBe(false);
  });
  it("refuses lower-class agents before any database work", async () => {
    const db = {} as PrismaClient;
    await expect(submitReview(db, { agentId: "worker", ownerId: "owner", level: "working" }, "stock", {})).rejects.toMatchObject({ status: 403 });
    await expect(submitDecision(db, { agentId: "manager", ownerId: "owner", level: "manager" }, "stock", verdict)).rejects.toMatchObject({ status: 403 });
  });
});

describe("Stream C portfolio accounting", () => {
  it("derives average cost and remaining benchmark exposure from buys and partial sales", () => {
    const holding = holdingFromTrades([{ side: "bought", shares: "10", price: "100", benchmarkPrice: "400" },
      { side: "bought", shares: "10", price: "200", benchmarkPrice: "400" }, { side: "sold", shares: "5", price: "250" }]);
    expect(holding.shares.toString()).toBe("15");
    expect(holding.averageCost?.toString()).toBe("150");
    expect(holding.cost?.toString()).toBe("2250");
    expect(holding.realized?.toString()).toBe("500");
    expect(holding.benchmarkUnits?.toString()).toBe("5.625");
  });
  it("refuses oversells at any point of the dated ledger, including before a later buy", () => {
    expect(() => holdingFromTrades([{ side: "sold", shares: "1", price: "100" }, { side: "bought", shares: "10", price: "100" }])).toThrow(/exceeds/);
    expect(() => holdingFromTrades([{ side: "bought", shares: "0.000001", price: "100" }, { side: "sold", shares: "0.000002", price: "100" }])).toThrow(/exceeds/);
  });
  it("preserves decimal fractions and never invents missing cost or benchmark values", () => {
    expect(holdingFromTrades([{ side: "bought", shares: "0.1", price: "0.2" }, { side: "bought", shares: "0.2", price: "0.2" }]).shares.toString()).toBe("0.3");
    const unknown = holdingFromTrades([{ side: "bought", shares: "10", price: null }]);
    expect(unknown.averageCost).toBeNull(); expect(unknown.benchmarkUnits).toBeNull();
  });
  it("validates precision, actual calendar dates, and strictly positive prices", () => {
    const trade = { symbol: "aapl", side: "bought", shares: "1.123456", price: "100.1234", date: "2026-11-23", requestId: "84e06cd5-a34f-44fb-a025-7d934df94e3b" };
    expect(tradeBodySchema.parse(trade).symbol).toBe("AAPL");
    for (const invalid of [{ shares: "0" }, { shares: "1.1234567" }, { price: "0" }, { date: "2026-02-30" }]) expect(tradeBodySchema.safeParse({ ...trade, ...invalid }).success).toBe(false);
  });
  it("warns only on a code-calculated industry concentration with complete prices", () => {
    expect(industryWarning([{ industry: "Technology", value: 40 }, { industry: "Health", value: 60 }], 35)).toMatch(/Health.*60%/);
    expect(industryWarning([{ industry: "Technology", value: null }], 35)).toBeNull();
  });
});

describe("Stream C reason monitoring", () => {
  it("distinguishes a single secondary break from main or multiple breaks", () => {
    expect(reasonStatus([{ main: true, status: "holding" }, { main: false, status: "holding" }])).toBe("holds");
    expect(reasonStatus([{ main: true, status: "holding" }, { main: false, status: "breaking" }])).toBe("weakening");
    expect(reasonStatus([{ main: true, status: "breaking" }, { main: false, status: "holding" }])).toBe("broken");
    expect(reasonStatus([{ main: true, status: "holding" }, { main: false, status: "breaking" }, { main: false, status: "breaking" }])).toBe("broken");
  });
  it("schedules the next Monday, including a full week after a Monday check", () => {
    expect(nextWeeklyCheck(new Date("2026-11-23T15:00:00Z")).toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(nextWeeklyCheck(new Date("2026-11-26T15:00:00Z")).toISOString()).toBe("2026-11-30T00:00:00.000Z");
  });
});
