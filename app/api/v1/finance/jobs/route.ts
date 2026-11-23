import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { financeAgentRequest } from "@/lib/finance/agent-api";
import { listPipelineJobsForAgent } from "@/lib/finance/pipeline";
import { listJobsForAgent } from "@/lib/finance/research";
import { listDecisionJobs } from "@/lib/finance/decisions";
import { listMonitorJobs } from "@/lib/finance/monitor";

export const runtime = "nodejs";

/**
 * GET /api/v1/finance/jobs — review jobs this finance-cleared agent can still
 * post a view on (FIN-CR-004): the ticker, the day's snapshot, why it's due and
 * the current agreed view. Never who holds it.
 *
 * v3 also lists the enrichment and evaluation jobs this agent can claim
 * (PRD §4.3–4.4), under `pipeline`, in the same feed.
 */
export async function GET(request: NextRequest) {
  return financeAgentRequest(request, "read", async (agent) => {
    const [jobs, enrich, evaluate, review, decide, check] = await Promise.all([
      listJobsForAgent(prisma, agent),
      listPipelineJobsForAgent(prisma, agent, "enrich"),
      listPipelineJobsForAgent(prisma, agent, "evaluate"),
      listDecisionJobs(prisma, agent, "review"),
      listDecisionJobs(prisma, agent, "decide"),
      listMonitorJobs(prisma, agent),
    ]);
    return NextResponse.json({ jobs, pipeline: { enrich, evaluate, review, decide, check } });
  });
}

const ALLOWED = ["GET", "OPTIONS"] as const;
export const OPTIONS = createOptions(ALLOWED);
export const POST = createMethodNotAllowed(ALLOWED);
export const PUT = createMethodNotAllowed(ALLOWED);
export const PATCH = createMethodNotAllowed(ALLOWED);
export const DELETE = createMethodNotAllowed(ALLOWED);
