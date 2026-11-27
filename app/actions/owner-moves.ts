"use server";

import { revalidatePath } from "next/cache";
import type { Substatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { organisationAccessFor } from "@/lib/organisation-access";
import { moveIssueByHand } from "@/lib/issue-hand-move";
import { OWNER_NOTE_MAX } from "@/lib/owner-moves";
import { revalidateIssue } from "@/lib/revalidate-issue";
import { IssueApiError } from "@/lib/agent-api/errors";
import { ownerArchiveIdea, ownerConvertIdea, ownerRejectIdea } from "@/lib/agent-api/idea-verdicts";
import { IDEA_ARCHIVE_REASONS, IDEA_WITHDRAWN_REASON, type IdeaArchiveReason } from "@/lib/idea-archive";

export type OwnerMoveResult = { ok: true } | { error: string };

const NOT_OWNER = "Only an owner or admin of this organisation can move an issue by hand.";

/**
 * The organisation owner moves an issue from its Status chip (#owner-control): one of the moves `OWNER_MOVES` offers
 * for where it is now (lib/issue-hand-move.ts, which a manager agent's `POST /api/v1/issues/{id}/status` shares).
 */
export async function ownerMoveIssueAction(bugId: string, to: Substatus, note: string): Promise<OwnerMoveResult> {
  const user = await requireUser();
  const existing = await prisma.bug.findUnique({ where: { id: bugId }, select: { organisationId: true, isDeleted: true } });
  if (!existing || existing.isDeleted) return { error: "Issue not found" };
  const access = await organisationAccessFor(user.id, existing.organisationId, user.role);
  if (!access.admin) return { error: NOT_OWNER };
  const result = await moveIssueByHand({ userId: user.id, name: user.name ?? null, agent: null }, bugId, to, note);
  if (!result.ok) return { error: result.error };
  revalidatePath("/[org]/[project]", "layout");
  revalidateIssue();
  return { ok: true };
}

/** An open idea the signed-in owner may decide, with its scope; or why not. */
async function ownedIdea(ideaId: string) {
  const user = await requireUser();
  const idea = await prisma.idea.findFirst({
    where: { id: ideaId, isDeleted: false },
    select: { id: true, organisationId: true, projectId: true },
  });
  if (!idea) return { error: "Idea not found" } as const;
  const access = await organisationAccessFor(user.id, idea.organisationId, user.role);
  if (!access.admin) return { error: "Only an owner or admin of this organisation can decide an idea by hand." } as const;
  return { user, scope: { organisationId: idea.organisationId, projectId: idea.projectId }, ideaId: idea.id } as const;
}

async function ideaStep(step: () => Promise<unknown>): Promise<OwnerMoveResult> {
  try {
    await step();
  } catch (error) {
    if (error instanceof IssueApiError) return { error: error.message };
    console.error("[owner-idea] failed", error);
    return { error: "That didn't work. Please try again." };
  }
  revalidatePath("/[org]/[project]", "layout");
  return { ok: true };
}

/** The owner turns an idea into an issue now, whatever its score. Answers with the new issue's number. */
export async function ownerAcceptIdeaAction(ideaId: string): Promise<OwnerMoveResult & { issueNumber?: number }> {
  const owned = await ownedIdea(ideaId);
  if ("error" in owned) return { error: owned.error as string };
  let issueId: string | null = null;
  const result = await ideaStep(async () => {
    issueId = (await ownerConvertIdea(owned.scope, owned.user.id, owned.ideaId)).issueId;
  });
  if ("error" in result || !issueId) return result;
  const issue = await prisma.bug.findUnique({ where: { id: issueId }, select: { number: true } });
  return { ok: true, issueNumber: issue?.number };
}

/** The owner turns an idea down, with the reason the reporter will read. */
export async function ownerRejectIdeaAction(ideaId: string, reason: string): Promise<OwnerMoveResult> {
  if (!reason.trim()) return { error: "Say why, so whoever suggested it understands." };
  if (reason.trim().length > OWNER_NOTE_MAX) return { error: `Keep the reason under ${OWNER_NOTE_MAX} characters.` };
  const owned = await ownedIdea(ideaId);
  if ("error" in owned) return { error: owned.error as string };
  return ideaStep(() => ownerRejectIdea(owned.scope, owned.user.id, owned.ideaId, reason));
}

/** The owner files an idea away: already done, a duplicate, or for another project. */
export async function ownerArchiveIdeaAction(ideaId: string, reason: string, evidence: string): Promise<OwnerMoveResult> {
  if (!(IDEA_ARCHIVE_REASONS as readonly string[]).includes(reason) || reason === IDEA_WITHDRAWN_REASON) return { error: "Pick why you're archiving it." };
  if (!evidence.trim()) return { error: "Add a line of evidence: the pull request, the duplicate, or the right project." };
  const owned = await ownedIdea(ideaId);
  if ("error" in owned) return { error: owned.error as string };
  return ideaStep(() => ownerArchiveIdea(owned.scope, owned.ideaId, { reason: reason as IdeaArchiveReason, evidence: evidence.trim().slice(0, 10_000) }));
}
