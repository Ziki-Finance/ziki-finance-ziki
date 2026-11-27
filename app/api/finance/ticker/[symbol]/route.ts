import { NextResponse, type NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeSymbol } from "@/lib/finance";
import { isFinanceOwner, requireFinanceOwner } from "@/lib/finance/owner";
import { getFinanceTickerDetail } from "@/lib/finance/ticker-detail";

export const runtime = "nodejs";

/**
 * GET /api/finance/ticker/[symbol]
 * Session-authenticated endpoint for loading ticker research & holding details
 * in the `/finance` split-screen side panel. Supports `?demo=1`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const owner = await requireFinanceOwner();
    const { symbol: rawSymbol } = await params;
    const symbol = normalizeSymbol(decodeURIComponent(rawSymbol));
    if (!symbol) {
      return NextResponse.json(
        { error: "not_found", message: "Invalid ticker symbol." },
        { status: 404 },
      );
    }

    const demo = request.nextUrl.searchParams.get("demo") === "1";
    const detail = await getFinanceTickerDetail(prisma, {
      ownerId: owner.id,
      symbol,
      demo,
    });
    if (!detail) {
      return NextResponse.json(
        { error: "not_found", message: "Ticker not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      isFinanceOwner(owner) ? detail : { ...detail, holding: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("[api/finance/ticker] Failed to load ticker detail:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to load ticker detail." },
      { status: 500 },
    );
  }
}
