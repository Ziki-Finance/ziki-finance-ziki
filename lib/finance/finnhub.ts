import type { FinanceTickerType } from "@prisma/client";
import type { FinanceCompanyProfile } from "@/lib/finance/screen-rules";
import { logger } from "@/lib/logger";
import { eastern } from "./calendar";
import type { DailyBar, Headline, MarketData, TickerMatch } from "./market-data";

/**
 * Finnhub, the market data provider for Finance during testing (FIN-CR-006,
 * idea 18; FIN-D-021). Called from nowhere else: `market-data.ts` is the only
 * module that knows this one exists (FIN-D-013).
 *
 * The free plan allows about 60 calls a minute, so every call goes through one
 * rolling-window queue here (`FINNHUB_CALLS_PER_MINUTE`). The evening snapshots
 * already run a few at a time, so the limit is never approached in one burst.
 *
 * The key is read from `FINNHUB_API_KEY` and is never logged, returned to a
 * page or written anywhere. With no key, `marketData()` keeps the built-in
 * directory and prices show "—".
 */

const BASE = "https://finnhub.io/api/v1";
const TIMEOUT_MS = 8_000;

/** Free plan: 60 calls a minute. Keep a margin for other requests on the same key. */
export const FINNHUB_CALLS_PER_MINUTE = 55;
const WINDOW_MS = 60_000;

/** The key, or null when it isn't set. Never printed. */
export function finnhubApiKey(): string | null {
  const key = process.env.FINNHUB_API_KEY?.trim();
  return key ? key : null;
}

/** Call times in the last minute, this process only. */
const spent: number[] = [];

/**
 * Wait for a free slot in the minute, then take it. Workers can await a timer
 * without spending CPU, so a queue here costs nothing that counts.
 */
export async function waitForSlot(now: () => number = Date.now): Promise<void> {
  for (;;) {
    const at = now();
    while (spent.length > 0 && at - spent[0] >= WINDOW_MS) spent.shift();
    if (spent.length < FINNHUB_CALLS_PER_MINUTE) {
      spent.push(at);
      return;
    }
    const wait = WINDOW_MS - (at - spent[0]) + 25;
    await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 5_000)));
  }
}

/** Tests only: forget the calls spent so far. */
export function resetFinnhubRateLimit(): void {
  spent.length = 0;
}

type Params = Record<string, string | number>;

/** One GET, or null. Failure is quiet: Finance falls back to "—", never an error page. */
async function get<T>(path: string, params: Params, key: string): Promise<T | null> {
  await waitForSlot();
  const url = new URL(`${BASE}${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
  url.searchParams.set("token", key);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!response.ok) {
      // The path only: the query holds the key.
      logger.warn(`[finance] finnhub ${path} answered ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    logger.warn(`[finance] finnhub ${path} failed`, error instanceof Error ? error.name : "unknown");
    return null;
  }
}

type SearchItem = { description: string; displaySymbol: string; symbol: string; type: string };

/** Finnhub's types that are a US-listed stock or ETF we can offer. */
function matchOf(item: SearchItem): TickerMatch | null {
  // "AAPL.MX", "AAPL.SW": a listing somewhere else, not the US one.
  if (item.symbol.includes(".") || item.symbol.includes("/")) return null;
  const type: FinanceTickerType | null = item.type === "ETP" ? "etf" : item.type === "Common Stock" ? "stock" : null;
  if (!type) return null;
  const symbol = item.symbol.trim().toUpperCase();
  if (!symbol) return null;
  return { symbol, name: item.description.trim(), exchange: null, type };
}

type Quote = { c: number; d: number | null; dp: number | null; pc: number; t: number };
type NewsItem = { category: string; datetime: number; headline: string; url: string };
type EarningsCalendar = { earningsCalendar?: { date: string; symbol: string }[] };

/** "YYYY-MM-DD", US Eastern. */
function easternDate(at: Date): string {
  return eastern(at).date;
}

function percentChange(close: number, previousClose: number | null | undefined): number | null {
  if (previousClose == null || !(previousClose > 0) || !Number.isFinite(close)) return null;
  return Math.round(((close - previousClose) / previousClose) * 10_000) / 100;
}

/** What agents and the pages see, backed by Finnhub. */
export function finnhubMarketData(key: string): MarketData {
  return {
    name: "finnhub",
    hasPrices: true,

    async search(query, limit = 8) {
      const found = await get<{ result?: SearchItem[] }>("/search", { q: query, exchange: "US" }, key);
      const matches = (found?.result ?? []).map(matchOf).filter((m): m is TickerMatch => m !== null);
      // An exact symbol first, then the rest as Finnhub ranked them.
      const wanted = query.trim().toUpperCase();
      return matches.sort((a, b) => Number(b.symbol === wanted) - Number(a.symbol === wanted)).slice(0, limit);
    },

    async lookup(symbol) {
      const found = await get<{ result?: SearchItem[] }>("/search", { q: symbol, exchange: "US" }, key);
      const exact = (found?.result ?? []).find((item) => item.symbol.trim().toUpperCase() === symbol.trim().toUpperCase());
      if (!exact) return null;
      const match = matchOf(exact);
      if (!match) return null;
      const profile = await get<{ finnhubIndustry?: string }>("/stock/profile2", { symbol }, key);
      return profile?.finnhubIndustry ? { ...match, industry: profile.finnhubIndustry } : match;
    },

    /** The latest quote. Finnhub's daily candles are a paid feature, so this is the bar. */
    async latestBar(symbol) {
      const quote = await get<Quote>("/quote", { symbol }, key);
      if (!quote || !(quote.c > 0)) return null;
      const at = quote.t ? new Date(quote.t * 1000) : new Date();
      const bar: DailyBar = {
        date: easternDate(at),
        close: quote.c,
        changePct: typeof quote.dp === "number" ? quote.dp : (percentChange(quote.c, quote.pc) ?? 0),
      };
      return bar;
    },

    async headlines(symbol, since) {
      const to = easternDate(new Date());
      const from = easternDate(since);
      const [news, earnings] = await Promise.all([
        get<NewsItem[]>("/company-news", { symbol, from, to }, key),
        get<EarningsCalendar>("/calendar/earnings", { symbol, from, to }, key),
      ]);
      const out: Headline[] = [];
      for (const item of news ?? []) {
        if (!item.headline || !/^https?:\/\//.test(item.url ?? "")) continue;
        out.push({ title: item.headline, url: item.url, publishedAt: new Date(item.datetime * 1000).toISOString(), kind: "news" });
      }
      for (const day of earnings?.earningsCalendar ?? []) {
        out.push({
          title: `${symbol} reports earnings on ${day.date}`,
          // The filing itself, so an agent's source is the company's own document.
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(symbol)}&type=8-K&dateb=&owner=include&count=40`,
          publishedAt: new Date(`${day.date}T12:00:00Z`).toISOString(),
          kind: "earnings",
        });
      }
      return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 20);
    },
  };
}

/**
 * Finnhub's free company profile, the one data API Finance uses for code
 * checks (FIN-D-029). The key is a secret: it is read from the environment,
 * never logged, and never returned to a caller.
 *
 * With no key, or when the free tier does not answer, the profile is null and
 * the caller records the check as `unavailable` — never as a failed match.
 */
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

  const baseUrl = process.env.FINNHUB_API_URL?.trim() || BASE;
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
