import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeSymbol } from "@/lib/finance";
import { financeAgentRequest } from "@/lib/finance/agent-api";
import { tickerRecord } from "@/lib/finance/research";

export const runtime = "nodejs";

/** GET /api/v1/finance/tickers/{ticker} — the last 30 snapshots and the agreed views. No owner data. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  return financeAgentRequest(request, "read", async () => {
    const { ticker } = await params;
    const symbol = normalizeSymbol(decodeURIComponent(ticker));
    const record = symbol ? await tickerRecord(prisma, symbol) : null;
    if (!record) return NextResponse.json({ error: "not_found", message: "Ziki doesn't track that ticker." }, { status: 404 });
    return NextResponse.json(record);
  });
}

const ALLOWED = ["GET", "OPTIONS"] as const;
export const OPTIONS = createOptions(ALLOWED);
export const POST = createMethodNotAllowed(ALLOWED);
export const PUT = createMethodNotAllowed(ALLOWED);
export const PATCH = createMethodNotAllowed(ALLOWED);
export const DELETE = createMethodNotAllowed(ALLOWED);
