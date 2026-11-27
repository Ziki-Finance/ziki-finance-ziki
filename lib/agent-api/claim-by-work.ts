import type { Prisma, Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/agent-api/events";
import type { AgentContext } from "@/lib/agents/require-agent";

/**
 * Any agent may hand in finished work (#deliver-claims): a delivery, or a force-merge of a pull request merged without
 * Ziki. If the agent doesn't hold the issue, handing the work in claims it: at once when nobody holds it (an Open
 * issue's pending offers are released), and taking it over from an agent that has held it longer than this. Under it,
 * the work is refused, so an agent actively on the issue isn't overrun.
 */
export const TAKEOVER_AFTER_MS = 12 * 60 * 60 * 1000;

export type LiveClaim = { id: string; agentId: string };

/**
 * Whether `agent` may take the issue by handing in work, and which live claims that releases. `heldStatuses` are the
 * main statuses where another agent's claim counts as holding it (subject to the 12 hours).
 */
export async function takeoverFor(
  bugId: string,
  agentId: string,
  now = Date.now(),
): Promise<{ ok: true; release: LiveClaim[]; heldByOther: boolean } | { ok: false; hoursLeft: number }> {
  const live = await prisma.issueClaim.findMany({
    where: { bugId, releasedAt: null, status: { in: ["offered", "planning", "active"] } },
    select: { id: true, agentId: true, status: true, claimedAt: true, offeredAt: true, createdAt: true },
  });
  const held = live.find((row) => row.agentId !== agentId && (row.status === "active" || row.status === "planning"));
  if (held) {
    const left = (held.claimedAt ?? held.offeredAt ?? held.createdAt).getTime() + TAKEOVER_AFTER_MS - now;
    if (left > 0) return { ok: false, hoursLeft: Math.ceil(left / 3_600_000) };
  }
  return { ok: true, release: live.map((row) => ({ id: row.id, agentId: row.agentId })), heldByOther: Boolean(held) };
}

/** The refusal while another agent has held the issue less than TAKEOVER_AFTER_MS. */
export function heldByAnotherMessage(hoursLeft: number, what: "deliver" | "force-merge"): string {
  return `Another agent took this issue less than ${TAKEOVER_AFTER_MS / 3_600_000} hours ago. You can ${what} it, taking it over, in about ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.`;
}

/** Main statuses where handing in work may claim the issue. Delivered work (Done, Merge) is redelivered only by its holder. */
export function claimableByDelivery(status: Status): boolean {
  return status === "open" || status === "in_progress";
}

/**
 * Takes the issue for the agent handing in work: the live claims named are released (taken over), and the agent gets an
 * active claim, its owner the assignee. Returns the new claim. The caller then moves the issue on.
 */
export async function claimForWork(
  tx: Prisma.TransactionClient,
  agent: AgentContext,
  issue: { id: string; projectId: string },
  release: LiveClaim[],
  via: "delivery" | "force_merge",
): Promise<{ id: string; beneficiaryUserId: string }> {
  const at = new Date();
  if (release.length) {
    await tx.issueClaim.updateMany({
      where: { id: { in: release.map((row) => row.id) }, releasedAt: null },
      data: { status: "released", releasedAt: at, releaseReason: `taken over by another agent's ${via === "delivery" ? "delivery" : "force-merge"} (#deliver-claims)` },
    });
  }
  const claim = await tx.issueClaim.create({
    data: { bugId: issue.id, beneficiaryUserId: agent.ownerId, agentId: agent.agentId, status: "active", claimedAt: at, lastHeartbeatAt: at, deliverBy: at },
    select: { id: true },
  });
  await tx.bug.update({ where: { id: issue.id }, data: { assigneeId: agent.ownerId } });
  const word = via === "delivery" ? "a delivery" : "a force-merge";
  await tx.bugActivity.create({
    data: {
      bugId: issue.id,
      actorId: agent.ownerId,
      type: "assignee_changed",
      summary: release.some((row) => row.agentId !== agent.agentId) ? `took the issue over with ${word}` : `took the issue with ${word}`,
      metadata: { field: "assignee", to: agent.ownerId, via, claimId: claim.id, released: release.map((row) => row.id) },
    },
  });
  await publish(tx, {
    organisationId: agent.organisationId,
    type: "claim.accepted",
    actorAgentId: agent.agentId,
    bugId: issue.id,
    projectId: issue.projectId,
    payload: { claimId: claim.id, issueId: issue.id, projectId: issue.projectId, beneficiaryUserId: agent.ownerId, via, released: release.map((row) => row.id) },
  });
  return { id: claim.id, beneficiaryUserId: agent.ownerId };
}
