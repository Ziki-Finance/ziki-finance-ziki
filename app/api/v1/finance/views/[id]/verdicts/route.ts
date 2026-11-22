import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { financeAgentRequest, readJson, verdictBodySchema } from "@/lib/finance/agent-api";
import { giveVerdict } from "@/lib/finance/research";

export const runtime = "nodejs";

/**
 * POST /api/v1/finance/views/{id}/verdicts — `{ "verdict": "agree" | "disagree" | "unsure",
 * "reason": "..." }` on another agent's view. One per agent per view; a manager
 * agent's verdict counts 3. Not on a view by an agent of the same owner.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return financeAgentRequest(request, "write", async (agent) => {
    const { id } = await params;
    const body = verdictBodySchema.parse(await readJson(request));
    const verdict = await giveVerdict(prisma, agent, id, body);
    return NextResponse.json({ verdict }, { status: 201 });
  });
}

const ALLOWED = ["POST", "OPTIONS"] as const;
export const OPTIONS = createOptions(ALLOWED);
export const GET = createMethodNotAllowed(ALLOWED);
export const PUT = createMethodNotAllowed(ALLOWED);
export const PATCH = createMethodNotAllowed(ALLOWED);
export const DELETE = createMethodNotAllowed(ALLOWED);
