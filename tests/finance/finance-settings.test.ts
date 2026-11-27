import { describe, expect, it } from "vitest";
import { DEFAULT_FINANCE_SETTINGS, parseFinanceSettings } from "@/lib/finance/settings";

const input = (agreementNeeded: unknown, managerVoteWeight: unknown, sellAgreementNeeded: unknown) => ({
  agreementNeeded,
  managerVoteWeight,
  sellAgreementNeeded,
});

describe("agreement numbers staff set (FIN-D-022, idea 19)", () => {
  it("defaults to 3, 3 and 4", () => {
    expect(DEFAULT_FINANCE_SETTINGS).toEqual({ agreementNeeded: 3, managerVoteWeight: 3, sellAgreementNeeded: 4 });
  });

  it("accepts whole numbers of 1 or more", () => {
    expect(parseFinanceSettings(input("2", "5", "6"))).toEqual({
      ok: true,
      values: { agreementNeeded: 2, managerVoteWeight: 5, sellAgreementNeeded: 6 },
    });
    expect(parseFinanceSettings(input("1", "1", "1"))).toEqual({
      ok: true,
      values: { agreementNeeded: 1, managerVoteWeight: 1, sellAgreementNeeded: 1 },
    });
  });

  it("refuses zero, negatives, fractions, letters and empty boxes", () => {
    for (const bad of ["0", "-1", "3.5", "three", "", " ", "1e3"]) {
      expect(parseFinanceSettings(input(bad, "3", "4"))).toEqual({ ok: false, error: "invalid_number" });
      expect(parseFinanceSettings(input("3", bad, "4"))).toEqual({ ok: false, error: "invalid_number" });
      expect(parseFinanceSettings(input("3", "3", bad))).toEqual({ ok: false, error: "invalid_number" });
    }
  });

  it("refuses a Sell bar below the agreement needed", () => {
    expect(parseFinanceSettings(input("5", "3", "4"))).toEqual({ ok: false, error: "sell_below_agreement" });
    expect(parseFinanceSettings(input("5", "3", "5"))).toMatchObject({ ok: true });
  });
});
