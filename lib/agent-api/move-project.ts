import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/agents/audit";
import { IssueApiError } from "@/lib/agent-api/errors";
import { activityCreateData } from "@/lib/activity-log";
import { parseIssueRef } from "@/lib/issue-ref";
import type { AgentLevel } from "@prisma/client";

/**
 * Moving an issue to another project of its organisation (#move-project), for an issue filed in the wrong one.
 * `POST /api/v1/issues/{id}/project`: any agent moves it, in any state, with the reason.
 *
 * The one it can't move is an issue whose price is locked: that was reserved from its project's budget and is paid
 * out against it. Its number stays (numbers are organisation-wide, and the old address redirects to the new one); its
 * area is the old project's, so it is cleared. Its claim, confirmations, bids, comments, pull request and history move
 * with it; a pull request in the old project's repository is then fixed with POST /api/v1/issues/{id}/pull-request.
 * The history records the move and the reason.
 */

export const moveProjectSchema = z.object({
  toProjectId: z.string().trim().min(1).max(191),
  reason: z.string().trim().min(1).max(2000),
});

export type MovedIssue = { issueId: string; number: number; fromProjectId: string; projectId: string };

function refuse(status: number, error: string, message: string): never {
  throw new IssueApiError(status, message, { error, message });
}

export async function agentMoveIssueToProject(
  agent: { agentId: string; ownerId: string; organisationId: string; level: AgentLevel },
  scope: { organisationId: string; projectId: string },
  issueRef: string,
  raw: unknown,
): Promise<MovedIssue> {
  const body = moveProjectSchema.safeParse(raw);
  if (!body.success) refuse(400, "invalid_body", "Give toProjectId (the project to move it to) and a reason.");
  const { toProjectId, reason } = body.data;

  const parsed = parseIssueRef(issueRef);
  const bug = await prisma.bug.findFirst({
    where: { ...scope, isDeleted: false, ...(parsed.kind === "number" ? { number: parsed.number } : { id: parsed.id }) },
    select: { id: true, number: true, projectId: true, lockedPriceZik: true, project: { select: { name: true } } },
  });
  if (!bug) refuse(404, "not_found", "Issue not found.");
  const target = await prisma.project.findFirst({ where: { id: toProjectId, organisationId: scope.organisationId, archivedAt: null }, select: { id: true, name: true } });
  if (!target) refuse(404, "project_not_found", "No project with that id in this organisation.");
  if (target.id === bug.projectId) refuse(409, "same_project", `The issue is already in ${target.name}.`);
  if (bug.lockedPriceZik !== null) refuse(409, "price_locked", "Its price is locked from this project's budget, so it can't move.");

  const moved = await prisma.$transaction(async (tx) => {
    const { count } = await tx.bug.updateMany({ where: { id: bug.id, projectId: bug.projectId, lockedPriceZik: null }, data: { projectId: target.id, areaId: null } });
    if (count === 0) refuse(409, "status_changed", "The issue changed meanwhile; read it again.");
    await tx.bugActivity.createMany({
      data: activityCreateData([
        {
          bugId: bug.id,
          actorId: agent.ownerId,
          type: "edited",
          summary: `moved this issue from ${bug.project.name} to ${target.name}`,
          metadata: { field: "project", from: bug.project.name, to: target.name, note: reason },
        },
      ]),
    });
    return true;
  });
  if (moved) {
    await audit({ agentId: agent.agentId, organisationId: scope.organisationId }, "issue.project_moved", `bug:${bug.id}`, { issueId: bug.id, from: bug.projectId, to: target.id, reason }, { bugId: bug.id });
  }
  return { issueId: bug.id, number: bug.number, fromProjectId: bug.projectId, projectId: target.id };
}
