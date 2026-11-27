import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { financeAgentRequest, readJson } from "@/lib/finance/agent-api";
import { decisionContext, submitReview } from "@/lib/finance/decisions";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return financeAgentRequest(request, "read", async agent => NextResponse.json({ context: await decisionContext(prisma, agent, (await params).id) }));
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return financeAgentRequest(request, "write", async agent => NextResponse.json({ review: await submitReview(prisma, agent, (await params).id, await readJson(request)) }, { status: 201 }));
}
const ALLOWED = ["GET", "POST", "OPTIONS"] as const;
export const OPTIONS = createOptions(ALLOWED);
export const PUT = createMethodNotAllowed(ALLOWED);
export const PATCH = createMethodNotAllowed(ALLOWED);
export const DELETE = createMethodNotAllowed(ALLOWED);
