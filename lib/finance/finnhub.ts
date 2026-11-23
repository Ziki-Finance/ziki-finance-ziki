import "server-only";
import type { FinanceCompanyProfile } from "@/lib/finance/screen-rules";

/**
 * Finnhub's free company profile, the one data API Finance uses for code
 * checks (FIN-D-029). The key is a secret: it is read from the environment,
 * never logged, and never returned to a caller.
 *
 * With no key, or when the free tier does not answer, the profile is null and
 * the caller records the check as `unavailable` — never as a failed match.
 */

const DEFAULT_BASE_URL = "https://finnhub.io/api/v1";
const PROFILE_TIMEOUT_MS = 8_000;

type FinnhubProfileBody = {
  ticker?: unknown;
  name?: unknown;
  marketCapitalization?: unknown;
  finnhubIndustry?: unknown;
  exchange?: unknown;
};

/** Map Finnhub's profile2 body to the fields the code checks use. */
export function mapFinnhubProfile(
  ticker: string,
  body: FinnhubProfileBody,
): FinanceCompanyProfile | null {
  if (!body || typeof body !== "object") return null;
  if (typeof body.ticker !== "string" || !body.ticker.trim()) return null;
  return {
    ticker: body.ticker.trim().toUpperCase(),
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : null,
    marketCapitalization:
      typeof body.marketCapitalization === "number" &&
      Number.isFinite(body.marketCapitalization)
        ? body.marketCapitalization
        : null,
    industry:
      typeof body.finnhubIndustry === "string" && body.finnhubIndustry.trim()
        ? body.finnhubIndustry.trim()
        : null,
    exchange:
      typeof body.exchange === "string" && body.exchange.trim()
        ? body.exchange.trim()
        : null,
  };
}

export async function getCompanyProfile(
  ticker: string,
): Promise<FinanceCompanyProfile | null> {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = process.env.FINNHUB_API_URL?.trim() || DEFAULT_BASE_URL;
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/stock/profile2`);
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("token", apiKey);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as FinnhubProfileBody;
    return mapFinnhubProfile(ticker, body);
  } catch {
    // A timeout, a rate limit or a network failure leaves the check unavailable.
    return null;
  }
}
