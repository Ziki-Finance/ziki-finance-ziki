"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FinanceCriteriaView } from "@/lib/finance/criteria";
import { financeCriteriaTitle } from "@/lib/validations/finance";
import { DEMO_STOCK_ITEMS, findDemoStock } from "@/lib/finance/demo-stocks";
import type {
  PipelineActivityView,
  PipelineScreeningView,
} from "@/lib/finance/stage-view";
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
  criteriaLabel?: string | null;
  evaluationCount?: number;
  evaluationTotal?: number;
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
  screening?: PipelineScreeningView | null;
  activity?: PipelineActivityView;
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
  go: "Buy",
  no_go: "Pass",
  keep: "Hold",
  trim: "Reduce",
  sell: "Sell",
};

const CALL_DESCRIPTIONS: Record<string, string> = {
  go: "Agents recommend buying this stock.",
  no_go: "Agents recommend passing on this stock.",
  keep: "Investment thesis still holds — keep holding.",
  trim: "Thesis is weakening — consider reducing position size.",
  sell: "Thesis is broken — consider exiting the position.",
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

const SPLIT_ROW_GRID_CLASS =
  "sm:grid sm:grid-cols-[minmax(140px,1fr)_84px_88px_72px] sm:items-center sm:gap-2.5";

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

function TickerLogo({
  symbol,
  name,
  size = "sm",
}: {
  symbol: string;
  name: string;
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const boxClass = size === "md" ? "h-10 w-10" : "h-8 w-8";

  if (failed) {
    return (
      <span
        title={`${name} (${symbol})`}
        className={`flex ${boxClass} shrink-0 items-center justify-center rounded-lg border border-zk-border bg-zk-bg text-xs font-bold text-zk-accent`}
      >
        {symbol.slice(0, 2)}
      </span>
    );
  }

  return (
    <span
      title={`${name} (${symbol})`}
      className={`flex ${boxClass} shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zk-border bg-zk-bg`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/finance/ticker/${encodeURIComponent(symbol)}/logo`}
        alt={symbol}
        onError={() => setFailed(true)}
        className="h-full w-full object-contain p-1"
      />
    </span>
  );
}

function resolveItemDetail(
  item: ResearchStockItem,
  detailsById: Record<string, TickerPanelDetail>,
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
  return detailsById[item.id] ?? detailsBySymbol[item.symbol] ?? null;
}

const ITEM_STAGE_PRIORITY: Record<string, number> = {
  done: 5,
  decide: 4,
  review: 3,
  evaluate: 2,
  enrich: 1,
  screen: 0,
};

function itemPriority(item: ResearchStockItem): number {
  const bucketScore =
    item.bucket === "needs_you" ? 300 : item.isHeld ? 200 : item.bucket === "in_progress" ? 100 : 0;
  return bucketScore + (ITEM_STAGE_PRIORITY[item.stage] ?? 0);
}

type StockRowGroup = {
  primary: ResearchStockItem;
  variants: ResearchStockItem[];
};

export function FinanceResearchBoard({
  initialCriteria,
  items,
  detailsById = {},
  detailsBySymbol = {},
  canManageTrades = true,
}: {
  initialCriteria: FinanceCriteriaView[];
  items: ResearchStockItem[];
  detailsById?: Record<string, TickerPanelDetail>;
  detailsBySymbol?: Record<string, TickerPanelDetail>;
  canManageTrades?: boolean;
}) {
  const [selectedCriteriaId, setSelectedCriteriaId] = useState<string>("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
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

  const groupedEntries = useMemo<StockRowGroup[]>(() => {
    const bySymbol = new Map<string, ResearchStockItem[]>();
    for (const item of criteriaFilteredItems) {
      const key = item.isDemo ? `demo:${item.symbol}` : item.symbol;
      const list = bySymbol.get(key);
      if (list) list.push(item);
      else bySymbol.set(key, [item]);
    }
    const groups: StockRowGroup[] = [];
    for (const variants of bySymbol.values()) {
      let primary = variants[0];
      for (let i = 1; i < variants.length; i += 1) {
        if (itemPriority(variants[i]) > itemPriority(primary)) {
          primary = variants[i];
        }
      }
      groups.push({ primary, variants });
    }
    return groups;
  }, [criteriaFilteredItems]);

  const counts = useMemo(
    () => ({
      all: groupedEntries.length,
      needs_you: groupedEntries.filter((g) => g.primary.bucket === "needs_you")
        .length,
      go: groupedEntries.filter(
        (g) => g.primary.call === "go" || g.primary.call === "keep",
      ).length,
      in_progress: groupedEntries.filter(
        (g) => g.primary.bucket === "in_progress",
      ).length,
      not_now: groupedEntries.filter((g) => g.primary.bucket === "not_now")
        .length,
    }),
    [groupedEntries],
  );

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groupedEntries.filter(({ primary, variants }) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "needs_you" && primary.bucket === "needs_you") ||
        (filter === "go" &&
          (primary.call === "go" || primary.call === "keep")) ||
        (filter === "in_progress" && primary.bucket === "in_progress") ||
        (filter === "not_now" && primary.bucket === "not_now");
      const matchesSearch =
        !q ||
        primary.symbol.toLowerCase().includes(q) ||
        primary.name.toLowerCase().includes(q) ||
        variants.some((v) => v.summary.toLowerCase().includes(q));
      return matchesFilter && matchesSearch;
    });
  }, [groupedEntries, filter, search]);

  const ownedItems = useMemo(
    () => filteredEntries.filter((g) => g.primary.isHeld),
    [filteredEntries],
  );
  const recommendationItems = useMemo(
    () => filteredEntries.filter((g) => !g.primary.isHeld),
    [filteredEntries],
  );

  const selectedItem = useMemo(
    () =>
      displayItems.find((item) => item.id === selectedItemId) ?? null,
    [displayItems, selectedItemId],
  );

  const selectedVariants = useMemo(() => {
    if (!selectedItem || selectedItem.isDemo) return [];
    return criteriaFilteredItems.filter(
      (item) => !item.isDemo && item.symbol === selectedItem.symbol,
    );
  }, [selectedItem, criteriaFilteredItems]);

  const selectedDetail = useMemo(
    () =>
      selectedItem
        ? resolveItemDetail(selectedItem, detailsById, detailsBySymbol)
        : null,
    [selectedItem, detailsById, detailsBySymbol],
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

  function openCompanyPanel(itemId: string) {
    setSelectedItemId(itemId);
  }

  function renderStockRow(group: StockRowGroup) {
    const item = group.primary;
    const isSelected = group.variants.some((v) => v.id === selectedItemId);

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
        : "Owned"
      : item.bucket === "in_progress"
        ? "—"
        : item.buyRange ?? "—";

    const returnOrScoreText = item.isHeld
      ? formatPct(item.position?.gainPct)
      : item.reviewGo !== null && item.reviewTotal !== null
        ? item.origin === "monitor"
          ? "Thesis check"
          : `${item.reviewGo}/${item.reviewTotal} agree`
        : item.evaluationCount && item.evaluationCount > 0
          ? `${item.evaluationCount} of ${item.evaluationTotal ?? 5} evaluated`
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
          openCompanyPanel(item.id);
        }}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest("[data-row-action]")) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openCompanyPanel(item.id);
          }
        }}
        className={`cursor-pointer grid grid-cols-1 gap-3 px-6 py-3.5 transition ${
          hasSide ? SPLIT_ROW_GRID_CLASS : ROW_GRID_CLASS
        } ${
          isSelected
            ? "bg-zk-tint/50 ring-1 ring-inset ring-zk-accent/40"
            : "hover:bg-zk-tint/30"
        }`}
      >
        {/* Company */}
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-3">
            <TickerLogo symbol={item.symbol} name={item.name} size="sm" />
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
            {group.variants.length > 1 ? (
              <span className="shrink-0 rounded-full border border-zk-border bg-zk-chip px-1.5 py-0.5 text-[10px] font-medium text-zk-text2">
                {group.variants.length} criteria
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 max-w-[46ch] truncate pl-11 text-xs text-zk-muted">
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
            title={
              item.call
                ? (CALL_DESCRIPTIONS[item.call] ?? statusText)
                : statusText
            }
            className={`inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(statusKey)}`}
          >
            {statusText}
          </span>
        </div>

        {/* Value / Buy Range (hidden in split-screen like Linear) */}
        {!hasSide ? (
          <div>
            <span className={`${METRIC_BOX_CLASS} text-zk-text`}>
              {valueOrRangeText}
            </span>
          </div>
        ) : null}

        {/* Return / Score (hidden in split-screen like Linear) */}
        {!hasSide ? (
          <div>
            <span className={`${METRIC_BOX_CLASS} ${returnColorClass}`}>
              {returnOrScoreText}
            </span>
          </div>
        ) : null}

        {/* Action */}
        <div data-row-action="true" className="whitespace-nowrap">
          {!canManageTrades || item.isHeld || !item.call ? (
            <button
              type="button"
              onClick={() => openCompanyPanel(item.id)}
              className="inline-flex items-center whitespace-nowrap rounded-md border border-zk-border bg-zk-bg px-2.5 py-1 text-xs font-medium text-zk-text transition hover:border-zk-accent"
            >
              Details
            </button>
          ) : (
            <TradeButton
              symbol={item.symbol}
              label={item.call === "go" ? "Buy" : "+ Trade"}
              className="inline-flex items-center whitespace-nowrap rounded-md border border-zk-accent bg-zk-accent px-2.5 py-1 text-xs font-semibold text-white transition hover:opacity-90"
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
            <label
              htmlFor="finance-criteria-filter"
              className="text-xs font-medium text-zk-muted"
            >
              Criteria
            </label>
            <div className="relative inline-flex items-center">
              <select
                id="finance-criteria-filter"
                aria-label="Filter by criteria"
                value={activeCriteria?.id ?? ""}
                onChange={(event) => setSelectedCriteriaId(event.target.value)}
                className="cursor-pointer appearance-none rounded-lg border border-zk-border bg-zk-surface py-1.5 pl-3 pr-8 text-xs font-medium text-zk-text transition hover:border-zk-accent focus:outline-none focus:ring-2 focus:ring-zk-accent"
              >
                <option value="">All criteria</option>
                {initialCriteria.map((c) => (
                  <option key={c.id} value={c.id}>
                    {financeCriteriaTitle(c)} (v{c.latestVersion})
                  </option>
                ))}
              </select>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-2.5 text-[11px] text-zk-muted"
              >
                ▾
              </span>
            </div>
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
                  ["go", `Buy / Hold (${counts.go})`],
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
                onClick={() => {
                  const next = !showDemo;
                  setShowDemo(next);
                  if (!next && selectedItem?.isDemo) {
                    setSelectedItemId(null);
                  }
                }}
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

          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              {activeCriteria?.latestRun &&
              activeCriteria.latestRun.stage !== "done" &&
              activeCriteria.latestRun.candidateCount === 0 ? (
                <>
                  <p className="text-sm font-medium text-zk-text">
                    Agents are working on this
                  </p>
                  <p className="text-xs text-zk-muted">
                    Your criteria is running — check back in a minute.
                  </p>
                </>
              ) : !activeCriteria &&
                initialCriteria.length > 0 &&
                items.length === 0 &&
                !showDemo ? (
                <>
                  <p className="text-sm font-medium text-zk-text">
                    Agents are working on this
                  </p>
                  <p className="text-xs text-zk-muted">
                    Your criteria is running — check back in a minute.
                  </p>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          ) : (
            <div className={hasSide ? "" : "overflow-x-auto"}>
              <div className={hasSide ? "min-w-0" : "min-w-[760px]"}>
                {/* Column Headers */}
                <div
                  className={`hidden border-b border-zk-divider bg-zk-bg px-6 py-2.5 text-xs font-semibold text-zk-muted ${
                    hasSide ? SPLIT_ROW_GRID_CLASS : ROW_GRID_CLASS
                  }`}
                >
                  <span>Company</span>
                  <span>Price</span>
                  <span>Status</span>
                  {!hasSide ? <span>Value / Range</span> : null}
                  {!hasSide ? <span>Return / Score</span> : null}
                  <span>Action</span>
                </div>

                {/* Owned Group */}
                <div className="border-b border-zk-divider bg-zk-chip/60 px-6 py-2 text-xs font-bold uppercase tracking-wider text-zk-text">
                  Owned ({ownedItems.length})
                </div>
                {ownedItems.length === 0 ? (
                  <p className="border-b border-zk-divider px-6 py-3.5 text-xs text-zk-muted">
                    No owned positions yet — log a trade on any recommendation to
                    track it here.
                  </p>
                ) : (
                  <div className="divide-y divide-zk-divider">
                    {ownedItems.map((group) => renderStockRow(group))}
                  </div>
                )}

                {/* Recommendations Group */}
                <div className="border-y border-zk-divider bg-zk-chip/60 px-6 py-2 text-xs font-bold uppercase tracking-wider text-zk-muted">
                  Recommendations ({recommendationItems.length})
                </div>
                {recommendationItems.length === 0 ? (
                  <p className="px-6 py-3.5 text-xs text-zk-muted">
                    No recommendations match this filter.
                  </p>
                ) : (
                  <div className="divide-y divide-zk-divider">
                    {recommendationItems.map((group) => renderStockRow(group))}
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
            className="lg:col-span-5 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto space-y-4"
          >
            <div className="rounded-2xl border border-zk-border bg-zk-surface p-5 space-y-5">
              {/* Side Panel Header */}
              <div className="flex items-start justify-between gap-3 border-b border-zk-divider pb-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <TickerLogo
                    symbol={selectedItem.symbol}
                    name={selectedItem.name}
                    size="md"
                  />
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
                      {selectedDetail?.criteriaLabel ||
                      selectedItem.criteriaLabel ? (
                        <>
                          {" · "}
                          <span className="text-zk-text2">
                            {selectedDetail?.criteriaLabel ??
                              selectedItem.criteriaLabel}
                            {selectedDetail?.criteriaVersion
                              ? ` (v${selectedDetail.criteriaVersion})`
                              : ""}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close side panel"
                  onClick={() => setSelectedItemId(null)}
                  className="rounded-md border border-zk-border px-2 py-1 text-xs text-zk-muted hover:text-zk-text"
                >
                  ✕
                </button>
              </div>

              {/* Per-criteria Tabs when stock appears in multiple runs */}
              {selectedVariants.length > 1 ? (
                <div
                  role="tablist"
                  aria-label="Criteria runs for this stock"
                  className="flex flex-wrap gap-1.5"
                >
                  {selectedVariants.map((variant) => {
                    const isTabActive = variant.id === selectedItem.id;
                    const tabStage = variant.call
                      ? CALL_LABELS[variant.call] ?? variant.call
                      : STAGE_LABELS[variant.stage] ?? variant.stage;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        role="tab"
                        aria-selected={isTabActive}
                        onClick={() => setSelectedItemId(variant.id)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                          isTabActive
                            ? "border-zk-accent bg-zk-tint text-zk-accent"
                            : "border-zk-border bg-zk-bg text-zk-muted hover:text-zk-text"
                        }`}
                      >
                        {variant.criteriaLabel ?? "Criteria"} · {tabStage}
                      </button>
                    );
                  })}
                </div>
              ) : null}

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
                          {selectedDetail?.decision
                            ? selectedDetail.buyRange ??
                              selectedItem.buyRange ??
                              "—"
                            : (selectedDetail?.evaluations.length ?? 0) > 0
                              ? `${selectedDetail!.evaluations.length} of ${selectedItem.evaluationTotal ?? 5} evaluated`
                              : "—"}
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

                {/* Trade Action (super_admin only, once a decision exists or position is held) */}
                {canManageTrades &&
                (selectedItem.isHeld || Boolean(selectedDetail?.decision)) ? (
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
                ) : null}

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
                    screening={selectedDetail.screening}
                    activity={selectedDetail.activity}
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
        onSaved={(criteriaId) => {
          setSelectedCriteriaId(criteriaId);
          setShowDemo(false);
          setFilter("all");
          setSearch("");
        }}
      />
    </>
  );
}
