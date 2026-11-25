import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/agents/audit";
import { hasLevel } from "@/lib/agents/levels";
import { IssueApiError } from "@/lib/agent-api/errors";
import { parseIssueRef } from "@/lib/issue-ref";
import type { AgentLevel } from "@prisma/client";

/**
 * Live · Confirmed (#live-confirmed): someone looked at live work and says it is fine, the Work Feed's Approve on live
 * work. It moves the issue from the Overview's Work Feed to its Delivered tab, once, while it is live and not broken.
 * A person does it from the Work Feed; a manager or merger agent does it for its owner with
 * `POST /api/v1/issues/{id}/live-confirmation`. Either way it is recorded as the person's.
 */

const NOT_FOUND = "Issue not found.";
const NOT_LIVE = "Only live work that isn't broken can be approved.";

export type LiveConfirmation = { issueId: string; liveConfirmedAt: string; alreadyConfirmed: boolean };

/** Marks the issue Live · Confirmed by `userId`. Throws `IssueApiError` 409 `not_live` for work that isn't live. */
export async function confirmLiveWork(userId: string, bug: { id: string; status: string; substatus: string; liveConfirmedAt: Date | null }): Promise<LiveConfirmation> {
  if (bug.status !== "resolved" || bug.substatus === "merged_broken") {
    throw new IssueApiError(409, NOT_LIVE, { error: "not_live", message: NOT_LIVE, status: bug.status, substatus: bug.substatus });
  }
  if (bug.liveConfirmedAt) return { issueId: bug.id, liveConfirmedAt: bug.liveConfirmedAt.toISOString(), alreadyConfirmed: true };
  const at = new Date();
  // Only the first approval counts: a second one at the same moment changes nothing.
  const { count } = await prisma.bug.updateMany({ where: { id: bug.id, liveConfirmedAt: null }, data: { liveConfirmedAt: at, liveConfirmedById: userId } });
  if (count === 0) {
    const fresh = await prisma.bug.findUniqueOrThrow({ where: { id: bug.id }, select: { liveConfirmedAt: true } });
    return { issueId: bug.id, liveConfirmedAt: (fresh.liveConfirmedAt ?? at).toISOString(), alreadyConfirmed: true };
  }
  return { issueId: bug.id, liveConfirmedAt: at.toISOString(), alreadyConfirmed: false };
}

/**
 * `POST /api/v1/issues/{id}/live-confirmation` (manager): a manager or merger agent approves live work for its owner,
 * as the Work Feed's Approve does. 200 `{ issueId, liveConfirmedAt, alreadyConfirmed }`.
 */
export async function agentConfirmLiveWork(
  agent: { agentId: string; ownerId: string; organisationId: string; level: AgentLevel },
  scope: { organisationId: string; projectId: string },
  issueRef: string,
): Promise<LiveConfirmation> {
  if (!hasLevel(agent.level, "manager")) {
    const message = "Only a manager or merger agent can approve live work.";
    throw new IssueApiError(403, message, { error: "insufficient_level", message });
  }
  const parsed = parseIssueRef(issueRef);
  const bug = await prisma.bug.findFirst({
    where: { ...scope, isDeleted: false, ...(parsed.kind === "number" ? { number: parsed.number } : { id: parsed.id }) },
    select: { id: true, status: true, substatus: true, liveConfirmedAt: true, organisationId: true },
  });
  if (!bug) throw new IssueApiError(404, NOT_FOUND, { error: "not_found", message: NOT_FOUND });
  const result = await confirmLiveWork(agent.ownerId, bug);
  if (!result.alreadyConfirmed) {
    await audit({ agentId: agent.agentId, organisationId: bug.organisationId }, "issue.live_confirmed", `bug:${bug.id}`, { issueId: bug.id }, { bugId: bug.id });
  }
  return result;
}
