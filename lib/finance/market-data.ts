import type { FinanceTickerType } from "@prisma/client";
import { directoryEntry, searchDirectory } from "./directory";
import { finnhubApiKey, finnhubMarketData } from "./finnhub";

/**
 * The one place Ziki Finance talks to market data (FIN-D-013).
 *
 * During testing the provider is Finnhub's free plan (FIN-CR-006, idea 18,
 * FIN-D-021), used only through `finnhub.ts`. With no `FINNHUB_API_KEY` the
 * built-in directory answers search and there are no prices, so pages show
 * "—" and nothing breaks. Changing provider before launch means implementing
 * `MarketData` for it and returning it from `marketData()`.
 */

export type TickerMatch = {
  symbol: string;
  name: string;
  exchange: string | null;
  type: FinanceTickerType;
  industry?: string | null;
  logoUrl?: string | null;
};

export type DailyBar = {
  /** The trading day, "YYYY-MM-DD" (US Eastern). */
  date: string;
  close: number;
  /** Change from the previous close, in percent. */
  changePct: number;
};

export type Headline = { title: string; url: string; publishedAt: string; kind: "news" | "filing" | "earnings" };

export interface MarketData {
  /** A short name for logs and the staff page, e.g. "directory" or "polygon". */
  readonly name: string;
  /** Whether it has prices. False for the built-in directory. */
  readonly hasPrices: boolean;
  search(query: string, limit?: number): Promise<TickerMatch[]>;
  /** One ticker by its exact symbol; null when it isn't a US-listed stock or ETF it knows. */
  lookup(symbol: string): Promise<TickerMatch | null>;
  /** The latest end-of-day bar; null without prices. */
  latestBar(symbol: string): Promise<DailyBar | null>;
  /** News, filings and earnings headlines since a time (links and titles only). */
  headlines(symbol: string, since: Date): Promise<Headline[]>;
}

/** The built-in list: search and names, no prices, no headlines. */
export const directoryMarketData: MarketData = {
  name: "directory",
  hasPrices: false,
  async search(query, limit) {
    return searchDirectory(query, limit).map(({ symbol, name, exchange, type }) => ({ symbol, name, exchange, type }));
  },
  async lookup(symbol) {
    const entry = directoryEntry(symbol);
    return entry ? { symbol: entry.symbol, name: entry.name, exchange: entry.exchange, type: entry.type } : null;
  },
  async latestBar() {
    return null;
  },
  async headlines() {
    return [];
  },
};

let override: MarketData | null = null;

/** The market data in use: Finnhub when its key is set, otherwise the directory. */
export function marketData(): MarketData {
  if (override) return override;
  const key = finnhubApiKey();
  return key ? finnhubMarketData(key) : directoryMarketData;
}

/** Tests only: use another provider, or `null` to go back. */
export function setMarketDataForTests(provider: MarketData | null): void {
  override = provider;
}
