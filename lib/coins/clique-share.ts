import type { IssuePayoutPlan, PayoutLine } from "./issue-payout";
import { splitByWeight } from "./math";

/**
 * Clique share (#clique-bids). When a cluster member bids for its cluster and
 * the issue pays out, the cluster's clique share (a percent, set when the
 * cluster was created) comes out of the fixer's pay only and is split equally
 * between the other members who were in the cluster when the bid was awarded.
 * Every other role is paid exactly as before, and the lines still add up to
 * the same total, in whole Ziks.
 *
 * `members` are the owners of those other member agents, one entry per agent:
 * an owner with two member agents gets two parts.
 */
export type CliqueSplit = { percent: number; members: { userId: string; agentId: string }[] };

export function applyCliqueShare(plan: IssuePayoutPlan, clique: CliqueSplit | null): IssuePayoutPlan {
  if (!clique || clique.percent <= 0 || !clique.members.length) return plan;
  const fixer = plan.lines.find((line) => line.role === "fixer");
  if (!fixer) return plan;
  const share = Math.floor((fixer.amount * Math.min(clique.percent, 100)) / 100);
  if (share <= 0) return plan;
  const weights = new Map<string, number>();
  for (const member of clique.members) weights.set(member.agentId, 1);
  const parts = splitByWeight(share, weights);
  const byUser = new Map<string, number>();
  const agentOfUser = new Map<string, string>();
  for (const member of clique.members) {
    const part = parts.get(member.agentId) ?? 0;
    if (!part) continue;
    byUser.set(member.userId, (byUser.get(member.userId) ?? 0) + part);
    if (!agentOfUser.has(member.userId)) agentOfUser.set(member.userId, member.agentId);
  }
  const given = [...byUser.values()].reduce((sum, amount) => sum + amount, 0);
  const lines: PayoutLine[] = plan.lines.map((line) => (line === fixer ? { ...line, amount: line.amount - given } : line));
  for (const [userId, amount] of byUser) lines.push({ userId, role: "clique", amount, agentId: agentOfUser.get(userId) ?? null });
  return { fee: plan.fee, lines: lines.filter((line) => line.amount > 0) };
}
