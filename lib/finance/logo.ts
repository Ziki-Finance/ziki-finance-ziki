import { marketData } from "./market-data";

const DEFAULT_ALT_LOGO_TEMPLATE =
  "https://assets.parqet.com/logos/symbol/{SYMBOL}?format=png";

/**
 * Alternative logo URL when the active `MarketData` provider doesn't supply
 * one (e.g. when `FINNHUB_API_KEY` is unset or swapped out). Override with
 * `FINANCE_LOGO_URL_TEMPLATE` (using `{SYMBOL}` placeholder).
 */
export function alternativeLogoUrl(symbol: string): string {
  const template =
    process.env.FINANCE_LOGO_URL_TEMPLATE?.trim() || DEFAULT_ALT_LOGO_TEMPLATE;
  return template.replace(/\{SYMBOL\}/g, encodeURIComponent(symbol));
}

/**
 * Resolve a company logo URL from the active swappable `MarketData` provider
 * first (e.g. Finnhub `/stock/profile2`), falling back to the alternative
 * logo endpoint when no provider logo is returned.
 */
export async function resolveTickerLogoUrl(
  symbol: string,
): Promise<string | null> {
  const provider = marketData();
  if (provider.name !== "directory") {
    const match = await provider.lookup(symbol);
    if (match?.logoUrl && /^https?:\/\//.test(match.logoUrl)) {
      return match.logoUrl;
    }
  }
  return alternativeLogoUrl(symbol);
}
