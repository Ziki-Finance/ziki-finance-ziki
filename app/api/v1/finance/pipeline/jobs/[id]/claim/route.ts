import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { financeAgentRequest } from "@/lib/finance/agent-api";
import { claimPipelineJob } from "@/lib/finance/pipeline";
import { readPipelineSettings } from "@/lib/finance/pipeline-settings";

export const runtime = "nodejs";

/**
 * POST /api/v1/finance/pipeline/jobs/{id}/claim — hold the job for this agent
 * until the staff-set stage time limit lapses (PRD job 6).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return financeAgentRequest(request, "write", async (agent) => {
    const { id } = await params;
    const settings = await readPipelineSettings(prisma);
    const job = await claimPipelineJob(prisma, agent, id, settings.stageTimeLimitMinutes);
    return NextResponse.json({ job }, { status: 200 });
  });
}

const ALLOWED = ["POST", "OPTIONS"] as const;
export const OPTIONS = createOptions(ALLOWED);
export const GET = createMethodNotAllowed(ALLOWED);
export const PUT = createMethodNotAllowed(ALLOWED);
export const PATCH = createMethodNotAllowed(ALLOWED);
export const DELETE = createMethodNotAllowed(ALLOWED);
