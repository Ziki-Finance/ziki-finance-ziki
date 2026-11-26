import { prisma } from "@/lib/prisma";
import { ideaPath, projectPath, refOf } from "@/lib/project-paths";

/**
 * Where a number goes in an organisation (#one-number). Ideas and issues share one number sequence, so a number is
 * one idea or one issue there: `/<org>/<project>/<n>` and `/<org>/<project>/ideas/<n>` both lead to it, whichever it
 * is and whichever of the organisation's projects holds it. Null when nothing of that kind has the number.
 */
const select = { project: { select: { slug: true, organisation: { select: { slug: true } } } } };
const live = (organisationId: string, number: number) => ({ organisationId, number, isDeleted: false, project: { archivedAt: null } });

/** The page of the organisation's idea with this number. */
export async function ideaNumberPath(organisationId: string, number: number): Promise<string | null> {
  const idea = await prisma.idea.findFirst({ where: live(organisationId, number), select });
  return idea ? ideaPath(refOf(idea.project), number) : null;
}

/** The page of the organisation's issue with this number. */
export async function issueNumberPath(organisationId: string, number: number): Promise<string | null> {
  const issue = await prisma.bug.findFirst({ where: live(organisationId, number), select });
  return issue ? projectPath(refOf(issue.project), `/${number}`) : null;
}
