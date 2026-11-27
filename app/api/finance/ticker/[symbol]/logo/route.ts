import { NextResponse, type NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { normalizeSymbol } from "@/lib/finance";
import { resolveTickerLogoUrl } from "@/lib/finance/logo";
import { requireFinanceOwner } from "@/lib/finance/owner";

export const runtime = "nodejs";

const LOGO_TIMEOUT_MS = 5_000;

/**
 * GET /api/finance/ticker/[symbol]/logo
 * Session-authenticated proxy that resolves a ticker logo from the active
 * MarketData provider (e.g. Finnhub) or the alternative logo provider.
 * Returns 404 when unavailable so the UI falls back to the 2-letter monogram.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    await requireFinanceOwner();
    const { symbol: rawSymbol } = await params;
    const symbol = normalizeSymbol(decodeURIComponent(rawSymbol));
    if (!symbol) {
      return new NextResponse(null, { status: 404 });
    }

    const logoUrl = await resolveTickerLogoUrl(symbol);
    if (!logoUrl) {
      return new NextResponse(null, { status: 404 });
    }

    const upstream = await fetch(logoUrl, {
      signal: AbortSignal.timeout(LOGO_TIMEOUT_MS),
      cache: "force-cache",
    });
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !contentType.startsWith("image/")) {
      return new NextResponse(null, { status: 404 });
    }

    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return new NextResponse(null, { status: 404 });
  }
}
