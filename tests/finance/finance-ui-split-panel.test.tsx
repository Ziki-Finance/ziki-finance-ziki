/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/actions/finance-portfolio", () => ({
  submitFinanceFreshCheck: vi.fn(async () => ({ ok: true })),
  submitFinanceOwnerAction: vi.fn(async () => ({ ok: true })),
  submitFinanceTrade: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/app/actions/finance-criteria", () => ({
  saveFinanceCriteriaAction: vi.fn(async () => ({ ok: true })),
  deleteFinanceCriteriaAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => vi.fn(),
}));

import {
  FinanceResearchBoard,
  type ResearchStockItem,
} from "@/components/finance/finance-research-board";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const SAMPLE_ITEMS: ResearchStockItem[] = [
  {
    id: "held-aapl",
    symbol: "AAPL",
    name: "Apple",
    bucket: "not_now",
    call: "keep",
    stage: "done",
    summary: "Services margin expansion and ecosystem lock-in remain intact.",
    reviewGo: 5,
    reviewTotal: 5,
    origin: "monitor",
    criteriaId: null,
    isHeld: true,
    latestPrice: 228.5,
    position: {
      holdingId: "hold-1",
      shares: 20,
      averageCost: 200.1,
      value: 4570,
      gainPct: 14.2,
      benchmarkGainPct: 9.5,
      reasonStatus: "holds",
      nextCheck: "2026-12-01T00:00:00.000Z",
      reasonPoints: [],
    },
  },
  {
    id: "rec-msft",
    symbol: "MSFT",
    name: "Microsoft",
    bucket: "needs_you",
    call: "go",
    stage: "decide",
    summary:
      "Durable enterprise cloud moat, 35% ROIC, and disciplined capital return.",
    reviewGo: 4,
    reviewTotal: 5,
    origin: "review",
    criteriaId: null,
    isHeld: false,
    isDemo: true,
    latestPrice: 418.2,
    buyRange: "$395.00 – $435.00",
    position: null,
  },
];

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
});

function renderBoard(items: ResearchStockItem[] = SAMPLE_ITEMS) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <FinanceResearchBoard
        initialCriteria={[
          {
            id: "crit-1",
            preset: "quality_at_a_fair_price",
            words: "Quality at a fair price\nROIC > 20%",
            companySize: "large",
            industries: ["Technology"],
            leaveOut: [],
            howManyStocks: 5,
            createdAt: new Date("2026-11-20T00:00:00Z"),
            updatedAt: new Date("2026-11-20T00:00:00Z"),
            latestVersion: 1,
            versionCount: 1,
            runCount: 1,
            latestRun: {
              id: "run-1",
              stage: "screen",
              createdAt: new Date("2026-11-20T00:00:00Z"),
              candidateCount: 2,
            },
          },
        ]}
        items={items}
      />,
    );
  });
  return container;
}

describe("FIN-UI-CR-001: /finance Linear/spreadsheet list and split-screen side panel", () => {
  it("removes PortfolioCard from app/(app)/finance/page.tsx", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "app/(app)/finance/page.tsx"),
      "utf8",
    );
    expect(pageSource).not.toMatch(/PortfolioCard/);
  });

  it("omits the 4 top KPI boxes and renders Owned + Recommendations grouped table", () => {
    const el = renderBoard();
    const text = el.textContent ?? "";

    expect(text).not.toContain("Portfolio value");
    expect(text).not.toContain("Needs your call");
    expect(text).not.toContain("Researched universe");
    expect(text).not.toContain("Active criteria");

    expect(text).toContain("Owned (1)");
    expect(text).toContain("Recommendations (1)");
    expect(text).toContain("$4,570 · 20sh");
    expect(text).toContain("+14.2%");
    expect(text).toContain("$395.00 – $435.00");
    expect(text).toContain("4/5 agree");
  });

  it("opens Company Detail in the right side panel on row click and switches to Criteria on button click", () => {
    const el = renderBoard();

    // Initially no side panel
    expect(el.querySelector("aside")).toBeNull();

    // Click Owned row (Apple)
    const rows = el.querySelectorAll('[role="button"]');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    act(() => {
      rows[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const asideAfterApple = el.querySelector('aside[aria-label="Company Detail"]');
    expect(asideAfterApple).not.toBeNull();
    expect(asideAfterApple?.textContent).toContain("Your Position");
    expect(asideAfterApple?.textContent).toContain("Ask for fresh check");
    expect(asideAfterApple?.textContent).toContain("+ Log a trade (AAPL)");

    // Click Recommendation demo row (Microsoft) -> shows FinanceTickerPipeline + Buy action
    act(() => {
      rows[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const asideAfterMsft = el.querySelector('aside[aria-label="Company Detail"]');
    expect(asideAfterMsft?.textContent).toContain("Recommendation");
    expect(asideAfterMsft?.textContent).not.toContain("Full page");
    expect(asideAfterMsft?.textContent).toContain("1. Screen");
    expect(asideAfterMsft?.textContent).toContain("2. Enrich");
    expect(asideAfterMsft?.textContent).toContain("3. Evaluate");
    expect(asideAfterMsft?.textContent).toContain("4. Decide");

    // Criteria dropdown: "All criteria" + selecting a criterion reveals Edit button
    const criteriaSelect = el.querySelector(
      'select[aria-label="Filter by criteria"]',
    ) as HTMLSelectElement | null;
    expect(criteriaSelect).not.toBeNull();
    expect(criteriaSelect?.textContent).toContain("All criteria");
    expect(criteriaSelect?.textContent).toContain("Quality at a fair price");

    act(() => {
      if (criteriaSelect) {
        criteriaSelect.value = "crit-1";
        criteriaSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    const editBtn = el.querySelector('button[aria-label="Edit criteria"]');
    expect(editBtn).not.toBeNull();
  });

  it("hides Log a trade in the side panel when an unheld stock has no decision yet", () => {
    const inProgressItem: ResearchStockItem = {
      id: "cand-nvda",
      symbol: "NVDA",
      name: "NVIDIA",
      bucket: "in_progress",
      call: null,
      stage: "screen",
      summary: "Strong AI GPU demand",
      reviewGo: null,
      reviewTotal: null,
      origin: null,
      criteriaId: "crit-1",
      isHeld: false,
      latestPrice: 135.0,
      position: null,
    };

    const el = renderBoard([inProgressItem]);
    const row = el.querySelector('[role="button"]');
    expect(row).not.toBeNull();
    act(() => {
      row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const aside = el.querySelector('aside[aria-label="Company Detail"]');
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain("lg:sticky");
    expect(aside?.textContent).not.toContain("Log a trade");
    expect(aside?.textContent).not.toContain("Buy & log trade");
  });

  it("groups duplicate symbols across criteria into one row with tabs and shows early evaluation count", () => {
    const nvdaEval: ResearchStockItem = {
      id: "cand-nvda-1",
      symbol: "NVDA",
      name: "NVIDIA",
      bucket: "in_progress",
      call: null,
      stage: "evaluate",
      summary: "Strong AI moat",
      reviewGo: null,
      reviewTotal: null,
      origin: null,
      criteriaId: "crit-1",
      criteriaLabel: "Quality at a fair price",
      evaluationCount: 1,
      evaluationTotal: 5,
      isHeld: false,
      latestPrice: 135.0,
      buyRange: null,
      position: null,
    };
    const nvdaEnrich: ResearchStockItem = {
      id: "cand-nvda-2",
      symbol: "NVDA",
      name: "NVIDIA",
      bucket: "in_progress",
      call: null,
      stage: "enrich",
      summary: "Proposed in screening",
      reviewGo: null,
      reviewTotal: null,
      origin: null,
      criteriaId: "crit-2",
      criteriaLabel: "High growth",
      evaluationCount: 0,
      evaluationTotal: 5,
      isHeld: false,
      latestPrice: 135.0,
      buyRange: null,
      position: null,
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        <FinanceResearchBoard
          initialCriteria={[]}
          items={[nvdaEnrich, nvdaEval]}
          detailsById={{
            "cand-nvda-1": {
              symbol: "NVDA",
              criteriaLabel: "Quality at a fair price",
              criteriaVersion: 1,
              currentStage: "evaluate",
              proposedCount: 2,
              buyRange: "$120.00 – $140.00",
              reviewIfBelow: null,
              holdFor: "3 years",
              evidence: [],
              evaluations: [
                {
                  id: "ev-1",
                  call: "buy",
                  callLabel: "Buy",
                  against: false,
                  confidence: 80,
                  createdAt: "2026-11-27",
                  reasons: ["Strong AI moat"],
                  risks: [],
                  changeMind: "Margin compression",
                  buyRangeLow: "$120.00",
                  buyRangeHigh: "$140.00",
                  reviewIfBelow: null,
                  holdDuration: "3 years",
                  citedCount: 0,
                },
              ],
              breakdown: {
                total: 1,
                buy: 1,
                hold: 0,
                dontBuy: 0,
                against: 0,
                averageConfidence: 80,
              },
              overallVerdictLabel: "Buy",
              overallVerdictKey: "buy",
              decision: null,
            },
            "cand-nvda-2": {
              symbol: "NVDA",
              criteriaLabel: "High growth",
              criteriaVersion: 1,
              currentStage: "enrich",
              proposedCount: 1,
              buyRange: null,
              reviewIfBelow: null,
              holdFor: null,
              evidence: [],
              evaluations: [],
              breakdown: {
                total: 0,
                buy: 0,
                hold: 0,
                dontBuy: 0,
                against: 0,
                averageConfidence: null,
              },
              overallVerdictLabel: "Hold",
              overallVerdictKey: "hold",
              decision: null,
            },
          }}
        />,
      );
    });

    const rows = container.querySelectorAll('[role="button"]');
    expect(rows.length).toBe(1);
    expect(container.textContent).toContain("2 criteria");
    expect(container.textContent).toContain("1 of 5 evaluated");
    expect(container.textContent).not.toContain("$120.00 – $140.00");

    act(() => {
      rows[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const aside = container.querySelector('aside[aria-label="Company Detail"]');
    expect(aside?.textContent).toContain("Quality at a fair price (v1)");
    const tabs = aside?.querySelectorAll('[role="tab"]') ?? [];
    expect(tabs.length).toBe(2);

    act(() => {
      tabs[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(aside?.textContent).toContain("High growth (v1)");
  });
});
