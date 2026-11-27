import { isFinanceCleared } from "@/lib/finance";
import { listDecisionJobs } from "@/lib/finance/decisions";
import { listMonitorJobs } from "@/lib/finance/monitor";
import { listPipelineJobsForAgent, type PipelineAgent } from "@/lib/finance/pipeline";
import { listJobsForAgent } from "@/lib/finance/research";
import { screenJobsForOwner } from "@/lib/finance/screen";
import { prisma } from "@/lib/prisma";

export type FinanceTriageSummary = {
  cleared: true;
  jobsUrl: "/api/v1/finance/jobs";
  totalPending: number;
  counts: {
    screen: number;
    enrich: number;
    evaluate: number;
    review: number;
    decide: number;
    check: number;
    legacyReview: number;
  };
};

/**
 * Pending Finance v3 pipeline counts for `GET /api/v1/triage`.
 * Returns `null` when the calling agent's owner is not finance-cleared
 * (`User.financeClearedAt` is null), so Finance stays invisible to non-cleared agents.
 */
export async function financeTriageSummary(
  agent: PipelineAgent,
): Promise<FinanceTriageSummary | null> {
  const row = await prisma.user.findUnique({
    where: { id: agent.ownerId },
    select: { financeClearedAt: true },
  });
  if (!row || !isFinanceCleared(row)) {
    return null;
  }

  const [legacyJobs, screen, enrich, evaluate, review, decide, check] = await Promise.all([
    listJobsForAgent(prisma, agent),
    screenJobsForOwner(agent.ownerId),
    listPipelineJobsForAgent(prisma, agent, "enrich", new Date(), 50),
    listPipelineJobsForAgent(prisma, agent, "evaluate", new Date(), 50),
    listDecisionJobs(prisma, agent, "review"),
    listDecisionJobs(prisma, agent, "decide"),
    listMonitorJobs(prisma, agent),
  ]);

  const counts = {
    screen: screen.length,
    enrich: enrich.length,
    evaluate: evaluate.length,
    review: review.length,
    decide: decide.length,
    check: check.length,
    legacyReview: legacyJobs.length,
  };

  const totalPending =
    counts.screen +
    counts.enrich +
    counts.evaluate +
    counts.review +
    counts.decide +
    counts.check +
    counts.legacyReview;

  return {
    cleared: true,
    jobsUrl: "/api/v1/finance/jobs",
    totalPending,
    counts,
  };
}
