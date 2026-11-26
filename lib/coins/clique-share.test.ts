import { describe, expect, it } from "vitest";
import { applyCliqueShare } from "./clique-share";
import type { IssuePayoutPlan } from "./issue-payout";

/** #clique-bids: the clique share comes out of the fixer's pay only, in equal parts, and nothing is lost. */
const plan: IssuePayoutPlan = {
  fee: 12,
  lines: [
    { userId: "kestrel-owner", role: "fixer", amount: 103, agentId: "kestrel" },
    { userId: "juniper-owner", role: "reporter", amount: 5, agentId: "juniper" },
  ],
};
const total = (p: IssuePayoutPlan) => p.fee + p.lines.reduce((sum, line) => sum + line.amount, 0);

describe("applyCliqueShare", () => {
  it("splits 20% of the fixer's pay equally between the other members", () => {
    const out = applyCliqueShare(plan, { percent: 20, members: [{ userId: "nova-owner", agentId: "nova" }, { userId: "juniper-owner", agentId: "juniper" }] });
    // floor(103 * 20%) = 20, so 10 each.
    expect(out.lines).toEqual([
      { userId: "kestrel-owner", role: "fixer", amount: 83, agentId: "kestrel" },
      { userId: "juniper-owner", role: "reporter", amount: 5, agentId: "juniper" },
      { userId: "nova-owner", role: "clique", amount: 10, agentId: "nova" },
      { userId: "juniper-owner", role: "clique", amount: 10, agentId: "juniper" },
    ]);
    expect(total(out)).toBe(total(plan));
  });

  it("keeps whole Ziks when the share doesn't divide evenly", () => {
    const out = applyCliqueShare(plan, { percent: 10, members: [{ userId: "a", agentId: "a" }, { userId: "b", agentId: "b" }, { userId: "c", agentId: "c" }] });
    expect(out.lines.filter((l) => l.role === "clique").map((l) => l.amount).sort()).toEqual([3, 3, 4]);
    expect(total(out)).toBe(total(plan));
  });

  it("changes nothing for a bid alone, a 0% share or a cluster of one", () => {
    expect(applyCliqueShare(plan, null)).toBe(plan);
    expect(applyCliqueShare(plan, { percent: 0, members: [{ userId: "a", agentId: "a" }] })).toBe(plan);
    expect(applyCliqueShare(plan, { percent: 20, members: [] })).toBe(plan);
  });

  it("never touches the other roles", () => {
    const out = applyCliqueShare(plan, { percent: 50, members: [{ userId: "a", agentId: "a" }] });
    expect(out.lines.find((l) => l.role === "reporter")?.amount).toBe(5);
    expect(out.lines.find((l) => l.role === "fixer")?.amount).toBe(52);
  });
});
