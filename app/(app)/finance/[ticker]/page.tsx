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

  if (demo === "1" && symbol === "MSFT") {
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
              MS
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-extrabold tracking-tight text-zk-text">
                  Microsoft
                </h1>
                <span className="font-mono text-xs text-zk-muted">MSFT</span>
                <span className="rounded-full bg-zk-ok-bg px-2.5 py-0.5 text-xs font-medium text-zk-ok-fg">
                  Go
                </span>
                <span className="rounded-full border border-zk-accent/40 bg-zk-tint px-2.5 py-0.5 text-xs font-medium text-zk-accent">
                  Demo
                </span>
              </div>
              <p className="mt-1 text-xs text-zk-muted">
                Quality at a fair price · criteria v1
              </p>
            </div>
          </div>
          <TradeButton symbol="MSFT" label="+ Log a trade (MSFT)" />
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
                <span className="rounded-full bg-zk-ok-bg px-2.5 py-0.5 text-xs font-medium text-zk-ok-fg">
                  Go
                </span>
              </div>
              <span className="text-xs text-zk-muted">
                Reviewers: 4 Go / 1 No-go
              </span>
            </div>
            <p className="text-sm font-medium leading-relaxed text-zk-text">
              Durable enterprise cloud moat, 35% ROIC, and disciplined capital
              return.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zk-border bg-zk-bg p-3">
                <p className="text-[10px] uppercase tracking-wide text-zk-muted">
                  Buy range
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-zk-text">
                  $395.00 – $435.00
                </p>
              </div>
              <div className="rounded-xl border border-zk-border bg-zk-bg p-3">
                <p className="text-[10px] uppercase tracking-wide text-zk-muted">
                  Review if below
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-zk-text">
                  $365.00
                </p>
              </div>
              <div className="rounded-xl border border-zk-border bg-zk-bg p-3">
                <p className="text-[10px] uppercase tracking-wide text-zk-muted">
                  Hold for
                </p>
                <p className="mt-1 text-sm font-semibold text-zk-text">
                  5+ years
                </p>
              </div>
            </div>
          </section>
        )}

        <FinanceTickerPipeline
          symbol="MSFT"
          currentStage="done"
          criteriaLabel="Quality at a fair price"
          criteriaVersion={1}
          proposedCount={2}
          sectionsCovered={4}
          isDemo
          evidence={[
            {
              id: "demo-ev-1",
              section: "business",
              summary:
                "Azure and Microsoft 365 create high enterprise switching costs with >42% operating margins.",
              tier: 1,
              tierLabel: "SEC Filing",
              codeChecked: true,
              codeCheckNote: "Verified against FY26 10-K",
              url: "https://www.sec.gov",
            },
            {
              id: "demo-ev-2",
              section: "numbers",
              summary:
                "Free cash flow margin above 30% with net cash position funding AI infrastructure capex.",
              tier: 1,
              tierLabel: "Financials",
              codeChecked: true,
              codeCheckNote: null,
              url: "https://www.sec.gov",
            },
            {
              id: "demo-ev-3",
              section: "filings",
              summary:
                "10-K highlights $80B+ annual capex commitment for data-center expansion.",
              tier: 1,
              tierLabel: "SEC Filing",
              codeChecked: false,
              codeCheckNote: null,
              url: "https://www.sec.gov",
            },
            {
              id: "demo-ev-4",
              section: "news",
              summary:
                "Commercial cloud backlog grew 22% YoY driven by enterprise Copilot adoption.",
              tier: 2,
              tierLabel: "News",
              codeChecked: false,
              codeCheckNote: null,
              url: "https://www.sec.gov",
            },
          ]}
          evaluations={[
            {
              id: "demo-eval-1",
              call: "buy",
              callLabel: "Buy",
              against: false,
              confidence: 86,
              createdAt: "2026-11-25",
              reasons: [
                "Enterprise cloud + productivity lock-in supports durable double-digit FCF compounding.",
                "Balance sheet remains net-cash despite elevated AI capex.",
              ],
              risks: ["AI monetization lagging data-center depreciation."],
              changeMind:
                "Operating margin falling below 38% for two consecutive quarters.",
              buyRangeLow: "$395.00",
              buyRangeHigh: "$435.00",
              reviewIfBelow: "$365.00",
              holdDuration: "5+ years",
              citedCount: 4,
            },
            {
              id: "demo-eval-2",
              call: "hold",
              callLabel: "Hold",
              against: true,
              confidence: 71,
              createdAt: "2026-11-25",
              reasons: [
                "Capex intensity reduces near-term free cash flow conversion.",
              ],
              risks: ["Multiple compression if Azure growth slows below 20%."],
              changeMind: "Clear acceleration in AI software gross margins.",
              buyRangeLow: "$370.00",
              buyRangeHigh: "$400.00",
              reviewIfBelow: "$350.00",
              holdDuration: "3–5 years",
              citedCount: 3,
            },
          ]}
          breakdown={{
            total: 2,
            buy: 1,
            hold: 1,
            dontBuy: 0,
            against: 1,
            averageConfidence: 79,
          }}
          overallVerdictLabel="Buy"
          overallVerdictKey="buy"
          decision={{
            id: "demo-decision",
            call: "go",
            origin: "review",
            actorLabel: "Finance Committee",
            sentence:
              "Durable enterprise cloud moat, 35% ROIC, and disciplined capital return.",
            reviewGo: 4,
            reviewTotal: 5,
            reasons: [
              "High-margin recurring enterprise software & cloud infrastructure.",
              "Consistent dividend growth and share repurchases backed by FCF.",
            ],
            answerAgainst:
              "Elevated AI capex is funded organically from operating cash flow without taking on net debt.",
            answerDissent:
              "1 reviewer preferred waiting for a pullback toward $395 due to near-term capex drag.",
            changeMind:
              "Sustained Azure deceleration below 18% YoY or operating margin compression below 38%.",
            reviews: [
              {
                id: "demo-rev-1",
                actorLabel: "Reviewer A",
                call: "go",
                summary: "Strongest balance sheet in megacap tech.",
                answerAgainst: "Capex is high-ROIC contracted demand.",
              },
              {
                id: "demo-rev-2",
                actorLabel: "Reviewer B",
                call: "no_go",
                summary: "Valuation leaves modest margin of safety.",
                answerAgainst: "Would revisit below $395.",
              },
            ],
          }}
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
