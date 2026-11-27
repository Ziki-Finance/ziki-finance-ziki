import { afterEach, describe, expect, it, vi } from "vitest";
import { FINNHUB_CALLS_PER_MINUTE, finnhubApiKey, finnhubMarketData, resetFinnhubRateLimit, waitForSlot } from "@/lib/finance/finnhub";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  resetFinnhubRateLimit();
});

describe("the Finnhub key (FIN-D-021)", () => {
  it("is read from the environment, trimmed, and null when unset", () => {
    vi.stubEnv("FINNHUB_API_KEY", "  sk_test_123  ");
    expect(finnhubApiKey()).toBe("sk_test_123");
    vi.stubEnv("FINNHUB_API_KEY", "");
    expect(finnhubApiKey()).toBeNull();
    vi.stubEnv("FINNHUB_API_KEY", undefined as never);
    expect(finnhubApiKey()).toBeNull();
  });
});

describe("staying under the free plan's limit", () => {
  it("lets calls through until the limit, then waits for the window to roll", async () => {
    vi.useFakeTimers();
    let now = 0;
    const clock = () => now;
    for (let i = 0; i < FINNHUB_CALLS_PER_MINUTE; i++) await waitForSlot(clock);
    let waited = false;
    const slot = waitForSlot(clock).then(() => (waited = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(waited).toBe(false); // the window is full
    now = 60_001; // a minute and a bit later, the first call falls out of the window
    await vi.advanceTimersByTimeAsync(5_000); // its own wait caps at 5s and tries again
    await slot;
    expect(waited).toBe(true);
  });
});

describe("Finnhub as the market data provider (FIN-CR-006, idea 18)", () => {
  it("has prices, and is named for the staff page", () => {
    const data = finnhubMarketData("key");
    expect(data.name).toBe("finnhub");
    expect(data.hasPrices).toBe(true);
  });

  it("keeps only US common stocks and ETPs from search, an exact symbol first", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      jsonResponse({
        result: [
          { description: "Apple Inc", displaySymbol: "AAPL", symbol: "AAPL", type: "Common Stock" },
          { description: "Apple (Mexico)", displaySymbol: "AAPL.MX", symbol: "AAPL.MX", type: "Common Stock" },
          { description: "Appliance Co", displaySymbol: "APLE", symbol: "APLE", type: "Common Stock" },
          { description: "A Preferred Fund", displaySymbol: "AFUND", symbol: "AFUND", type: "Preferred Stock" },
          { description: "A Trust ETP", displaySymbol: "AETP", symbol: "AETP", type: "ETP" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const matches = await finnhubMarketData("key").search("aapl", 8);
    expect(matches.map((m) => m.symbol)).toEqual(["AAPL", "APLE", "AETP"]);
    expect(matches[0]).toEqual({ symbol: "AAPL", name: "Apple Inc", exchange: null, type: "stock" });
    expect(matches[2]).toMatchObject({ type: "etf" });
    const url = new URL(fetchMock.mock.calls[0][0] as string | URL);
    expect(url.pathname).toBe("/api/v1/search");
    expect(url.searchParams.get("q")).toBe("aapl");
    expect(url.searchParams.get("exchange")).toBe("US");
    expect(url.searchParams.get("token")).toBe("key");
  });

  it("looks a symbol up by an exact, case-insensitive match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() =>
        jsonResponse({
          result: [
            { description: "Apple Inc", displaySymbol: "AAPL", symbol: "AAPL", type: "Common Stock" },
            { description: "Apple-ish", displaySymbol: "AAPLX", symbol: "AAPLX", type: "Common Stock" },
          ],
        }),
      ),
    );
    expect(await finnhubMarketData("key").lookup("aapl")).toEqual({ symbol: "AAPL", name: "Apple Inc", exchange: null, type: "stock" });
    expect(await finnhubMarketData("key").lookup("nope")).toBeNull();
  });

  it("uses the quote, not the paid daily candles, with Finnhub's own percent change", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(() => jsonResponse({ c: 230.5, d: 2.5, dp: 1.1, pc: 228, t: Math.floor(Date.UTC(2026, 10, 16, 21, 0, 0) / 1000) })));
    const bar = await finnhubMarketData("key").latestBar("AAPL");
    expect(bar).toEqual({ date: "2026-11-16", close: 230.5, changePct: 1.1 });
  });

  it("works out the percent change itself when Finnhub omits it", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(() => jsonResponse({ c: 110, d: null, dp: null, pc: 100, t: 0 })));
    const bar = await finnhubMarketData("key").latestBar("TEST");
    expect(bar?.changePct).toBe(10);
  });

  it("has no bar when the quote is missing or the price is zero", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(() => jsonResponse({ c: 0, d: null, dp: null, pc: null, t: 0 })));
    expect(await finnhubMarketData("key").latestBar("TEST")).toBeNull();
  });

  it("fails quietly on a bad response: no price, never a thrown error", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(() => jsonResponse({ error: "no" }, 403)));
    expect(await finnhubMarketData("key").latestBar("TEST")).toBeNull();
    expect(await finnhubMarketData("key").search("x")).toEqual([]);
  });

  it("fails quietly on a network error too", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(() => Promise.reject(new Error("network down"))));
    expect(await finnhubMarketData("key").latestBar("TEST")).toBeNull();
  });

  it("gathers news and earnings as headlines, newest first, dropping anything without a real link", async () => {
    const fetchMock = vi.fn<typeof fetch>((url) => {
      const u = String(url);
      if (u.includes("/company-news")) {
        return jsonResponse([
          { category: "company", datetime: Date.UTC(2026, 10, 10, 12, 0, 0) / 1000, headline: "Acme wins contract", url: "https://news.example/1" },
          { category: "company", datetime: Date.UTC(2026, 10, 11, 12, 0, 0) / 1000, headline: "No link", url: "" },
        ]);
      }
      return jsonResponse({ earningsCalendar: [{ date: "2026-11-12", symbol: "ACME" }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const headlines = await finnhubMarketData("key").headlines("ACME", new Date("2026-11-01T00:00:00Z"));
    expect(headlines).toHaveLength(2);
    expect(headlines[0]).toMatchObject({ kind: "earnings", title: "ACME reports earnings on 2026-11-12" });
    expect(headlines[0].url).toMatch(/^https:\/\/www\.sec\.gov\//);
    expect(headlines[1]).toMatchObject({ kind: "news", title: "Acme wins contract", url: "https://news.example/1" });
  });
});
