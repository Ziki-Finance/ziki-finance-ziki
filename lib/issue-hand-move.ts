import type { Substatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moveTo, STATUS_OF } from "@/lib/issue-substatus";
import { OWNER_NOTE_MAX, ownerMove } from "@/lib/owner-moves";
import { activityCreateData, statusChangedSummary } from "@/lib/activity-log";
import { publish } from "@/lib/agent-api/events";
import { issueChangePayload, publishWebEvent } from "@/lib/agent-api/web-events";
import { releasePayoutIfLive } from "@/lib/coins/issue-payout";
import { notifyLater } from "@/lib/notify";

/** Who moves the issue: a person (an owner or admin from the Status chip), or their manager agent. */
export type HandMover = { userId: string; name: string | null; agent: { id: string; name: string } | null };

export type HandMoveResult = { ok: true; from: Substatus; to: Substatus } | { ok: false; status: 404 | 409 | 400; error: string; message: string };

/**
 * Moves an issue by hand (#owner-control, #manager-status): one of the moves `OWNER_MOVES` offers for where it is now.
 * An organisation's owner or admin does it from the issue's Status chip; a manager or merger agent does it with
 * `POST /api/v1/issues/{id}/status`. Moving it out of the work (back to Open, or Closed) stops the agent holding it;
 * into Live, it pays out once reported deployed, like any resolve. The history says who moved it, with their note.
 * The caller checks who may; this checks the move and makes it.
 */
export async function moveIssueByHand(by: HandMover, bugId: string, to: Substatus, note: string): Promise<HandMoveResult> {
  const fail = (status: 404 | 409 | 400, error: string, message: string): HandMoveResult => ({ ok: false, status, error, message });
  const existing = await prisma.bug.findUnique({
    where: { id: bugId },
    select: { id: true, title: true, status: true, substatus: true, isDeleted: true, organisationId: true, reporterId: true },
  });
  if (!existing || existing.isDeleted) return fail(404, "not_found", "Issue not found");

  const move = ownerMove(existing.substatus, to);
  if (!move) return fail(409, "move_not_available", "That move isn't available from this step any more. Refresh the page to see where the issue is now.");

  const trimmed = note.trim();
  if (move.needsReason && !trimmed) return fail(400, "reason_required", "Say why you're closing it. Agents and reporters will see this.");
  if (trimmed.length > OWNER_NOTE_MAX) return fail(400, "note_too_long", `Keep the note under ${OWNER_NOTE_MAX} characters.`);

  const target = STATUS_OF[to];
  const leavesWork = target === "open" || target === "closed";
  const data = {
    ...moveTo(to),
    ...(leavesWork ? { assigneeId: null } : {}),
    ...(target === "closed" ? { closeReason: "not_planned" as const, closeEvidence: trimmed, closedAt: new Date() } : {}),
    ...(existing.status === "closed" && target !== "closed" ? { closeReason: null, closeEvidence: null, closedAt: null } : {}),
    ...(target === "closed" || target === "resolved" ? { isBoosted: false, boostedAt: null } : {}),
  };
  const releaseReason = by.agent ? "manager_agent" : "owner";
  const who = by.agent ? `by the manager agent ${by.agent.name}` : "as the owner";

  const moved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Bug" WHERE id = ${bugId} FOR UPDATE`;
    // Someone else may have moved it since the page loaded.
    const fresh = await tx.bug.findUniqueOrThrow({ where: { id: bugId }, select: { substatus: true } });
    if (fresh.substatus !== existing.substatus) return false;

    await tx.bug.update({ where: { id: bugId }, data });

    if (leavesWork) {
      const claims = await tx.issueClaim.findMany({
        where: { bugId, releasedAt: null, status: { in: ["offered", "planning", "active"] } },
        select: { id: true, agentId: true, beneficiaryUserId: true },
      });
      if (claims.length > 0) {
        await tx.issueClaim.updateMany({
          where: { id: { in: claims.map((claim) => claim.id) } },
          data: { status: "released", releasedAt: new Date(), releaseReason },
        });
        for (const claim of claims) {
          await publish(tx, {
            organisationId: existing.organisationId,
            type: "claim.released",
            actorAgentId: claim.agentId,
            bugId,
            payload: { claimId: claim.id, issueId: bugId, beneficiaryUserId: claim.beneficiaryUserId, reason: releaseReason },
          });
        }
      }
    }

    // Into Live (#one-payment): the issue's funded Ziks pay out once it's reported deployed, as with any resolve.
    if (target === "resolved") await releasePayoutIfLive(tx, bugId);

    await tx.bugActivity.createMany({
      data: activityCreateData([
        {
          bugId,
          actorId: by.userId,
          type: "status_changed",
          summary: `${statusChangedSummary(existing.substatus, to)} ${who}`,
          metadata: { field: "status", from: existing.substatus, to, ...(trimmed ? { note: trimmed } : {}), ...(by.agent ? { via: "manager_agent", agentId: by.agent.id } : {}) },
        },
      ]),
    });
    await publishWebEvent(tx, {
      bugId,
      type: "issue.updated",
      actorUserId: by.userId,
      payload: issueChangePayload(data as Record<string, unknown>),
    });
    return true;
  });
  if (!moved) return fail(409, "moved_meanwhile", "Someone moved this issue while you were looking. Refresh the page to see where it is now.");

  if (target !== existing.status) {
    notifyLater({
      actorId: by.userId,
      actorName: by.agent?.name ?? by.name ?? "Someone",
      bugId,
      bugTitle: existing.title,
      kind: "status_changed",
      reporterId: existing.reporterId,
      from: existing.status,
      to: target,
      note: trimmed || undefined,
    });
  }
  return { ok: true, from: existing.substatus, to };
}
