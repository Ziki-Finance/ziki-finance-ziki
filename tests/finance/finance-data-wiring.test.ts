import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_STOCK_ITEMS } from "@/lib/finance/demo-stocks";

const {
  mockRequireFinanceOwner,
  mockPortfolioForOwner,
  mockCandidateForTicker,
  mockDecisionFindFirst,
  mockSnapshotFindFirst,
} = vi.hoisted(() => ({
  mockRequireFinanceOwner: vi.fn(),
  mockPortfolioForOwner: vi.fn(),
  mockCandidateForTicker: vi.fn(),
  mockDecisionFindFirst: vi.fn(),
  mockSnapshotFindFirst: vi.fn(),
}));

vi.mock("@/lib/finance/owner", () => ({
  requireFinanceOwner: mockRequireFinanceOwner,
  isFinanceOwner: (u: { role?: string; isRealSuperAdmin?: boolean }) =>
    u?.isRealSuperAdmin === true || u?.role === "super_admin",
}));

vi.mock("@/lib/finance/portfolio", () => ({
  portfolioForOwner: mockPortfolioForOwner,
}));

vi.mock("@/lib/finance/pipeline", async () => {
  const actual = await vi.importActual<typeof import("@/lib/finance/pipeline")>(
    "@/lib/finance/pipeline",
  );
  return {
    ...actual,
    candidateForTicker: mockCandidateForTicker,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    financeDecision: { findFirst: mockDecisionFindFirst },
    financeSnapshot: { findFirst: mockSnapshotFindFirst },
  },
}));

import { GET } from "@/app/api/finance/ticker/[symbol]/route";

describe("FIN-DATA-CR-001: ResearchStockItem demo enrichment", () => {
  it("provides latestPrice, buyRange, and position fields on every demo item", () => {
    expect(DEMO_STOCK_ITEMS.length).toBeGreaterThan(0);
    for (const item of DEMO_STOCK_ITEMS) {
      expect(typeof item.latestPrice === "number" || item.latestPrice === null).toBe(true);
      expect(typeof item.buyRange === "string" || item.buyRange === null).toBe(true);
      expect(item.position).toBeNull();
    }
    const msft = DEMO_STOCK_ITEMS.find((i) => i.symbol === "MSFT");
    expect(msft).toMatchObject({
      latestPrice: 418.5,
      buyRange: "$395.00 – $435.00",
      position: null,
    });
  });
});

describe("FIN-DATA-CR-001: GET /api/finance/ticker/[symbol]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireFinanceOwner.mockResolvedValue({
      id: "owner-1",
      role: "super_admin",
      isRealSuperAdmin: true,
    });
    mockPortfolioForOwner.mockResolvedValue({
      positions: [],
      totalValue: 0,
      balanceWarning: null,
    });
    mockDecisionFindFirst.mockResolvedValue(null);
    mockCandidateForTicker.mockResolvedValue(null);
    mockSnapshotFindFirst.mockResolvedValue(null);
  });

  it("enforces requireFinanceOwner", async () => {
    const notFoundErr = Object.assign(new Error("NEXT_NOT_FOUND"), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
    mockRequireFinanceOwner.mockRejectedValueOnce(notFoundErr);
    const req = new NextRequest("http://localhost/api/finance/ticker/MSFT");
    await expect(
      GET(req, { params: Promise.resolve({ symbol: "MSFT" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockRequireFinanceOwner).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for invalid or unknown symbols", async () => {
    const invalidReq = new NextRequest("http://localhost/api/finance/ticker/TOOLONG123");
    const invalidRes = await GET(invalidReq, {
      params: Promise.resolve({ symbol: "TOOLONG123" }),
    });
    expect(invalidRes.status).toBe(404);

    const unknownReq = new NextRequest("http://localhost/api/finance/ticker/ZZZZ");
    const unknownRes = await GET(unknownReq, {
      params: Promise.resolve({ symbol: "ZZZZ" }),
    });
    expect(unknownRes.status).toBe(404);
  });

  it("supports ?demo=1 and returns enriched demo ticker detail", async () => {
    const req = new NextRequest("http://localhost/api/finance/ticker/msft?demo=1");
    const res = await GET(req, {
      params: Promise.resolve({ symbol: "msft" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      isDemo: true,
      symbol: "MSFT",
      latestPrice: 418.5,
      overallVerdict: { key: "buy", label: "Buy" },
      scoreBreakdown: { total: 2, buy: 1, hold: 1, dontBuy: 0, against: 1 },
    });
    expect(body.demoStock?.item?.symbol).toBe("MSFT");
  });

  it("returns full live ticker detail payload with holding, snapshot price, and pipeline data", async () => {
    mockPortfolioForOwner.mockResolvedValueOnce({
      positions: [
        {
          id: "hold-1",
          tickerId: "t-aapl",
          symbol: "AAPL",
          name: "Apple Inc.",
          shares: "15",
          averageCost: "200.00",
          value: 3427.5,
          gain: 427.5,
          gainPct: 14.25,
          benchmarkGainPct: 8.1,
          priceDate: "2026-11-26",
          reasonStatus: "holds",
          lastChecked: "2026-11-25T10:00:00.000Z",
          nextCheck: "2026-12-01T00:00:00.000Z",
          addedByYou: false,
          reasonPoints: [{ id: "rp-1", text: "Services margin expansion", main: true }],
          industry: "Technology",
        },
      ],
      totalValue: 3427.5,
      balanceWarning: null,
    });

    mockDecisionFindFirst.mockResolvedValueOnce({
      id: "dec-1",
      candidateId: "cand-1",
      call: "go",
      origin: "decider",
      actorLabel: "Decider Agent",
      sentence: "Strong ecosystem and free cash flow.",
      reviewGo: 3,
      reviewTotal: 3,
      reasons: ["Ecosystem lock-in"],
      answerAgainst: "Services growth offsets hardware cyclicality.",
      answerDissent: null,
      changeMind: "Services growth below 8%.",
      buyRangeLow: "210.00",
      buyRangeHigh: "235.00",
      reviewIfBelow: "185.00",
      holdDuration: "5+ years",
      candidate: {
        reviews: [
          {
            id: "rev-1",
            actorLabel: "Reviewer 1",
            call: "go",
            summary: "Clear moat",
            answerAgainst: "Pricing power holds",
          },
        ],
      },
    });

    mockCandidateForTicker.mockResolvedValueOnce({
      ticker: {
        id: "t-aapl",
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        type: "stock",
      },
      candidate: {
        id: "cand-1",
        stage: "done",
        proposedCount: 2,
        codeCheck: null,
        createdAt: new Date("2026-11-24T00:00:00.000Z"),
        run: {
          id: "run-1",
          criteriaLabel: "Quality at a fair price",
          criteriaVersion: 1,
        },
        evidence: [
          {
            id: "ev-1",
            section: "business",
            summary: "2B+ active devices.",
            tier: 1,
            codeChecked: true,
            codeCheckNote: null,
            url: "https://www.sec.gov",
          },
        ],
        evaluations: [
          {
            id: "eval-1",
            call: "buy",
            against: false,
            confidence: 85,
            createdAt: new Date("2026-11-25T00:00:00.000Z"),
            reasons: ["Recurring services revenue"],
            risks: ["China share pressure"],
            changeMind: "Services deceleration",
            buyRangeLow: "210.00",
            buyRangeHigh: "235.00",
            reviewIfBelow: "185.00",
            holdDuration: "5+ years",
            citedEvidenceIds: ["ev-1"],
          },
        ],
      },
    });

    mockSnapshotFindFirst.mockResolvedValueOnce({
      close: "228.50",
      date: "2026-11-26",
    });

    const req = new NextRequest("http://localhost/api/finance/ticker/AAPL");
    const res = await GET(req, {
      params: Promise.resolve({ symbol: "AAPL" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      isDemo: false,
      symbol: "AAPL",
      latestPrice: 228.5,
      priceDate: "2026-11-26",
      overallVerdict: { key: "buy", label: "Buy" },
      scoreBreakdown: { total: 1, buy: 1, hold: 0, dontBuy: 0, averageConfidence: 85 },
      holding: {
        symbol: "AAPL",
        shares: "15",
        averageCost: "200.00",
        value: 3427.5,
        gainPct: 14.25,
        reasonStatus: "holds",
      },
      decision: {
        id: "dec-1",
        call: "go",
        buyRangeLow: "$210.00",
        buyRangeHigh: "$235.00",
        reviewIfBelow: "$185.00",
        holdDuration: "5+ years",
      },
    });
    expect(body.candidateForTicker?.candidate?.evidence).toHaveLength(1);
    expect(body.candidateForTicker?.candidate?.evaluations).toHaveLength(1);
    expect(body.sectionStatuses).toHaveLength(6);
  });
});
