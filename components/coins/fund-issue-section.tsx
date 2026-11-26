import { prisma } from "@/lib/prisma";
import { SETTLE_FIELDS, lockPrice, priceStage } from "@/lib/coins/budget";
import { isPayer } from "@/lib/coins/payers";
import { escrowBalance, lockBug } from "@/lib/coins/ledger";
import { IssueFundingCard } from "./issue-funding-card";

/**
 * The Ziks behind an issue (#price-lock), on the issue page inside the Reward panel. Everyone sees where its price
 * stands; payers (#payers), the only people who fund, get a link to the project's budget. A
 * settled price the project's budget covers is locked as the page opens, so nobody waits for the next sweep. Draws
 * nothing for a finished issue that holds nothing.
 */
export async function FundIssueSection({ bugId, userId }: { bugId: string; userId: string }) {
  const select = {
    organisationId: true, status: true, isDeleted: true, payoutReleasedAt: true, projectId: true,
    ...SETTLE_FIELDS,
    project: { select: { slug: true, organisation: { select: { slug: true } } } },
  } as const;
  let bug = await prisma.bug.findUnique({ where: { id: bugId }, select });
  if (!bug || bug.isDeleted) return null;
  const finished = bug.status === "closed" || bug.status === "resolved" || Boolean(bug.payoutReleasedAt);

  const now = new Date();
  const before = priceStage(bug, now);
  // Settled, or locked but short (its price was raised): the budget covers it now if it can.
  const short = before.stage === "locked" && before.price > (await escrowBalance(prisma, bugId));
  if (!finished && (before.stage === "settled" || short)) {
    const locked = await prisma
      .$transaction(async (tx) => {
        await lockBug(tx, bugId);
        return lockPrice(tx, bugId, now);
      })
      .catch(() => null);
    if (locked?.locked) bug = (await prisma.bug.findUnique({ where: { id: bugId }, select })) ?? bug;
  }

  const stage = priceStage(bug, now);
  const held = Math.max(0, await escrowBalance(prisma, bugId));
  if (finished && held === 0) return null;

  // Only payers fund (#payers), and they do it from the Budget page (#funding-button); here they get a link to it.
  const mayFundProject = finished ? false : await isPayer(prisma, userId, bug.organisationId);
  const price = stage.stage === "estimating" ? null : stage.price;

  return (
    <IssueFundingCard
      bugId={bugId}
      stage={stage.stage}
      price={price}
      settlesInMs={stage.stage === "settling" ? stage.settlesAt.getTime() - now.getTime() : null}
      held={held}
      canFundProject={mayFundProject}
      budgetHref={`/${bug.project.organisation.slug}/${bug.project.slug}/budget`}
    />
  );
}
