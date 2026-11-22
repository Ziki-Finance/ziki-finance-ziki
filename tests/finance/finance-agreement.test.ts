import { describe, expect, it } from "vitest";
import { neededFor, reachesAgreement, settleViews, tally, verdictWeight, type TallyVerdict } from "@/lib/finance/agreement";
import { DEFAULT_FINANCE_SETTINGS } from "@/lib/finance/settings";

const v = (ownerId: string, verdict: TallyVerdict["verdict"], weight = 1): TallyVerdict => ({ ownerId, verdict, weight });
const at = (s: number) => new Date(1_800_000_000_000 + s * 1000);
/** The numbers staff can change (FIN-D-022). */
const staffSet = { agreementNeeded: 2, managerVoteWeight: 5, sellAgreementNeeded: 6 };

describe("agreement (PRD §7.3)", () => {
  it("weights a manager's verdict 3 by default, and whatever staff set after that", () => {
    expect(verdictWeight("manager", DEFAULT_FINANCE_SETTINGS)).toBe(3);
    expect(verdictWeight("working", DEFAULT_FINANCE_SETTINGS)).toBe(1);
    expect(verdictWeight("manager", staffSet)).toBe(5);
    expect(verdictWeight("working", staffSet)).toBe(1);
  });

  it("counts one verdict per owner, the heaviest", () => {
    const t = tally([v("a", "agree"), v("a", "agree"), v("b", "agree", 3), v("b", "disagree", 1)]);
    expect(t).toEqual({ agree: 4, disagree: 0, unsure: 0, agentsAgree: 3, agentsTotal: 3 });
  });

  it("needs 3 agrees, outweighing disagree and unsure together", () => {
    expect(reachesAgreement(tally([v("a", "agree"), v("b", "agree"), v("c", "agree")]), 3)).toBe(true);
    expect(reachesAgreement(tally([v("a", "agree"), v("b", "agree")]), 3)).toBe(false);
    const split = tally([v("a", "agree"), v("b", "agree"), v("c", "agree"), v("d", "disagree"), v("e", "disagree"), v("f", "unsure")]);
    expect(reachesAgreement(split, 3)).toBe(false);
  });

  it("asks 4 for a change to Sell, 3 to stay at Sell, or the numbers staff set", () => {
    expect(neededFor("sell", "buy_keep", DEFAULT_FINANCE_SETTINGS)).toBe(4);
    expect(neededFor("sell", null, DEFAULT_FINANCE_SETTINGS)).toBe(4);
    expect(neededFor("sell", "sell", DEFAULT_FINANCE_SETTINGS)).toBe(3);
    expect(neededFor("consider_selling", "buy_keep", DEFAULT_FINANCE_SETTINGS)).toBe(3);
    expect(neededFor("sell", "buy_keep", staffSet)).toBe(6);
    expect(neededFor("sell", "sell", staffSet)).toBe(2);
    expect(neededFor("buy_keep", "sell", staffSet)).toBe(2);
  });

  it("picks the heaviest agreed view and says when agents are divided", () => {
    const three = [v("a", "agree"), v("b", "agree"), v("c", "agree")];
    const four = [...three, v("d", "agree")];
    const keep = { id: "keep", call: "buy_keep" as const, createdAt: at(1), verdicts: three };
    const sell = { id: "sell", call: "consider_selling" as const, createdAt: at(2), verdicts: four };
    expect(settleViews([keep, sell], "buy_keep", DEFAULT_FINANCE_SETTINGS)).toMatchObject({ agreed: true, viewId: "sell", divided: true });
    expect(settleViews([keep], "buy_keep", DEFAULT_FINANCE_SETTINGS)).toMatchObject({
      agreed: true,
      viewId: "keep",
      divided: false,
      tally: { agentsAgree: 4, agentsTotal: 4 },
    });
    expect(settleViews([{ ...keep, verdicts: [v("a", "agree")] }], null, DEFAULT_FINANCE_SETTINGS)).toEqual({ agreed: false });
  });

  it("settles with staff-set numbers, from the next settle", () => {
    const two = [v("a", "agree"), v("b", "agree")];
    const keep = { id: "keep", call: "buy_keep" as const, createdAt: at(1), verdicts: two };
    expect(settleViews([keep], null, DEFAULT_FINANCE_SETTINGS)).toEqual({ agreed: false });
    expect(settleViews([keep], null, staffSet)).toMatchObject({ agreed: true, viewId: "keep" });
  });

  it("breaks a tie by the earlier view", () => {
    const three = [v("a", "agree"), v("b", "agree"), v("c", "agree")];
    const first = { id: "first", call: "buy_keep" as const, createdAt: at(1), verdicts: three };
    const second = { id: "second", call: "buy_keep" as const, createdAt: at(2), verdicts: three };
    expect(settleViews([second, first], null, DEFAULT_FINANCE_SETTINGS)).toMatchObject({ viewId: "first", divided: false });
  });
});
