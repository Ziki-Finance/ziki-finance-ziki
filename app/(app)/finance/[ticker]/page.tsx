import Link from "next/link";
import { notFound } from "next/navigation";
import { optionalUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { FINANCE_PATH, normalizeSymbol } from "@/lib/finance";
import { requireFinanceOwner } from "@/lib/finance/owner";
import { portfolioForOwner } from "@/lib/finance/portfolio";
import {
  EVAL_CALL_LABEL,
  SOURCE_TIER_LABEL,
  candidateForTicker,
  overallVerdict,
  scoreBreakdown,
  sectionStatuses,
  type SectionStatus,
} from "@/lib/finance/pipeline";
import { findDemoStock } from "@/lib/finance/demo-stocks";
import {
  FreshCheckButton,
  TradeButton,
} from "@/components/finance/portfolio-card";
import { FinanceTickerPipeline } from "@/components/finance/finance-ticker-pipeline";

export const dynamic = "force-dynamic";

const CALL_LABELS: Record<string, string> = {
  go: "Go",
  no_go: "No-go",
  keep: "Keep",
  trim: "Trim",
  sell: "Sell",
};

const STAGE_LABEL: Record<string, string> = {
  screen: "Screen",
  enrich: "Enrich",
  evaluate: "Evaluate",
  review: "Review",
  decide: "Decide",
  done: "Done",
};

const REASON_LABELS: Record<string, string> = {
  holds: "Holds",
  weakening: "Weakening",
  broken: "Broken",
  not_checked: "Not checked yet",
};

function reasonBadgeClass(status: string): string {
  if (status === "holds") return "bg-zk-ok-bg text-zk-ok-fg";
  if (status === "weakening") return "bg-zk-warn-bg text-zk-warn-fg";
  if (status === "broken") return "bg-zk-bad-bg text-zk-bad-fg";
  return "border border-zk-border bg-zk-chip text-zk-muted";
}

function money(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return `$${Number(value).toFixed(2)}`;
}

function formatMoneyNumber(value: number | null): string {
  if (value === null) return "Awaiting price";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** Stock detail view: header + Your Position (or Recommendation) + clickable 4-stage pipeline. */
export default async function FinanceTickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const user = await optionalUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 py-10">
        <p className="text-sm text-zk-text2">
          Sign in to see this stock&apos;s research.
        </p>
        <Link
          href="/login?callbackUrl=%2Ffinance"
          className="text-sm font-medium text-zk-accent"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const [{ ticker: rawTicker }, { demo }] = await Promise.all([
    params,
    searchParams,
  ]);
  const owner = await requireFinanceOwner();
  const symbol = normalizeSymbol(decodeURIComponent(rawTicker));
  if (!symbol) notFound();

  const portfolio = await portfolioForOwner(prisma, owner.id);
  const holding =
    portfolio.positions.find((p) => p.symbol === symbol) ?? null;

  const demoStock = demo === "1" ? findDemoStock(symbol) : null;
  if (demoStock) {
    const demoCall = demoStock.item.call;
    const demoBadgeLabel = demoCall
      ? CALL_LABELS[demoCall] ?? demoCall
      : STAGE_LABEL[demoStock.item.stage] ?? demoStock.item.stage;
    const demoBadgeClass =
      demoCall === "no_go" || demoCall === "sell"
        ? "bg-zk-bad-bg text-zk-bad-fg"
        : demoCall === "trim"
          ? "bg-zk-warn-bg text-zk-warn-fg"
          : demoCall
            ? "bg-zk-ok-bg text-zk-ok-fg"
            : "bg-zk-tint text-zk-accent";

    return (
      <div className="mx-auto max-w-5xl space-y-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zk-accent/40 bg-zk-tint/50 px-4 py-2.5 text-xs">
          <span className="font-medium text-zk-text">
            Demo preview — sample data only (not saved to your database).
          </span>
          <Link
            href={FINANCE_PATH}
            className="font-semibold text-zk-accent hover:underline"
          >
            ← Back to Finance
          </Link>
        </div>

        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-zk-border bg-zk-surface p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zk-border bg-zk-bg text-sm font-bold text-zk-accent">
              {symbol.slice(0, 2)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-extrabold tracking-tight text-zk-text">
                  {demoStock.item.name}
                </h1>
                <span className="font-mono text-xs text-zk-muted">{symbol}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${demoBadgeClass}`}
                >
                  {demoBadgeLabel}
                </span>
                <span className="rounded-full border border-zk-accent/40 bg-zk-tint px-2.5 py-0.5 text-xs font-medium text-zk-accent">
                  Demo
                </span>
              </div>
              <p className="mt-1 text-xs text-zk-muted">
                {demoStock.criteriaLabel} · criteria v{demoStock.criteriaVersion}
              </p>
            </div>
          </div>
          <TradeButton symbol={symbol} label={`+ Log a trade (${symbol})`} />
        </header>

        {holding ? (
          <section
            aria-label="Your Position"
            className="rounded-2xl border border-zk-border bg-zk-surface p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-base font-bold text-zk-text">
                  Your Position
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${reasonBadgeClass(holding.reasonStatus)}`}
                >
                  Thesis: {REASON_LABELS[holding.reasonStatus]}
                </span>
              </div>
              <FreshCheckButton holdingId={holding.id} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-zk-border bg-zk-bg p-3.5">
                <p className="text-[11px] uppercase tracking-wide text-zk-muted">
                  Value
                </p>
                <p className="mt-1 text-base font-bold tabular-nums text-zk-text">
                  {formatMoneyNumber(holding.value)}
                </p>
              </div>
              <div className="rounded-xl border border-zk-border bg-zk-bg p-3.5">
                <p className="text-[11px] uppercase tracking-wide text-zk-muted">
                  Shares &amp; Avg cost
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-zk-text">
                  {holding.shares} @{" "}
                  {holding.averageCost === null
                    ? "—"
                    : `$${Number(holding.averageCost).toFixed(2)}`}
                </p>
              </div>
              <div className="rounded-xl border border-zk-border bg-zk-bg p-3.5">
                <p className="text-[11px] uppercase tracking-wide text-zk-muted">
                  Gain
                </p>
                <p className="mt-1 text-base font-bold tabular-nums text-zk-muted">
                  {formatPct(holding.gainPct)}
                </p>
              </div>
              <div className="rounded-xl border border-zk-border bg-zk-bg p-3.5">
                <p className="text-[11px] uppercase tracking-wide text-zk-muted">
                  S&amp;P 500
                </p>
                <p className="mt-1 text-base font-bold tabular-nums text-zk-muted">
                  {formatPct(holding.benchmarkGainPct)}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section
            aria-label="Recommendation"
            className="rounded-2xl border border-zk-border bg-zk-surface p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-zk-text">
                  Recommendation
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${demoBadgeClass}`}
                >
                  {demoBadgeLabel}
                </span>
              </div>
              {demoStock.item.reviewGo !== null &&
              demoStock.item.reviewTotal !== null ? (
                <span className="text-xs text-zk-muted">
                  Reviewers: {demoStock.item.reviewGo} Go /{" "}
                  {demoStock.item.reviewTotal - demoStock.item.reviewGo} No-go
                </span>
              ) : (
                <span className="text-xs text-zk-muted">In pipeline</span>
              )}
            </div>
            <p className="text-sm font-medium leading-relaxed text-zk-text">
              {demoStock.item.summary}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zk-border bg-zk-bg p-3">
                <p className="text-[10px] uppercase tracking-wide text-zk-muted">
                  Buy range
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-zk-text">
                  {demoStock.buyRange}
                </p>
              </div>
              <div className="rounded-xl border border-zk-border bg-zk-bg p-3">
                <p className="text-[10px] uppercase tracking-wide text-zk-muted">
                  Review if below
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-zk-text">
                  {demoStock.reviewIfBelow}
                </p>
              </div>
              <div className="rounded-xl border border-zk-border bg-zk-bg p-3">
                <p className="text-[10px] uppercase tracking-wide text-zk-muted">
                  Hold for
                </p>
                <p className="mt-1 text-sm font-semibold text-zk-text">
                  {demoStock.holdFor}
                </p>
              </div>
            </div>
          </section>
        )}

        <FinanceTickerPipeline
          symbol={symbol}
          currentStage={demoStock.item.stage}
          criteriaLabel={demoStock.criteriaLabel}
          criteriaVersion={demoStock.criteriaVersion}
          proposedCount={demoStock.proposedCount}
          sectionsCovered={demoStock.sectionsCovered}
          isDemo
          evidence={demoStock.evidence}
          evaluations={demoStock.evaluations}
          breakdown={demoStock.breakdown}
          overallVerdictLabel={demoStock.overallVerdictLabel}
          overallVerdictKey={demoStock.overallVerdictKey}
          decision={demoStock.decision}
        />
      </div>
    );
  }

  const decision = await prisma.financeDecision.findFirst({
    where: {
      ticker: { symbol },
      OR: [
        { candidateId: { not: null } },
        { check: { holding: { userId: owner.id } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      candidate: {
        include: {
          run: true,
          reviews: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  const found = await candidateForTicker(
    prisma,
    symbol,
    decision?.candidateId ?? undefined,
  );
  if (!found) notFound();

  const { ticker, candidate } = found;

  const badgeLabel = decision
    ? CALL_LABELS[decision.call] ?? decision.call
    : candidate
      ? STAGE_LABEL[candidate.stage] ?? candidate.stage
      : "Tracked";

  const badgeClass =
    decision?.call === "no_go" || decision?.call === "sell"
      ? "bg-zk-bad-bg text-zk-bad-fg"
      : decision?.call === "trim"
        ? "bg-zk-warn-bg text-zk-warn-fg"
        : decision
          ? "bg-zk-ok-bg text-zk-ok-fg"
          : "bg-zk-tint text-zk-accent";

  const breakdown = candidate
    ? scoreBreakdown(candidate.evaluations)
    : {
        total: 0,
        buy: 0,
        hold: 0,
        dontBuy: 0,
        against: 0,
        averageConfidence: null,
      };
  const verdict = overallVerdict(breakdown);
  const statuses: SectionStatus[] = candidate
    ? sectionStatuses(candidate.evidence)
    : [];
  const evidenceById = new Map(
    (candidate?.evidence ?? []).map((item) => [item.id, item] as const),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <Link
        href={FINANCE_PATH}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zk-muted hover:text-zk-text"
      >
        ← Back to Finance
      </Link>

      {/* 1. Stock Header */}
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-zk-border bg-zk-surface p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zk-border bg-zk-bg text-sm font-bold text-zk-accent">
            {symbol.slice(0, 2)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-extrabold tracking-tight text-zk-text">
                {ticker.name}
              </h1>
              <span className="font-mono text-xs text-zk-muted">{symbol}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
              >
                {badgeLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-zk-muted">
              {candidate
                ? `${candidate.run.criteriaLabel} · criteria v${candidate.run.criteriaVersion}`
                : "Added to your portfolio"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TradeButton
            symbol={symbol}
            decisionId={decision?.id}
            label={`+ Log a trade (${symbol})`}
          />
        </div>
      </header>

      {/* 2. Priority Card: Your Position (if held) OR Recommendation (if not held) */}
      {holding ? (
        <section
          aria-label="Your Position"
          className="rounded-2xl border border-zk-border bg-zk-surface p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-bold text-zk-text">
                Your Position
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${reasonBadgeClass(holding.reasonStatus)}`}
              >
                Thesis: {REASON_LABELS[holding.reasonStatus]}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-zk-muted">
                Next check:{" "}
                {holding.nextCheck
                  ? new Date(holding.nextCheck).toLocaleDateString()
                  : "Pending"}
              </span>
              <FreshCheckButton holdingId={holding.id} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zk-border bg-zk-bg p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-zk-muted">
                Value
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-zk-text">
                {formatMoneyNumber(holding.value)}
              </p>
            </div>
            <div className="rounded-xl border border-zk-border bg-zk-bg p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-zk-muted">
                Shares &amp; Avg cost
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-zk-text">
                {holding.shares} @{" "}
                {holding.averageCost === null
                  ? "—"
                  : `$${Number(holding.averageCost).toFixed(2)}`}
              </p>
            </div>
            <div className="rounded-xl border border-zk-border bg-zk-bg p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-zk-muted">
                Gain
              </p>
              <p
                className={`mt-1 text-base font-bold tabular-nums ${
                  holding.gainPct === null
                    ? "text-zk-muted"
                    : holding.gainPct >= 0
                      ? "text-zk-ok-fg"
                      : "text-zk-bad-fg"
                }`}
              >
                {formatPct(holding.gainPct)}
              </p>
            </div>
            <div className="rounded-xl border border-zk-border bg-zk-bg p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-zk-muted">
                S&amp;P 500
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-zk-text">
                {formatPct(holding.benchmarkGainPct)}
              </p>
            </div>
          </div>

          {holding.reasonPoints.length > 0 && (
            <div className="border-t border-zk-divider pt-3">
              <p className="text-xs font-semibold text-zk-text mb-2">
                Reasons for holding
              </p>
              <ul className="space-y-1.5 list-disc pl-5 text-xs text-zk-text2">
                {holding.reasonPoints.map((pt) => (
                  <li key={pt.id}>
                    {pt.main ? (
                      <span className="font-semibold text-zk-text">Main: </span>
                    ) : null}
                    {pt.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : decision ? (
        <section
          aria-label="Recommendation"
          className="rounded-2xl border border-zk-border bg-zk-surface p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-zk-text">
                Recommendation
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
              >
                {badgeLabel}
              </span>
            </div>
            {decision.origin !== "monitor" && (
              <span className="text-xs text-zk-muted">
                Reviewers: {decision.reviewGo} Go /{" "}
                {decision.reviewTotal - decision.reviewGo} No-go
              </span>
            )}
          </div>
          <p className="text-sm font-medium leading-relaxed text-zk-text">
            {decision.sentence}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zk-border bg-zk-bg p-3">
              <p className="text-[10px] uppercase tracking-wide text-zk-muted">
                Buy range
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-zk-text">
                {money(decision.buyRangeLow) ?? "—"} –{" "}
                {money(decision.buyRangeHigh) ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-zk-border bg-zk-bg p-3">
              <p className="text-[10px] uppercase tracking-wide text-zk-muted">
                Review if below
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-zk-text">
                {money(decision.reviewIfBelow) ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-zk-border bg-zk-bg p-3">
              <p className="text-[10px] uppercase tracking-wide text-zk-muted">
                Hold for
              </p>
              <p className="mt-1 text-sm font-semibold text-zk-text">
                {decision.holdDuration ?? "—"}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* 3. Clickable 4-Stage Research Pipeline */}
      {candidate ? (
        <FinanceTickerPipeline
          symbol={symbol}
          currentStage={candidate.stage}
          criteriaLabel={candidate.run.criteriaLabel}
          criteriaVersion={candidate.run.criteriaVersion}
          proposedCount={candidate.proposedCount}
          sectionsCovered={statuses.filter((s) => s.done).length}
          evidence={candidate.evidence.map((item) => ({
            id: item.id,
            section: item.section,
            summary: item.summary,
            tier: item.tier,
            tierLabel: SOURCE_TIER_LABEL[item.tier] ?? "Other",
            codeChecked: item.codeChecked,
            codeCheckNote: item.codeCheckNote,
            url: item.url,
          }))}
          evaluations={candidate.evaluations.map((ev) => ({
            id: ev.id,
            call: ev.call,
            callLabel: EVAL_CALL_LABEL[ev.call],
            against: ev.against,
            confidence: ev.confidence,
            createdAt: ev.createdAt.toISOString().slice(0, 10),
            reasons: ev.reasons,
            risks: ev.risks,
            changeMind: ev.changeMind,
            buyRangeLow: money(ev.buyRangeLow),
            buyRangeHigh: money(ev.buyRangeHigh),
            reviewIfBelow: money(ev.reviewIfBelow),
            holdDuration: ev.holdDuration,
            citedCount: ev.citedEvidenceIds.filter((id) =>
              evidenceById.has(id),
            ).length,
          }))}
          breakdown={breakdown}
          overallVerdictLabel={EVAL_CALL_LABEL[verdict]}
          overallVerdictKey={verdict}
          decision={
            decision
              ? {
                  id: decision.id,
                  call: decision.call,
                  origin: decision.origin,
                  actorLabel: decision.actorLabel,
                  sentence: decision.sentence,
                  reviewGo: decision.reviewGo,
                  reviewTotal: decision.reviewTotal,
                  reasons: decision.reasons,
                  answerAgainst: decision.answerAgainst,
                  answerDissent: decision.answerDissent,
                  changeMind: decision.changeMind,
                  reviews: (decision.candidate?.reviews ?? []).map((r) => ({
                    id: r.id,
                    actorLabel: r.actorLabel,
                    call: r.call,
                    summary: r.summary,
                    answerAgainst: r.answerAgainst,
                  })),
                }
              : null
          }
        />
      ) : (
        <section className="rounded-2xl border border-dashed border-zk-border bg-zk-surface p-6 text-center">
          <p className="text-xs text-zk-muted">
            No agent research pipeline has run for {symbol} yet.
          </p>
        </section>
      )}
    </div>
  );
}
