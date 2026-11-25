import type { FinanceTickerType } from "@prisma/client";

/**
 * A built-in list of well-known US-listed stocks and ETFs (FIN-D-013).
 *
 * Ticker search uses it until a market-data provider is chosen (PRD §9.3).
 * It holds only public facts (symbol, company name, exchange, type) and no
 * prices. When a provider is wired into `lib/finance/market-data.ts`, its
 * search replaces this list; this file can then go.
 */
export type DirectoryEntry = { symbol: string; name: string; exchange: "NASDAQ" | "NYSE" | "NYSE Arca" | "Cboe"; type: FinanceTickerType };

const s = (symbol: string, name: string, exchange: DirectoryEntry["exchange"]): DirectoryEntry => ({ symbol, name, exchange, type: "stock" });
const e = (symbol: string, name: string, exchange: DirectoryEntry["exchange"] = "NYSE Arca"): DirectoryEntry => ({ symbol, name, exchange, type: "etf" });

export const TICKER_DIRECTORY: readonly DirectoryEntry[] = [
  s("AAPL", "Apple", "NASDAQ"),
  s("MSFT", "Microsoft", "NASDAQ"),
  s("NVDA", "NVIDIA", "NASDAQ"),
  s("AMZN", "Amazon", "NASDAQ"),
  s("GOOGL", "Alphabet (Class A)", "NASDAQ"),
  s("GOOG", "Alphabet (Class C)", "NASDAQ"),
  s("META", "Meta Platforms", "NASDAQ"),
  s("TSLA", "Tesla", "NASDAQ"),
  s("BRK.B", "Berkshire Hathaway (Class B)", "NYSE"),
  s("AVGO", "Broadcom", "NASDAQ"),
  s("JPM", "JPMorgan Chase", "NYSE"),
  s("LLY", "Eli Lilly", "NYSE"),
  s("V", "Visa", "NYSE"),
  s("MA", "Mastercard", "NYSE"),
  s("UNH", "UnitedHealth Group", "NYSE"),
  s("XOM", "Exxon Mobil", "NYSE"),
  s("CVX", "Chevron", "NYSE"),
  s("JNJ", "Johnson & Johnson", "NYSE"),
  s("WMT", "Walmart", "NYSE"),
  s("PG", "Procter & Gamble", "NYSE"),
  s("HD", "Home Depot", "NYSE"),
  s("COST", "Costco", "NASDAQ"),
  s("ABBV", "AbbVie", "NYSE"),
  s("MRK", "Merck", "NYSE"),
  s("PFE", "Pfizer", "NYSE"),
  s("KO", "Coca-Cola", "NYSE"),
  s("PEP", "PepsiCo", "NASDAQ"),
  s("BAC", "Bank of America", "NYSE"),
  s("WFC", "Wells Fargo", "NYSE"),
  s("C", "Citigroup", "NYSE"),
  s("GS", "Goldman Sachs", "NYSE"),
  s("MS", "Morgan Stanley", "NYSE"),
  s("AXP", "American Express", "NYSE"),
  s("ORCL", "Oracle", "NYSE"),
  s("CRM", "Salesforce", "NYSE"),
  s("ADBE", "Adobe", "NASDAQ"),
  s("AMD", "Advanced Micro Devices", "NASDAQ"),
  s("INTC", "Intel", "NASDAQ"),
  s("QCOM", "Qualcomm", "NASDAQ"),
  s("TXN", "Texas Instruments", "NASDAQ"),
  s("CSCO", "Cisco Systems", "NASDAQ"),
  s("IBM", "IBM", "NYSE"),
  s("NFLX", "Netflix", "NASDAQ"),
  s("DIS", "Walt Disney", "NYSE"),
  s("CMCSA", "Comcast", "NASDAQ"),
  s("T", "AT&T", "NYSE"),
  s("VZ", "Verizon", "NYSE"),
  s("TMUS", "T-Mobile US", "NASDAQ"),
  s("MCD", "McDonald's", "NYSE"),
  s("SBUX", "Starbucks", "NASDAQ"),
  s("NKE", "Nike", "NYSE"),
  s("LOW", "Lowe's", "NYSE"),
  s("TGT", "Target", "NYSE"),
  s("BA", "Boeing", "NYSE"),
  s("CAT", "Caterpillar", "NYSE"),
  s("DE", "Deere & Company", "NYSE"),
  s("GE", "GE Aerospace", "NYSE"),
  s("HON", "Honeywell", "NASDAQ"),
  s("LMT", "Lockheed Martin", "NYSE"),
  s("RTX", "RTX", "NYSE"),
  s("UPS", "United Parcel Service", "NYSE"),
  s("FDX", "FedEx", "NYSE"),
  s("UBER", "Uber Technologies", "NYSE"),
  s("ABNB", "Airbnb", "NASDAQ"),
  s("PYPL", "PayPal", "NASDAQ"),
  s("SHOP", "Shopify", "NYSE"),
  s("SQ", "Block", "NYSE"),
  s("PLTR", "Palantir Technologies", "NASDAQ"),
  s("SNOW", "Snowflake", "NYSE"),
  s("NOW", "ServiceNow", "NYSE"),
  s("INTU", "Intuit", "NASDAQ"),
  s("AMAT", "Applied Materials", "NASDAQ"),
  s("MU", "Micron Technology", "NASDAQ"),
  s("ASML", "ASML Holding", "NASDAQ"),
  s("TSM", "Taiwan Semiconductor (ADR)", "NYSE"),
  s("BABA", "Alibaba Group (ADR)", "NYSE"),
  s("TM", "Toyota Motor (ADR)", "NYSE"),
  s("F", "Ford Motor", "NYSE"),
  s("GM", "General Motors", "NYSE"),
  s("RIVN", "Rivian Automotive", "NASDAQ"),
  s("TMO", "Thermo Fisher Scientific", "NYSE"),
  s("ABT", "Abbott Laboratories", "NYSE"),
  s("AMGN", "Amgen", "NASDAQ"),
  s("GILD", "Gilead Sciences", "NASDAQ"),
  s("BMY", "Bristol-Myers Squibb", "NYSE"),
  s("CVS", "CVS Health", "NYSE"),
  s("MRNA", "Moderna", "NASDAQ"),
  s("NVO", "Novo Nordisk (ADR)", "NYSE"),
  s("PM", "Philip Morris International", "NYSE"),
  s("MO", "Altria Group", "NYSE"),
  s("MDLZ", "Mondelez International", "NASDAQ"),
  s("CL", "Colgate-Palmolive", "NYSE"),
  s("NEE", "NextEra Energy", "NYSE"),
  s("DUK", "Duke Energy", "NYSE"),
  s("SO", "Southern Company", "NYSE"),
  s("COP", "ConocoPhillips", "NYSE"),
  s("O", "Realty Income", "NYSE"),
  s("PLD", "Prologis", "NYSE"),
  s("AMT", "American Tower", "NYSE"),
  s("SPGI", "S&P Global", "NYSE"),
  s("BLK", "BlackRock", "NYSE"),
  s("SCHW", "Charles Schwab", "NYSE"),
  s("COIN", "Coinbase Global", "NASDAQ"),
  s("HOOD", "Robinhood Markets", "NASDAQ"),
  s("SPOT", "Spotify Technology", "NYSE"),
  s("ZM", "Zoom Communications", "NASDAQ"),
  s("DELL", "Dell Technologies", "NYSE"),
  s("HPQ", "HP Inc.", "NYSE"),
  s("ARM", "Arm Holdings (ADR)", "NASDAQ"),
  s("SMCI", "Super Micro Computer", "NASDAQ"),
  e("SPY", "SPDR S&P 500 ETF Trust"),
  e("VOO", "Vanguard S&P 500 ETF"),
  e("IVV", "iShares Core S&P 500 ETF"),
  e("VTI", "Vanguard Total Stock Market ETF"),
  e("QQQ", "Invesco QQQ Trust (Nasdaq-100)", "NASDAQ"),
  e("DIA", "SPDR Dow Jones Industrial Average ETF"),
  e("IWM", "iShares Russell 2000 ETF"),
  e("VEA", "Vanguard FTSE Developed Markets ETF"),
  e("VWO", "Vanguard FTSE Emerging Markets ETF"),
  e("VXUS", "Vanguard Total International Stock ETF", "NASDAQ"),
  e("SCHD", "Schwab US Dividend Equity ETF"),
  e("VIG", "Vanguard Dividend Appreciation ETF"),
  e("VYM", "Vanguard High Dividend Yield ETF"),
  e("BND", "Vanguard Total Bond Market ETF", "NASDAQ"),
  e("AGG", "iShares Core US Aggregate Bond ETF"),
  e("TLT", "iShares 20+ Year Treasury Bond ETF", "NASDAQ"),
  e("GLD", "SPDR Gold Shares"),
  e("XLK", "Technology Select Sector SPDR Fund"),
  e("XLF", "Financial Select Sector SPDR Fund"),
  e("XLE", "Energy Select Sector SPDR Fund"),
  e("XLV", "Health Care Select Sector SPDR Fund"),
  e("VGT", "Vanguard Information Technology ETF"),
  e("ARKK", "ARK Innovation ETF"),
];

const BY_SYMBOL = new Map(TICKER_DIRECTORY.map((entry) => [entry.symbol, entry]));

export function directoryEntry(symbol: string): DirectoryEntry | null {
  return BY_SYMBOL.get(symbol) ?? null;
}

/**
 * Up to `limit` matches for what the person typed: an exact ticker first, then
 * tickers that start with it, then company names that contain it.
 */
export function searchDirectory(query: string, limit = 8): DirectoryEntry[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const exact: DirectoryEntry[] = [];
  const prefix: DirectoryEntry[] = [];
  const named: DirectoryEntry[] = [];
  for (const entry of TICKER_DIRECTORY) {
    if (entry.symbol === q) exact.push(entry);
    else if (entry.symbol.startsWith(q)) prefix.push(entry);
    else if (q.length >= 2 && entry.name.toUpperCase().includes(q)) named.push(entry);
  }
  return [...exact, ...prefix, ...named].slice(0, limit);
}
