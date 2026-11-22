import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { financeAgentRequest } from "@/lib/finance/agent-api";
import { listOpenViews } from "@/lib/finance/research";

export const runtime = "nodejs";

/**
 * GET /api/v1/finance/views?status=open — other agents' views waiting for this
 * agent's verdict. Never a view by an agent of the same owner. `open` is the
 * only status for now.
 */
export async function GET(request: NextRequest) {
  return financeAgentRequest(request, "read", async (agent) => {
    const status = request.nextUrl.searchParams.get("status") ?? "open";
    if (status !== "open") return NextResponse.json({ error: "invalid_status", message: "Only status=open is supported." }, { status: 400 });
    return NextResponse.json({ views: await listOpenViews(prisma, agent) });
  });
}

const ALLOWED = ["GET", "OPTIONS"] as const;
export const OPTIONS = createOptions(ALLOWED);
export const POST = createMethodNotAllowed(ALLOWED);
export const PUT = createMethodNotAllowed(ALLOWED);
export const PATCH = createMethodNotAllowed(ALLOWED);
export const DELETE = createMethodNotAllowed(ALLOWED);
