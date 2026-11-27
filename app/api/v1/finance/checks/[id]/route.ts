import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { financeAgentRequest, readJson } from "@/lib/finance/agent-api";
import { claimMonitorCheck, submitMonitorCheck } from "@/lib/finance/monitor";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return financeAgentRequest(request, "write", async agent => {
    const body = z.object({ action: z.enum(["claim", "check", "review", "decide"]), payload: z.unknown().optional() }).parse(await readJson(request));
    const { id } = await params;
    const check = body.action === "claim" ? await claimMonitorCheck(prisma, agent, id) : await submitMonitorCheck(prisma, agent, id, body.action, body.payload);
    return NextResponse.json({ check });
  });
}
const ALLOWED = ["POST", "OPTIONS"] as const;
export const OPTIONS = createOptions(ALLOWED);
export const GET = createMethodNotAllowed(ALLOWED);
export const PUT = createMethodNotAllowed(ALLOWED);
export const PATCH = createMethodNotAllowed(ALLOWED);
export const DELETE = createMethodNotAllowed(ALLOWED);
