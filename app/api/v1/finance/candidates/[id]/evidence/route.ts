import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { financeAgentRequest, readJson } from "@/lib/finance/agent-api";
import { addEvidence, evidenceBodySchema } from "@/lib/finance/pipeline";
import { readPipelineSettings } from "@/lib/finance/pipeline-settings";

export const runtime = "nodejs";

/**
 * POST /api/v1/finance/candidates/{id}/evidence — add one dossier item while
 * enriching a candidate (PRD §4.3). Duplicate URLs merge; a section at its cap
 * refuses a new URL. A price the agent read is checked against Finnhub.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return financeAgentRequest(request, "write", async (agent) => {
    const { id } = await params;
    const body = evidenceBodySchema.parse(await readJson(request));
    const settings = await readPipelineSettings(prisma);
    const item = await addEvidence(prisma, agent, id, body, settings);
    return NextResponse.json({ evidence: item }, { status: item.merged ? 200 : 201 });
  });
}

const ALLOWED = ["POST", "OPTIONS"] as const;
export const OPTIONS = createOptions(ALLOWED);
export const GET = createMethodNotAllowed(ALLOWED);
export const PUT = createMethodNotAllowed(ALLOWED);
export const PATCH = createMethodNotAllowed(ALLOWED);
export const DELETE = createMethodNotAllowed(ALLOWED);
