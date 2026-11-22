import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { financeAgentRequest, readJson } from "@/lib/finance/agent-api";
import { failPipelineJob } from "@/lib/finance/pipeline";

export const runtime = "nodejs";

/**
 * POST /api/v1/finance/pipeline/jobs/{id}/fail — { "error": "..." }. The job is
 * retried with backoff until it reaches its attempt limit, then marked failed
 * (PRD job 6).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return financeAgentRequest(request, "write", async (agent) => {
    const { id } = await params;
    const body = (await readJson(request)) as { error?: unknown } | null;
    const message = typeof body?.error === "string" && body.error.trim() ? body.error.trim().slice(0, 500) : "The agent reported a failure.";
    const result = await failPipelineJob(prisma, agent, id, message);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  });
}

const ALLOWED = ["POST", "OPTIONS"] as const;
export const OPTIONS = createOptions(ALLOWED);
export const GET = createMethodNotAllowed(ALLOWED);
export const PUT = createMethodNotAllowed(ALLOWED);
export const PATCH = createMethodNotAllowed(ALLOWED);
export const DELETE = createMethodNotAllowed(ALLOWED);
