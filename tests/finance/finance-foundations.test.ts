import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ default: () => ({ auth: (handler: unknown) => handler }) }));
vi.mock("@/auth.config", () => ({ default: {} }));
import { isPublicPath } from "@/middleware";
import { isReservedProjectSlug } from "@/lib/project-slug";
import { isFinanceCleared, normalizeSymbol, parseAvgCost, parseShares, profileWords, safeTimezone, sharesWords, tickerPath } from "@/lib/finance";
import { searchDirectory } from "@/lib/finance/directory";
import { directoryMarketData } from "@/lib/finance/market-data";

/** Every source file under a folder, skipping tests. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("Ziki Finance is an unlisted route (FIN-D-011, PRD v3)", () => {
  it("needs a signed-in person: neither it nor a stock page is public", () => {
    // v3 (FIN-CR-013) makes Finance one owner's tool, so a signed-out visitor
    // is sent to sign in instead of seeing the v1 portfolio page.
    expect(isPublicPath("/finance")).toBe(false);
    expect(isPublicPath("/finance/AAPL")).toBe(false);
    expect(isPublicPath("/finances")).toBe(false);
  });

  it("reserves the name so no organisation or project can take /finance", () => {
    expect(isReservedProjectSlug("finance")).toBe(true);
  });

  it("has no link to /finance outside Finance's own files, staff pages and email/inbox links", () => {
    // Finance's own files, the staff pages, the routing (middleware, app layout) may name it.
    const allowed = /([\\/]finance[\\/])|([\\/]finance(-[a-z]+)?\.ts$)|([\\/]superadmin[\\/])|(^middleware\.ts$)|(app[\\/]\(app\)[\\/]layout\.tsx$)/;
    const offenders = [...sources("app"), ...sources("components"), ...sources("lib")]
      .filter((path) => !allowed.test(path))
      .filter((path) => /["'`]\/finance(["'`/?#])/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
    }, 60_000);

  it("is left out of the sitemap and robots.txt", () => {
    expect(readFileSync("app/sitemap.xml/route.ts", "utf8")).not.toMatch(/finance/i);
    expect(readFileSync("app/robots.ts", "utf8")).not.toMatch(/finance/i);
  });

  it("tells search engines not to list it", () => {
    expect(readFileSync("app/(app)/finance/layout.tsx", "utf8")).toMatch(/index: false/);
  });
});

describe("Finance words", () => {
  it("normalises US tickers and rejects anything else", () => {
    expect(normalizeSymbol(" aapl ")).toBe("AAPL");
    expect(normalizeSymbol("brk-b")).toBe("BRK.B");
    expect(normalizeSymbol("BRK.B")).toBe("BRK.B");
    expect(normalizeSymbol("TOOLONG")).toBeNull();
    expect(normalizeSymbol("12AB")).toBeNull();
    expect(normalizeSymbol("")).toBeNull();
    expect(tickerPath("BRK.B")).toBe("/finance/BRK.B");
  });

  it("takes shares as a positive number, or empty to watch", () => {
    expect(parseShares("")).toEqual({ ok: true, shares: null });
    expect(parseShares("  ")).toEqual({ ok: true, shares: null });
    expect(parseShares("10")).toEqual({ ok: true, shares: 10 });
    expect(parseShares("1,250.5")).toEqual({ ok: true, shares: 1250.5 });
    expect(parseShares("0").ok).toBe(false);
    expect(parseShares("-3").ok).toBe(false);
    expect(parseShares("abc").ok).toBe(false);
    expect(parseShares("1e9").ok).toBe(false);
    expect(parseShares("200000000").ok).toBe(false);
  });

  it("takes an optional average price", () => {
    expect(parseAvgCost("")).toEqual({ ok: true, price: null });
    expect(parseAvgCost("$41.20")).toEqual({ ok: true, price: 41.2 });
    expect(parseAvgCost("0").ok).toBe(false);
    expect(parseAvgCost("x").ok).toBe(false);
  });

  it("says shares and the profile in plain words", () => {
    expect(sharesWords(null)).toBe("watching");
    expect(sharesWords(10)).toBe("10");
    expect(sharesWords({ toString: () => "2.5" })).toBe("2.5");
    expect(profileWords({ riskComfort: "balanced", horizon: "gt5" })).toBe("Balanced, 5+ years");
  });

  it("keeps a real time zone and falls back to US Eastern", () => {
    expect(safeTimezone("Africa/Lagos")).toBe("Africa/Lagos");
    expect(safeTimezone("Not/AZone")).toBe("America/New_York");
    expect(safeTimezone(undefined)).toBe("America/New_York");
  });

  it("treats clearance like security clearance", () => {
    expect(isFinanceCleared({ financeClearedAt: null })).toBe(false);
    expect(isFinanceCleared({ financeClearedAt: new Date() })).toBe(true);
  });
});

describe("ticker search before a data provider is chosen (FIN-D-013)", () => {
  it("finds by exact ticker first, then prefix, then company name", () => {
    expect(searchDirectory("v")[0]?.symbol).toBe("V");
    expect(searchDirectory("appl").map((e) => e.symbol)).toContain("AAPL");
    expect(searchDirectory("apple")[0]?.symbol).toBe("AAPL");
    expect(searchDirectory("vanguard").every((e) => e.name.includes("Vanguard"))).toBe(true);
    expect(searchDirectory("")).toEqual([]);
  });

  it("looks up a symbol and has no prices", async () => {
    expect(await directoryMarketData.lookup("VOO")).toMatchObject({ symbol: "VOO", type: "etf" });
    expect(await directoryMarketData.lookup("ZZZZ")).toBeNull();
    expect(directoryMarketData.hasPrices).toBe(false);
    expect(await directoryMarketData.latestBar("AAPL")).toBeNull();
  });
});
