"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FinanceCriteriaView } from "@/lib/finance/criteria";
import { financeCriteriaTitle } from "@/lib/validations/finance";
import { DEMO_STOCK_ITEMS, findDemoStock } from "@/lib/finance/demo-stocks";
import { CriteriaModal } from "./finance-criteria-manager";
import {
  FinanceTickerPipeline,
  type SerializedDecision,
  type SerializedEvaluationItem,
  type SerializedEvidenceItem,
} from "./finance-ticker-pipeline";
import { FreshCheckButton, TradeButton } from "./portfolio-card";

export type ResearchStockPosition = {
  holdingId: string;
  shares: number;
  averageCost: number | null;
  value: number | null;
  gainPct: number | null;
  benchmarkGainPct: number | null;
  reasonStatus: string;
  nextCheck: string | null;
  reasonPoints: Array<{ id: string; text: string; main: boolean }>;
};

export type ResearchStockItem = {
  id: string;
  symbol: string;
  name: string;
  bucket: "needs_you" | "in_progress" | "not_now";
  call: string | null; // go | no_go | keep | trim | sell | null
  stage: string;
  summary: string;
  reviewGo: number | null;
  reviewTotal: number | null;
  origin: string | null;
  criteriaId: string | null;
  isHeld: boolean;
  isDemo?: boolean;
  latestPrice?: number | null;
  buyRange?: string | null;
  position?: ResearchStockPosition | null;
};

export type TickerPanelDetail = {
  symbol: string;
  criteriaLabel: string;
  criteriaVersion: number;
  currentStage: string;
  proposedCount: number;
  sectionsCovered: number;
  buyRange: string | null;
  reviewIfBelow: string | null;
  holdFor: string | null;
  evidence: SerializedEvidenceItem[];
  evaluations: SerializedEvaluationItem[];
  breakdown: {
    total: number;
    buy: number;
    hold: number;
    dontBuy: number;
    against: number;
    averageConfidence: number | null;
  };
  overallVerdictLabel: string;
  overallVerdictKey: "buy" | "hold" | "dont_buy";
  decision: SerializedDecision | null;
};

type FilterKey = "all" | "needs_you" | "go" | "in_progress" | "not_now";

const CALL_LABELS: Record<string, string> = {
  go: "Go",
  no_go: "No-go",
  keep: "Keep",
  trim: "Trim",
  sell: "Sell",
};

const STAGE_LABELS: Record<string, string> = {
  screen: "Screening",
  enrich: "Enriching",
  evaluate: "Evaluating",
  review: "In review",
  decide: "Deciding",
  done: "Complete",
};

const REASON_LABELS: Record<string, string> = {
  holds: "Holds",
  weakening: "Weakening",
  broken: "Broken",
  not_checked: "Not checked",
};

const METRIC_BOX_CLASS =
  "inline-flex items-center whitespace-nowrap rounded-md border border-zk-border bg-zk-bg px-2.5 py-1 text-xs tabular-nums";

const ROW_GRID_CLASS =
  "sm:grid sm:grid-cols-[minmax(240px,1fr)_96px_112px_156px_112px_84px] sm:items-center sm:gap-3";

function statusBadgeClass(kind: string | null): string {
  if (kind === "go" || kind === "keep" || kind === "holds") {
    return "border-zk-ok-fg/30 bg-zk-ok-bg text-zk-ok-fg";
  }
  if (kind === "trim" || kind === "weakening" || kind === "review") {
    return "border-zk-warn-fg/30 bg-zk-warn-bg text-zk-warn-fg";
  }
  if (kind === "no_go" || kind === "sell" || kind === "broken") {
    return "border-zk-bad-fg/30 bg-zk-bad-bg text-zk-bad-fg";
  }
  if (kind === "not_checked") {
    return "border-zk-border bg-zk-chip text-zk-muted";
  }
  return "border-zk-accent/30 bg-zk-tint text-zk-accent";
}

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCompactMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${value < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 100_000) {
    return `${value < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function resolveItemDetail(
  item: ResearchStockItem,
  detailsBySymbol: Record<string, TickerPanelDetail>,
): TickerPanelDetail | null {
  if (item.isDemo) {
    const demo = findDemoStock(item.symbol);
    if (!demo) return null;
    return {
      symbol: demo.item.symbol,
      criteriaLabel: demo.criteriaLabel,
      criteriaVersion: demo.criteriaVersion,
      currentStage: demo.item.stage,
      proposedCount: demo.proposedCount,
      sectionsCovered: demo.sectionsCovered,
      buyRange: demo.buyRange,
      reviewIfBelow: demo.reviewIfBelow,
      holdFor: demo.holdFor,
      evidence: demo.evidence,
      evaluations: demo.evaluations,
      breakdown: demo.breakdown,
      overallVerdictLabel: demo.overallVerdictLabel,
      overallVerdictKey: demo.overallVerdictKey,
      decision: demo.decision,
    };
  }
  return detailsBySymbol[item.symbol] ?? null;
}

export function FinanceResearchBoard({
  initialCriteria,
  items,
  detailsBySymbol = {},
}: {
  initialCriteria: FinanceCriteriaView[];
  items: ResearchStockItem[];
  detailsBySymbol?: Record<string, TickerPanelDetail>;
}) {
  const [selectedCriteriaId, setSelectedCriteriaId] = useState<string>("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [showDemo, setShowDemo] = useState(items.length === 0);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCriteria, setEditingCriteria] =
    useState<FinanceCriteriaView | null>(null);

  const activeCriteria =
    selectedCriteriaId !== ""
      ? (initialCriteria.find((c) => c.id === selectedCriteriaId) ?? null)
      : null;

  const displayItems = useMemo(
    () => (showDemo ? [...DEMO_STOCK_ITEMS, ...items] : items),
    [showDemo, items],
  );

  const criteriaFilteredItems = useMemo(() => {
    if (!activeCriteria) return displayItems;
    return displayItems.filter((item) => item.criteriaId === activeCriteria.id);
  }, [displayItems, activeCriteria]);

  const counts = useMemo(
    () => ({
      all: criteriaFilteredItems.length,
      needs_you: criteriaFilteredItems.filter((i) => i.bucket === "needs_you")
        .length,
      go: criteriaFilteredItems.filter(
        (i) => i.call === "go" || i.call === "keep",
      ).length,
      in_progress: criteriaFilteredItems.filter(
        (i) => i.bucket === "in_progress",
      ).length,
      not_now: criteriaFilteredItems.filter((i) => i.bucket === "not_now")
        .length,
    }),
    [criteriaFilteredItems],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return criteriaFilteredItems.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "needs_you" && item.bucket === "needs_you") ||
        (filter === "go" && (item.call === "go" || item.call === "keep")) ||
        (filter === "in_progress" && item.bucket === "in_progress") ||
        (filter === "not_now" && item.bucket === "not_now");
      const matchesSearch =
        !q ||
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [criteriaFilteredItems, filter, search]);

  const ownedItems = useMemo(
    () => filteredItems.filter((item) => item.isHeld),
    [filteredItems],
  );
  const recommendationItems = useMemo(
    () => filteredItems.filter((item) => !item.isHeld),
    [filteredItems],
  );

  const selectedItem = useMemo(
    () =>
      displayItems.find((item) => item.symbol === selectedSymbol) ?? null,
    [displayItems, selectedSymbol],
  );

  const selectedDetail = useMemo(
    () =>
      selectedItem ? resolveItemDetail(selectedItem, detailsBySymbol) : null,
    [selectedItem, detailsBySymbol],
  );

  const hasSide = selectedItem !== null;

  function openNewModal() {
    setEditingCriteria(null);
    setModalOpen(true);
  }

  function openEditModal(item: FinanceCriteriaView) {
    setEditingCriteria(item);
    setModalOpen(true);
  }

  function openCompanyPanel(symbol: string) {
    setSelectedSymbol(symbol);
  }

  function renderStockRow(item: ResearchStockItem) {
    const isSelected = selectedSymbol === item.symbol;

    const statusKey =
      item.isHeld && item.position
        ? item.position.reasonStatus
        : item.call ?? item.stage;

    const statusText =
      item.isHeld && item.position
        ? REASON_LABELS[item.position.reasonStatus] ?? item.position.reasonStatus
        : item.call
          ? CALL_LABELS[item.call] ?? item.call
          : STAGE_LABELS[item.stage] ?? item.stage;

    const valueOrRangeText = item.isHeld
      ? item.position
        ? `${formatCompactMoney(item.position.value)} · ${item.position.shares}sh`
        : "Held"
      : item.buyRange ?? "—";

    const returnOrScoreText = item.isHeld
      ? formatPct(item.position?.gainPct)
      : item.reviewGo !== null && item.reviewTotal !== null
        ? item.origin === "monitor"
          ? "Reason check"
          : `${item.reviewGo}/${item.reviewTotal} Go`
        : "In pipeline";

    const returnColorClass = item.isHeld
      ? item.position?.gainPct === null || item.position?.gainPct === undefined
        ? "text-zk-muted"
        : item.position.gainPct >= 0
          ? "text-zk-ok-fg font-semibold"
          : "text-zk-bad-fg font-semibold"
      : "text-zk-muted";

    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[data-row-action]")) {
            return;
          }
          openCompanyPanel(item.symbol);
        }}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest("[data-row-action]")) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openCompanyPanel(item.symbol);
          }
        }}
        className={`cursor-pointer grid grid-cols-1 gap-3 px-5 py-3.5 transition ${ROW_GRID_CLASS} ${
          isSelected
            ? "bg-zk-tint/50 ring-1 ring-inset ring-zk-accent/40"
            : "hover:bg-zk-tint/30"
        }`}
      >
        {/* Company */}
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zk-border bg-zk-bg text-xs font-bold text-zk-accent">
              {item.symbol.slice(0, 2)}
            </span>
            <span className="truncate text-xs font-semibold text-zk-text">
              {item.name}
            </span>
            <span className="shrink-0 font-mono text-xs text-zk-muted">
              {item.symbol}
            </span>
            {item.isDemo ? (
              <span className="shrink-0 rounded-full border border-zk-accent/40 bg-zk-tint px-1.5 py-0.5 text-[10px] font-medium text-zk-accent">
                Demo
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 max-w-[46ch] truncate pl-10 text-xs text-zk-muted">
            {item.summary}
          </p>
        </div>

        {/* Price */}
        <div>
          <span className={`${METRIC_BOX_CLASS} font-medium text-zk-text`}>
            {formatPrice(item.latestPrice)}
          </span>
        </div>

        {/* Status / Verdict / Thesis Health */}
        <div>
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(statusKey)}`}
          >
            {statusText}
          </span>
        </div>

        {/* Value / Buy Range */}
        <div>
          <span className={`${METRIC_BOX_CLASS} text-zk-text`}>
            {valueOrRangeText}
          </span>
        </div>

        {/* Return / Score */}
        <div>
          <span className={`${METRIC_BOX_CLASS} ${returnColorClass}`}>
            {returnOrScoreText}
          </span>
        </div>

        {/* Action */}
        <div data-row-action="true" className="whitespace-nowrap sm:text-right">
          {item.isHeld ? (
            <button
              type="button"
              onClick={() => openCompanyPanel(item.symbol)}
              className="whitespace-nowrap rounded-md border border-zk-border bg-zk-bg px-2.5 py-1 text-xs font-medium text-zk-text transition hover:border-zk-accent"
            >
              Details
            </button>
          ) : (
            <TradeButton
              symbol={item.symbol}
              label={item.call === "go" ? "Buy" : "+ Trade"}
              className="whitespace-nowrap rounded-md bg-zk-accent px-2.5 py-1 text-xs font-semibold text-white transition hover:opacity-90"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header + Criteria Dropdown */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">
          Finance
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Filter by criteria"
              value={activeCriteria?.id ?? ""}
              onChange={(event) => setSelectedCriteriaId(event.target.value)}
              className="rounded-lg border border-zk-border bg-zk-surface px-3 py-1.5 text-xs font-medium text-zk-text focus:outline-none focus:ring-2 focus:ring-zk-accent"
            >
              <option value="">All criteria</option>
              {initialCriteria.map((c) => (
                <option key={c.id} value={c.id}>
                  {financeCriteriaTitle(c)} (v{c.latestVersion})
                </option>
              ))}
            </select>
            {activeCriteria ? (
              <button
                type="button"
                aria-label="Edit criteria"
                title="Edit selected criteria"
                onClick={() => openEditModal(activeCriteria)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zk-border bg-zk-surface text-xs text-zk-text2 transition hover:border-zk-accent hover:text-zk-text"
              >
                ✎
              </button>
            ) : null}
          </div>
          <Button type="button" onClick={openNewModal}>
            + New criteria
          </Button>
        </div>
      </header>

      {/* Split-Screen Workspace: Left Grouped Table + Right Side Panel */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <section
          aria-label="Stock Research and Analysis"
          className={`${
            hasSide ? "lg:col-span-7" : "lg:col-span-12"
          } overflow-hidden rounded-2xl border border-zk-border bg-zk-surface`}
        >
          {/* Toolbar: Filter Pills + Demo Toggle + Search */}
          <div className="flex flex-col gap-3 border-b border-zk-divider p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", `All (${counts.all})`],
                  ["needs_you", `Needs you (${counts.needs_you})`],
                  ["go", `Go / Keep (${counts.go})`],
                  ["in_progress", `In progress (${counts.in_progress})`],
                  ["not_now", `Not now (${counts.not_now})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    filter === key
                      ? "bg-zk-accent text-white"
                      : "bg-zk-chip text-zk-text2 hover:text-zk-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDemo((prev) => !prev)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  showDemo
                    ? "border-zk-accent/60 bg-zk-tint text-zk-accent"
                    : "border-zk-border bg-zk-bg text-zk-muted hover:text-zk-text"
                }`}
              >
                {showDemo ? "Hide demo" : "Show demo"}
              </button>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter company or ticker…"
                className="w-full rounded-lg border border-zk-border bg-zk-bg px-3 py-1.5 text-xs text-zk-text placeholder:text-zk-muted focus:border-zk-accent focus:outline-none sm:w-48"
              />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-zk-text">
                {items.length === 0
                  ? "No researched stocks yet"
                  : "No stocks match this filter"}
              </p>
              <p className="text-xs text-zk-muted">
                {items.length === 0
                  ? "Save a research criteria strategy so your agents can start screening companies."
                  : "Try clearing your search or switching tabs."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                {/* Column Headers */}
                <div
                  className={`hidden border-b border-zk-divider bg-zk-bg px-5 py-2.5 text-xs font-semibold text-zk-muted ${ROW_GRID_CLASS}`}
                >
                  <span>Company</span>
                  <span>Price</span>
                  <span>Status</span>
                  <span>Value / Range</span>
                  <span>Return / Score</span>
                  <span className="text-right">Action</span>
                </div>

                {/* Owned Group */}
                <div className="border-b border-zk-divider bg-zk-chip/60 px-5 py-2 text-xs font-bold uppercase tracking-wider text-zk-text">
                  Owned ({ownedItems.length})
                </div>
                {ownedItems.length === 0 ? (
                  <p className="border-b border-zk-divider px-5 py-3.5 text-xs text-zk-muted">
                    No owned positions yet — log a trade on any recommendation to
                    track it here.
                  </p>
                ) : (
                  <div className="divide-y divide-zk-divider">
                    {ownedItems.map((item) => renderStockRow(item))}
                  </div>
                )}

                {/* Recommendations Group */}
                <div className="border-y border-zk-divider bg-zk-chip/60 px-5 py-2 text-xs font-bold uppercase tracking-wider text-zk-muted">
                  Recommendations ({recommendationItems.length})
                </div>
                {recommendationItems.length === 0 ? (
                  <p className="px-5 py-3.5 text-xs text-zk-muted">
                    No recommendations match this filter.
                  </p>
                ) : (
                  <div className="divide-y divide-zk-divider">
                    {recommendationItems.map((item) => renderStockRow(item))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right Split-Screen Company Detail Panel */}
        {hasSide && selectedItem ? (
          <aside
            aria-label="Company Detail"
            className="lg:col-span-5 space-y-4"
          >
            <div className="rounded-2xl border border-zk-border bg-zk-surface p-5 space-y-5">
              {/* Side Panel Header */}
              <div className="flex items-start justify-between gap-3 border-b border-zk-divider pb-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zk-border bg-zk-bg text-xs font-bold text-zk-accent">
                    {selectedItem.symbol.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="truncate text-sm font-bold text-zk-text">
                        {selectedItem.name}
                      </h2>
                      <span className="font-mono text-xs text-zk-muted">
                        {selectedItem.symbol}
                      </span>
                      {selectedItem.isHeld ? (
                        <span className="rounded-full border border-zk-accent/40 bg-zk-tint px-2 py-0.5 text-[11px] font-medium text-zk-accent">
                          Owned
                        </span>
                      ) : null}
                      {selectedItem.isDemo ? (
                        <span className="rounded-full border border-zk-accent/40 bg-zk-tint px-2 py-0.5 text-[11px] font-medium text-zk-accent">
                          Demo
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-zk-muted">
                      Price:{" "}
                      <strong className="tabular-nums text-zk-text">
                        {formatPrice(selectedItem.latestPrice)}
                      </strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close side panel"
                  onClick={() => setSelectedSymbol(null)}
                  className="rounded-md border border-zk-border px-2 py-1 text-xs text-zk-muted hover:text-zk-text"
                >
                  ✕
                </button>
              </div>

                {/* Position / Recommendation Summary */}
                {selectedItem.isHeld && selectedItem.position ? (
                  <div className="rounded-xl border border-zk-border bg-zk-bg p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-zk-text">
                          Your Position
                        </h3>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(selectedItem.position.reasonStatus)}`}
                        >
                          Thesis:{" "}
                          {REASON_LABELS[selectedItem.position.reasonStatus] ??
                            selectedItem.position.reasonStatus}
                        </span>
                      </div>
                      <FreshCheckButton
                        holdingId={selectedItem.position.holdingId}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[11px] text-zk-muted">Position</p>
                        <p className="text-xs font-bold tabular-nums text-zk-text">
                          {formatCompactMoney(selectedItem.position.value)}
                        </p>
                        <p className="text-[11px] tabular-nums text-zk-muted">
                          {selectedItem.position.shares} sh @{" "}
                          {selectedItem.position.averageCost === null
                            ? "—"
                            : `$${Number(selectedItem.position.averageCost).toFixed(2)}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-zk-muted">Return</p>
                        <p
                          className={`text-xs font-bold tabular-nums ${
                            selectedItem.position.gainPct === null
                              ? "text-zk-muted"
                              : selectedItem.position.gainPct >= 0
                                ? "text-zk-ok-fg"
                                : "text-zk-bad-fg"
                          }`}
                        >
                          {formatPct(selectedItem.position.gainPct)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-zk-muted">S&amp;P 500</p>
                        <p className="text-xs font-bold tabular-nums text-zk-text">
                          {formatPct(selectedItem.position.benchmarkGainPct)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-zk-border bg-zk-bg p-3.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-zk-text">
                          Recommendation
                        </h3>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(selectedItem.call ?? selectedItem.stage)}`}
                        >
                          {selectedItem.call
                            ? CALL_LABELS[selectedItem.call] ??
                              selectedItem.call
                            : STAGE_LABELS[selectedItem.stage] ??
                              selectedItem.stage}
                        </span>
                      </div>
                      {selectedItem.reviewGo !== null &&
                      selectedItem.reviewTotal !== null ? (
                        <span className="text-[11px] tabular-nums text-zk-muted">
                          {selectedItem.reviewGo}/{selectedItem.reviewTotal} Go
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs leading-relaxed text-zk-text2">
                      {selectedItem.summary}
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <p className="text-[11px] text-zk-muted">Buy range</p>
                        <p className="text-xs font-semibold tabular-nums text-zk-text">
                          {selectedDetail?.buyRange ??
                            selectedItem.buyRange ??
                            "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-zk-muted">
                          Review below
                        </p>
                        <p className="text-xs font-semibold tabular-nums text-zk-text">
                          {selectedDetail?.reviewIfBelow ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-zk-muted">Hold for</p>
                        <p className="text-xs font-semibold text-zk-text">
                          {selectedDetail?.holdFor ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Trade Action */}
                <div className="flex items-center gap-2">
                  <TradeButton
                    symbol={selectedItem.symbol}
                    decisionId={selectedDetail?.decision?.id}
                    label={
                      selectedItem.isHeld
                        ? `+ Log a trade (${selectedItem.symbol})`
                        : selectedItem.call === "go"
                          ? `Buy & log trade (${selectedItem.symbol})`
                          : `+ Log a trade (${selectedItem.symbol})`
                    }
                    className="flex-1 rounded-lg bg-zk-accent px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                  />
                </div>

                {/* 4-Stage Pipeline */}
                {selectedDetail ? (
                  <FinanceTickerPipeline
                    key={selectedItem.symbol}
                    compact
                    symbol={selectedDetail.symbol}
                    currentStage={selectedDetail.currentStage}
                    criteriaLabel={selectedDetail.criteriaLabel}
                    criteriaVersion={selectedDetail.criteriaVersion}
                    proposedCount={selectedDetail.proposedCount}
                    sectionsCovered={selectedDetail.sectionsCovered}
                    isDemo={selectedItem.isDemo}
                    evidence={selectedDetail.evidence}
                    evaluations={selectedDetail.evaluations}
                    breakdown={selectedDetail.breakdown}
                    overallVerdictLabel={selectedDetail.overallVerdictLabel}
                    overallVerdictKey={selectedDetail.overallVerdictKey}
                    decision={selectedDetail.decision}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-zk-border bg-zk-bg p-4 text-center text-xs text-zk-muted">
                    No agent research pipeline details available for{" "}
                    {selectedItem.symbol} yet.
                  </div>
                )}
            </div>
          </aside>
        ) : null}
      </div>

      <CriteriaModal
        open={modalOpen}
        editing={editingCriteria}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
