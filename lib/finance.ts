import type { FinanceHorizon, FinanceRiskComfort, FinanceTickerType } from "@prisma/client";

/**
 * Shared words for Ziki Finance (docs/plans/finance-prd.md). Plain data with no
 * server imports, so pages, actions and API routes use the same names.
 *
 * v1 is a hidden route (FIN-D-011): nothing on Ziki links to /finance.
 */

export const FINANCE_PATH = "/finance";

/** The notice every person accepts once, before anything else (PRD §6.2, §10). */
export const FINANCE_NOTICE =
  "Ziki Finance shares research from AI agents. It is not personal financial advice. You make your own decisions, and investing can lose money.";

/** The line in the footer of every Finance page, briefing and alert. */
export const FINANCE_FOOTER = "Research from AI agents, not financial advice. Past results don't promise future ones.";

/** Days of free trial from setup (PRD §8, FIN-D-007). */
export const FINANCE_TRIAL_DAYS = 7;

export const RISK_COMFORTS = ["careful", "balanced", "adventurous"] as const satisfies readonly FinanceRiskComfort[];
export const HORIZONS = ["lt1", "y1to5", "gt5"] as const satisfies readonly FinanceHorizon[];

export const RISK_LABEL: Record<FinanceRiskComfort, string> = {
  careful: "Careful",
  balanced: "Balanced",
  adventurous: "Adventurous",
};

export const HORIZON_LABEL: Record<FinanceHorizon, string> = {
  lt1: "Within 1 year",
  y1to5: "1–5 years",
  gt5: "5+ years",
};

/** "Balanced, 5+ years": the profile in a few words. */
export function profileWords(profile: { riskComfort: FinanceRiskComfort; horizon: FinanceHorizon }): string {
  const horizon = { lt1: "within 1 year", y1to5: "1–5 years", gt5: "5+ years" }[profile.horizon];
  return `${RISK_LABEL[profile.riskComfort]}, ${horizon}`;
}

/** "+1.2%" or "-0.8%", to one decimal. */
export function signedPercent(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

/** "$41.20". */
export function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** "17 Nov 2026" for a date, in the reader's own terms. */
export function dayWords(at: Date): string {
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const TICKER_TYPE_LABEL: Record<FinanceTickerType, string> = { stock: "Stock", etf: "ETF" };

/** US tickers: 1–5 letters, optionally a class suffix ("BRK.B", "BF-B"). */
const SYMBOL_RE = /^[A-Z]{1,5}([.-][A-Z]{1,2})?$/;

/** "brk-b " → "BRK.B"; null when it can't be a US ticker. */
export function normalizeSymbol(input: string): string | null {
  const s = input.trim().toUpperCase().replace(/-/g, ".");
  return SYMBOL_RE.test(s) ? s : null;
}

/** The URL of a holding's page. */
export function tickerPath(symbol: string): string {
  return `${FINANCE_PATH}/${encodeURIComponent(symbol)}`;
}

/** Largest share count accepted, to keep typos like 1e12 out. */
export const MAX_SHARES = 100_000_000;

export type SharesParse = { ok: true; shares: number | null } | { ok: false; error: string };

/** Empty = watch only. Otherwise a positive number, up to 6 decimals. */
export function parseShares(raw: string | null | undefined): SharesParse {
  const s = (raw ?? "").trim().replace(/,/g, "");
  if (!s) return { ok: true, shares: null };
  if (!/^\d+(\.\d{1,6})?$/.test(s)) return { ok: false, error: "Shares must be a positive number, or left empty to just watch." };
  const n = Number(s);
  if (!(n > 0)) return { ok: false, error: "Shares must be more than 0, or left empty to just watch." };
  if (n > MAX_SHARES) return { ok: false, error: "That's more shares than we can take. Check the number." };
  return { ok: true, shares: n };
}

export type PriceParse = { ok: true; price: number | null } | { ok: false; error: string };

/** The optional average price paid, in US dollars. */
export function parseAvgCost(raw: string | null | undefined): PriceParse {
  const s = (raw ?? "").trim().replace(/[$,]/g, "");
  if (!s) return { ok: true, price: null };
  if (!/^\d+(\.\d{1,4})?$/.test(s)) return { ok: false, error: "The price paid must be a number, like 41.20." };
  const n = Number(s);
  if (!(n > 0) || n > 10_000_000) return { ok: false, error: "The price paid must be a number above 0." };
  return { ok: true, price: n };
}

/** "10", "2.5", or "watching". */
export function sharesWords(shares: { toString(): string } | number | null): string {
  if (shares === null) return "watching";
  const n = Number(shares.toString());
  return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/** A valid IANA time zone, or the default (US Eastern). */
export function safeTimezone(raw: string | null | undefined): string {
  const tz = (raw ?? "").trim();
  if (!tz || tz.length > 64) return "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "America/New_York";
  }
}

/** A person may use Finance once they've accepted the notice and answered the two questions. */
export function isSetUp(profile: { noticeAcceptedAt: Date | null } | null): boolean {
  return Boolean(profile?.noticeAcceptedAt);
}

/** The agents' view as a chip: "Keep" for a stock you own, "Buy" for one you watch. */
export function callLabel(call: "buy_keep" | "consider_selling" | "sell", owned: boolean): string {
  if (call === "buy_keep") return owned ? "Keep" : "Buy";
  return call === "sell" ? "Sell" : "Consider selling";
}

export const RISK_LEVEL_LABEL: Record<"low" | "medium" | "high", string> = { low: "Low", medium: "Medium", high: "High" };

/** "4 of 5 agents agree". */
export function agreementWords(view: { agentsAgree: number; agentsTotal: number }): string {
  return `${view.agentsAgree} of ${view.agentsTotal} agents agree`;
}

/** Site-wide finance clearance (FIN-D-005), like `isSecurityCleared`. */
export function isFinanceCleared(person: { financeClearedAt: Date | null }): boolean {
  return person.financeClearedAt !== null;
}
