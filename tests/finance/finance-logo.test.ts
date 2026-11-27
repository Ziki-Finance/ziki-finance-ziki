import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alternativeLogoUrl,
  resolveTickerLogoUrl,
} from "@/lib/finance/logo";
import {
  setMarketDataForTests,
  type MarketData,
} from "@/lib/finance/market-data";

describe("Swappable ticker logo resolution", () => {
  afterEach(() => {
    setMarketDataForTests(null);
    delete process.env.FINANCE_LOGO_URL_TEMPLATE;
  });

  it("uses logoUrl from the active MarketData provider when available", async () => {
    const customProvider: MarketData = {
      name: "finnhub",
      hasPrices: true,
      search: vi.fn(async () => []),
      lookup: vi.fn(async () => ({
        symbol: "MSFT",
        name: "Microsoft",
        exchange: "NASDAQ",
        type: "stock" as const,
        logoUrl: "https://static2.finnhub.io/file/msft.png",
      })),
      latestBar: vi.fn(async () => null),
      headlines: vi.fn(async () => []),
    };
    setMarketDataForTests(customProvider);

    const url = await resolveTickerLogoUrl("MSFT");
    expect(url).toBe("https://static2.finnhub.io/file/msft.png");
  });

  it("falls back to the alternative logo URL when MarketData has no logoUrl", async () => {
    const customProvider: MarketData = {
      name: "polygon",
      hasPrices: true,
      search: vi.fn(async () => []),
      lookup: vi.fn(async () => ({
        symbol: "AAPL",
        name: "Apple",
        exchange: "NASDAQ",
        type: "stock" as const,
      })),
      latestBar: vi.fn(async () => null),
      headlines: vi.fn(async () => []),
    };
    setMarketDataForTests(customProvider);

    const url = await resolveTickerLogoUrl("AAPL");
    expect(url).toBe("https://assets.parqet.com/logos/symbol/AAPL?format=png");
  });

  it("supports overriding the alternative logo provider via FINANCE_LOGO_URL_TEMPLATE", () => {
    process.env.FINANCE_LOGO_URL_TEMPLATE =
      "https://example.com/logos/{SYMBOL}.svg";
    expect(alternativeLogoUrl("BRK.B")).toBe(
      "https://example.com/logos/BRK.B.svg",
    );
  });
});
