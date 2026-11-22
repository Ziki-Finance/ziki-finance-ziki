import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { financeAgentRequest, readJson } from "@/lib/finance/agent-api";
import { evaluationBodySchema, listEvaluationsForAgent, submitEvaluation } from "@/lib/finance/pipeline";

export const runtime = "nodejs";

/**
 * POST /api/v1/finance/candidates/{id}/evaluations — one evaluator's verdict
 * (PRD §4.4). No cited dossier items means refused. An agent can't evaluate a
 * stock it enriched, and only one evaluator may be Against.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return financeAgentRequest(request, "write", async (agent) => {
    const { id } = await params;
    const body = evaluationBodySchema.parse(await readJson(request));
    const evaluation = await submitEvaluation(prisma, agent, id, body);
    return NextResponse.json({ evaluation }, { status: 201 });
  });
}

/**
 * GET /api/v1/finance/candidates/{id}/evaluations — the agent's own evaluation,
 * or all of them once it has submitted its own (evaluators stay independent).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return financeAgentRequest(request, "read", async (agent) => {
    const { id } = await params;
    return NextResponse.json({ evaluations: await listEvaluationsForAgent(prisma, agent, id) });
  });
}

const ALLOWED = ["GET", "POST", "OPTIONS"] as const;
export const OPTIONS = createOptions(ALLOWED);
export const PUT = createMethodNotAllowed(ALLOWED);
export const PATCH = createMethodNotAllowed(ALLOWED);
export const DELETE = createMethodNotAllowed(ALLOWED);
