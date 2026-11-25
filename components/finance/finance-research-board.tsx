"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FinanceCriteriaView } from "@/lib/finance/criteria";
import { financeCriteriaTitle } from "@/lib/validations/finance";
import {
  CriteriaModal,
  FinanceCriteriaManager,
} from "./finance-criteria-manager";

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

function callBadgeClass(call: string | null): string {
  if (call === "go" || call === "keep") {
    return "bg-zk-ok-bg text-zk-ok-fg";
  }
  if (call === "trim") {
    return "bg-zk-warn-bg text-zk-warn-fg";
  }
  if (call === "no_go" || call === "sell") {
    return "bg-zk-bad-bg text-zk-bad-fg";
  }
  return "bg-zk-tint text-zk-accent";
}

function money(value: number | null): string {
  if (value === null) return "Awaiting prices";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function FinanceResearchBoard({
  initialCriteria,
  items,
  portfolioTotalValue,
  holdingsCount,
}: {
  initialCriteria: FinanceCriteriaView[];
  items: ResearchStockItem[];
  portfolioTotalValue: number | null;
  holdingsCount: number;
}) {
  const [selectedCriteriaId, setSelectedCriteriaId] = useState<string | null>(
    initialCriteria[0]?.id ?? null,
  );
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCriteria, setEditingCriteria] =
    useState<FinanceCriteriaView | null>(null);

  const activeCriteria =
    initialCriteria.find((c) => c.id === selectedCriteriaId) ??
    initialCriteria[0] ??
    null;

  const counts = useMemo(
    () => ({
      all: items.length,
      needs_you: items.filter((i) => i.bucket === "needs_you").length,
      go: items.filter((i) => i.call === "go" || i.call === "keep").length,
      in_progress: items.filter((i) => i.bucket === "in_progress").length,
      not_now: items.filter((i) => i.bucket === "not_now").length,
    }),
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
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
  }, [items, filter, search]);

  function openNewModal() {
    setEditingCriteria(null);
    setModalOpen(true);
  }

  function openEditModal(item: FinanceCriteriaView) {
    setEditingCriteria(item);
    setModalOpen(true);
  }

  return (
    <>
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">
            Finance
          </h1>
          <p className="mt-1 text-xs text-zk-muted">
            Researched equities, agent verdicts, and live portfolio thesis
            tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {initialCriteria.length > 0 ? (
            <select
              aria-label="Active strategy"
              value={activeCriteria?.id ?? ""}
              onChange={(event) => setSelectedCriteriaId(event.target.value)}
              className="rounded-lg border border-zk-border bg-zk-surface px-3 py-2 text-xs font-medium text-zk-text focus:outline-none focus:ring-2 focus:ring-zk-accent"
            >
              {initialCriteria.map((c) => (
                <option key={c.id} value={c.id}>
                  Strategy: {financeCriteriaTitle(c)} (v{c.latestVersion})
                </option>
              ))}
            </select>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            aria-expanded={criteriaOpen}
            onClick={() => setCriteriaOpen((prev) => !prev)}
          >
            Criteria ({initialCriteria.length}) {criteriaOpen ? "▴" : "▾"}
          </Button>
          <Button type="button" onClick={openNewModal}>
            + New criteria
          </Button>
        </div>
      </header>

      {/* KPI Summary Strip */}
      <section
        aria-label="Finance summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <div className="rounded-xl border border-zk-border bg-zk-surface p-4">
          <p className="text-xs text-zk-muted">Portfolio value</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-zk-text">
            {money(portfolioTotalValue)}
          </p>
          <p className="mt-1 text-xs text-zk-muted">
            {holdingsCount} {holdingsCount === 1 ? "holding" : "holdings"}
          </p>
        </div>

        <div
          className={`rounded-xl border bg-zk-surface p-4 ${
            counts.needs_you > 0 ? "border-zk-accent/50" : "border-zk-border"
          }`}
        >
          <p className="text-xs text-zk-muted">Needs your call</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-zk-text">
            {counts.needs_you} {counts.needs_you === 1 ? "stock" : "stocks"}
          </p>
          <p
            className={`mt-1 text-xs ${
              counts.needs_you > 0 ? "text-zk-accent" : "text-zk-muted"
            }`}
          >
            {counts.needs_you > 0 ? "Ready for decision" : "All caught up"}
          </p>
        </div>

        <div className="rounded-xl border border-zk-border bg-zk-surface p-4">
          <p className="text-xs text-zk-muted">Researched universe</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-zk-text">
            {counts.all} {counts.all === 1 ? "company" : "companies"}
          </p>
          <p className="mt-1 text-xs text-zk-muted">
            {counts.go} Go/Keep · {counts.in_progress} In progress
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            activeCriteria ? openEditModal(activeCriteria) : openNewModal()
          }
          className="rounded-xl border border-zk-border bg-zk-surface p-4 text-left transition hover:border-zk-accent/60"
        >
          <p className="text-xs text-zk-muted">Active criteria</p>
          <p className="mt-1.5 truncate text-sm font-bold text-zk-text">
            {activeCriteria
              ? financeCriteriaTitle(activeCriteria)
              : "None set yet"}
          </p>
          <p className="mt-1 text-xs text-zk-muted">
            {activeCriteria
              ? `v${activeCriteria.latestVersion} · Click to edit`
              : "Click to create"}
          </p>
        </button>
      </section>

      {/* Main Workspace: Researched Stocks (Full-width when Criteria collapsed, 2-col when expanded) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <section
          aria-label="Stock Research and Analysis"
          className={`${
            criteriaOpen ? "lg:col-span-8" : "lg:col-span-12"
          } rounded-2xl border border-zk-border bg-zk-surface p-5 space-y-4`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-zk-text">
                Stock Research &amp; Analysis
              </h2>
              <p className="text-xs text-zk-muted">
                Select any company to step through its research pipeline,
                thesis, and log a trade.
              </p>
            </div>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter ticker or thesis…"
              className="w-full rounded-lg border border-zk-border bg-zk-bg px-3 py-1.5 text-xs text-zk-text placeholder:text-zk-muted focus:border-zk-accent focus:outline-none sm:w-52"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-zk-divider pb-3">
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

          {filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zk-border bg-zk-bg p-8 text-center space-y-2">
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
            <ul className="divide-y divide-zk-divider">
              {filteredItems.map((item) => {
                const badgeText = item.call
                  ? CALL_LABELS[item.call] ?? item.call
                  : STAGE_LABELS[item.stage] ?? item.stage;
                return (
                  <li key={item.id}>
                    <Link
                      href={`/finance/${encodeURIComponent(item.symbol)}`}
                      className="group -mx-2 flex flex-col justify-between gap-3 rounded-xl px-2 py-3.5 transition hover:bg-zk-tint/50 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zk-border bg-zk-bg text-xs font-bold text-zk-accent">
                          {item.symbol.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-zk-text group-hover:text-zk-accent">
                              {item.name}
                            </span>
                            <span className="font-mono text-xs text-zk-muted">
                              {item.symbol}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${callBadgeClass(item.call)}`}
                            >
                              {badgeText}
                            </span>
                            {item.isHeld ? (
                              <span className="rounded-full border border-zk-border bg-zk-chip px-2 py-0.5 text-[11px] text-zk-text2">
                                Held
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs text-zk-muted">
                            {item.summary}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-4 pl-12 sm:justify-end sm:pl-0">
                        {item.reviewGo !== null && item.reviewTotal !== null ? (
                          <span className="text-xs tabular-nums text-zk-muted">
                            {item.origin === "monitor"
                              ? "Reason check"
                              : `${item.reviewGo}/${item.reviewTotal} Go`}
                          </span>
                        ) : (
                          <span className="text-xs text-zk-muted">
                            In pipeline
                          </span>
                        )}
                        <span className="text-xs font-semibold text-zk-accent">
                          Open →
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Collapsible Right Side Rail: Criteria */}
        {criteriaOpen ? (
          <aside className="lg:col-span-4 space-y-4">
            <FinanceCriteriaManager
              initialCriteria={initialCriteria}
              activeCriteriaId={activeCriteria?.id ?? null}
              onSelectCriteria={(id) => setSelectedCriteriaId(id)}
              onOpenNew={openNewModal}
              onOpenEdit={openEditModal}
            />
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
