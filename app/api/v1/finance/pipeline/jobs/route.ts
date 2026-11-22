import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { financeAgentRequest } from "@/lib/finance/agent-api";
import { listPipelineJobsForAgent } from "@/lib/finance/pipeline";

export const runtime = "nodejs";

/**
 * GET /api/v1/finance/pipeline/jobs?kind=enrich|evaluate — the enrichment or
 * evaluation jobs this finance-cleared agent can claim now (PRD §4.3–4.4).
 */
export async function GET(request: NextRequest) {
  return financeAgentRequest(request, "read", async (agent) => {
    const kind = request.nextUrl.searchParams.get("kind") === "evaluate" ? "evaluate" : "enrich";
    return NextResponse.json({ kind, jobs: await listPipelineJobsForAgent(prisma, agent, kind) });
  });
}

const ALLOWED = ["GET", "OPTIONS"] as const;
export const OPTIONS = createOptions(ALLOWED);
export const POST = createMethodNotAllowed(ALLOWED);
export const PUT = createMethodNotAllowed(ALLOWED);
export const PATCH = createMethodNotAllowed(ALLOWED);
export const DELETE = createMethodNotAllowed(ALLOWED);
