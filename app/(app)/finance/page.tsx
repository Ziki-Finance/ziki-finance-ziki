import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { isFinanceOwner, requireFinanceOwner } from "@/lib/finance/owner";
import { listFinanceCriteria } from "@/lib/finance/criteria";
import { decisionsForOwner } from "@/lib/finance/decisions";
import { portfolioForOwner } from "@/lib/finance/portfolio";
import {
  EVAL_CALL_LABEL,
  SOURCE_TIER_LABEL,
  overallVerdict,
  scoreBreakdown,
} from "@/lib/finance/pipeline";
import type { FinanceEvidenceSectionName } from "@/lib/finance/pipeline-settings";
import {
  activityView,
  candidateStageViewSelect,
  screeningView,
  type CandidateStageViewRow,
} from "@/lib/finance/stage-view";
import {
  FinanceResearchBoard,
  type ResearchStockItem,
  type ResearchStockPosition,
  type TickerPanelDetail,
} from "@/components/finance/finance-research-board";
import { FinanceLiveRefresh } from "@/components/finance/live-refresh";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finance",
  robots: { index: false, follow: false, nocache: true },
};

function moneyStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return `$${Number(value).toFixed(2)}`;
}

function formatBuyRange(low: unknown, high: unknown): string | null {
  const lowStr = moneyStr(low);
  const highStr = moneyStr(high);
  if (lowStr && highStr) return `${lowStr} – ${highStr}`;
  if (lowStr) return `From ${lowStr}`;
  if (highStr) return `Up to ${highStr}`;
  return null;
}

function evaluationLevels(
  evaluations: ReadonlyArray<{
    buyRangeLow: unknown;
    buyRangeHigh: unknown;
    reviewIfBelow: unknown;
    holdDuration: string;
  }>,
) {
  for (let i = evaluations.length - 1; i >= 0; i -= 1) {
    const ev = evaluations[i];
    const buyRange = formatBuyRange(ev.buyRangeLow, ev.buyRangeHigh);
    if (buyRange || ev.reviewIfBelow !== null || ev.holdDuration) {
      return {
        buyRange,
        reviewIfBelow: moneyStr(ev.reviewIfBelow),
        holdFor: ev.holdDuration || null,
      };
    }
  }
  return { buyRange: null, reviewIfBelow: null, holdFor: null };
}

export default async function FinancePage() {
  const user = await requireFinanceOwner();
  const canManageTrades = isFinanceOwner(user);
  const ownerAccount = canManageTrades
    ? { id: user.id }
    : await prisma.user.findFirst({
        where: { role: "super_admin" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
  const portfolioOwnerId = ownerAccount?.id ?? user.id;
  let criteria: Awaited<ReturnType<typeof listFinanceCriteria>>;
  let decisions: Awaited<ReturnType<typeof decisionsForOwner>>;
  let portfolio: Awaited<ReturnType<typeof portfolioForOwner>>;
  let runs: Array<{
    id: string;
    criteriaId: string | null;
    criteriaLabel: string;
    criteriaVersion: number;
    candidates: Array<CandidateStageViewRow & {
      id: string;
      stage: string;
      proposedCount: number;
      tickerSymbol: string | null;
      companyName: string | null;
      ticker: { symbol: string; name: string } | null;
      decision: { id: string } | null;
      evidence: Array<{
        id: string;
        section: FinanceEvidenceSectionName;
        summary: string;
        tier: number;
        codeChecked: boolean;
        codeCheckNote: string | null;
        url: string;
      }>;
      evaluations: Array<{
        id: string;
        call: "buy" | "hold" | "dont_buy";
        against: boolean;
        confidence: number;
        createdAt: Date;
        reasons: string[];
        risks: string[];
        changeMind: string;
        buyRangeLow: unknown;
        buyRangeHigh: unknown;
        reviewIfBelow: unknown;
        holdDuration: string;
        citedEvidenceIds: string[];
      }>;
      reviews: Array<{
        id: string;
        actorLabel: string;
        call: string;
        summary: string;
        answerAgainst: string;
      }>;
    }>;
  }>;

  try {
    [criteria, runs, decisions, portfolio] = await Promise.all([
      listFinanceCriteria(user.id),
      prisma.financeRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          criteriaId: true,
          criteriaLabel: true,
          criteriaVersion: true,
          candidates: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              stage: true,
              proposedCount: true,
              tickerSymbol: true,
              companyName: true,
              ticker: { select: { symbol: true, name: true } },
              decision: { select: { id: true } },
              ...candidateStageViewSelect,
              evidence: {
                select: {
                  id: true,
                  section: true,
                  summary: true,
                  tier: true,
                  codeChecked: true,
                  codeCheckNote: true,
                  url: true,
                },
              },
              evaluations: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  call: true,
                  against: true,
                  confidence: true,
                  createdAt: true,
                  reasons: true,
                  risks: true,
                  changeMind: true,
                  buyRangeLow: true,
                  buyRangeHigh: true,
                  reviewIfBelow: true,
                  holdDuration: true,
                  citedEvidenceIds: true,
                },
              },
              reviews: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  actorLabel: true,
                  call: true,
                  summary: true,
                  answerAgainst: true,
                },
              },
            },
          },
        },
      }),
      decisionsForOwner(prisma, portfolioOwnerId),
      portfolioForOwner(prisma, portfolioOwnerId),
    ]);
  } catch (err) {
    const message =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[finance:page]", message, err);
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-zk-bad-fg/30 bg-zk-surface p-6">
        <h1 className="text-lg font-bold text-zk-text">
          Finance failed to load
        </h1>
        <pre className="mt-3 whitespace-pre-wrap text-xs text-zk-bad-fg">
          {message}
        </pre>
      </div>
    );
  }

  const heldSymbols = new Set(portfolio.positions.map((p) => p.symbol));
  const positionBySymbol = new Map<string, ResearchStockPosition>();
  if (canManageTrades) {
    for (const p of portfolio.positions) {
      positionBySymbol.set(p.symbol, {
        holdingId: p.id,
        shares: Number(p.shares),
        averageCost: p.averageCost !== null ? Number(p.averageCost) : null,
        value: p.value,
        gainPct: p.gainPct,
        benchmarkGainPct: p.benchmarkGainPct,
        reasonStatus: p.reasonStatus,
        nextCheck: p.nextCheck,
        reasonPoints: p.reasonPoints.map((pt) => ({
          id: pt.id,
          text: pt.text,
          main: pt.main,
        })),
      });
    }
  }

  const allDecisions = [...decisions.needsYou, ...decisions.notNow];
  const decisionCandidateIds = allDecisions
    .map((d) => d.candidateId)
    .filter((id): id is string => Boolean(id));

  const decisionCandidates =
    decisionCandidateIds.length > 0
      ? await prisma.financeCandidate.findMany({
          where: { id: { in: decisionCandidateIds } },
          include: {
            run: true,
            ticker: { select: { symbol: true, name: true } },
            evidence: true,
            evaluations: { orderBy: { createdAt: "asc" } },
            reviews: { orderBy: { createdAt: "asc" } },
            signals: candidateStageViewSelect.signals,
            jobs: candidateStageViewSelect.jobs,
          },
        })
      : [];
  const candidateById = new Map(decisionCandidates.map((c) => [c.id, c]));

  const researching = runs.flatMap((r) =>
    r.candidates
      .filter((c) => !c.decision)
      .map((c) => ({
        ...c,
        criteriaId: r.criteriaId,
        criteriaLabel: r.criteriaLabel,
        criteriaVersion: r.criteriaVersion,
      })),
  );

  const allSymbols = Array.from(
    new Set([
      ...decisions.needsYou.map((d) => d.ticker.symbol),
      ...decisions.notNow.map((d) => d.ticker.symbol),
      ...researching
        .map((c) => c.ticker?.symbol ?? c.tickerSymbol)
        .filter((s): s is string => Boolean(s)),
      ...portfolio.positions.map((p) => p.symbol),
    ]),
  );

  const latestSnapshots =
    allSymbols.length > 0
      ? await prisma.financeTicker.findMany({
          where: { symbol: { in: allSymbols } },
          select: {
            symbol: true,
            snapshots: {
              orderBy: { date: "desc" },
              take: 1,
              select: { close: true },
            },
          },
        })
      : [];

  const priceBySymbol = new Map<string, number | null>();
  for (const t of latestSnapshots) {
    const close = t.snapshots[0]?.close;
    priceBySymbol.set(t.symbol, close != null ? Number(close) : null);
  }

  const items: ResearchStockItem[] = [
    ...decisions.needsYou.map((d) => {
      return {
        id: `dec-${d.id}`,
        symbol: d.ticker.symbol,
        name: d.ticker.name,
        bucket: "needs_you" as const,
        call: d.call,
        stage: "decide",
        summary: d.sentence,
        reviewGo: d.origin === "monitor" ? null : d.reviewGo,
        reviewTotal: d.origin === "monitor" ? null : d.reviewTotal,
        origin: d.origin,
        criteriaId: d.candidateId
          ? (candidateById.get(d.candidateId)?.run.criteriaId ?? null)
          : null,
        isHeld: heldSymbols.has(d.ticker.symbol),
        latestPrice: priceBySymbol.get(d.ticker.symbol) ?? null,
        buyRange: formatBuyRange(d.buyRangeLow, d.buyRangeHigh),
        position: positionBySymbol.get(d.ticker.symbol) ?? null,
      };
    }),
    ...researching.map((c) => {
      const symbol = c.ticker?.symbol ?? c.tickerSymbol ?? "—";
      const name = c.ticker?.name ?? c.companyName ?? symbol;
      const levels = evaluationLevels(c.evaluations);
      return {
        id: `cand-${c.id}`,
        symbol,
        name,
        bucket: "in_progress" as const,
        call: null,
        stage: c.stage,
        summary:
          c.evaluations[0]?.reasons[0] ??
          `${c.evidence.length} research sources gathered`,
        reviewGo: null,
        reviewTotal: null,
        origin: null,
        criteriaId: c.criteriaId,
        isHeld: heldSymbols.has(symbol),
        latestPrice: priceBySymbol.get(symbol) ?? null,
        buyRange: levels.buyRange,
        position: positionBySymbol.get(symbol) ?? null,
      };
    }),
    ...decisions.notNow.map((d) => {
      return {
        id: `dec-${d.id}`,
        symbol: d.ticker.symbol,
        name: d.ticker.name,
        bucket: "not_now" as const,
        call: d.call,
        stage: "done",
        summary: d.sentence,
        reviewGo: d.origin === "monitor" ? null : d.reviewGo,
        reviewTotal: d.origin === "monitor" ? null : d.reviewTotal,
        origin: d.origin,
        criteriaId: d.candidateId
          ? (candidateById.get(d.candidateId)?.run.criteriaId ?? null)
          : null,
        isHeld: heldSymbols.has(d.ticker.symbol),
        latestPrice: priceBySymbol.get(d.ticker.symbol) ?? null,
        buyRange: formatBuyRange(d.buyRangeLow, d.buyRangeHigh),
        position: positionBySymbol.get(d.ticker.symbol) ?? null,
      };
    }),
  ];

  // Ensure any held position without a decision or active candidate still appears in Owned
  const listedSymbols = new Set(items.map((item) => item.symbol));
  for (const p of portfolio.positions) {
    if (!listedSymbols.has(p.symbol)) {
      items.push({
        id: `hold-${p.id}`,
        symbol: p.symbol,
        name: p.name,
        bucket: "not_now",
        call: "keep",
        stage: "done",
        summary: p.reasonPoints[0]?.text ?? "Owned portfolio position",
        reviewGo: null,
        reviewTotal: null,
        origin: "monitor",
        criteriaId: null,
        isHeld: true,
        latestPrice: priceBySymbol.get(p.symbol) ?? null,
        buyRange: null,
        position: positionBySymbol.get(p.symbol) ?? null,
      });
    }
  }

  const detailsBySymbol: Record<string, TickerPanelDetail> = {};

  for (const d of allDecisions) {
    const cand = d.candidateId ? candidateById.get(d.candidateId) : undefined;
    if (!cand) continue;
    const breakdown = scoreBreakdown(cand.evaluations);
    const verdict = overallVerdict(breakdown);
    const evidenceById = new Map(cand.evidence.map((e) => [e.id, e] as const));
    const low = moneyStr(d.buyRangeLow);
    const high = moneyStr(d.buyRangeHigh);

    detailsBySymbol[d.ticker.symbol] = {
      symbol: d.ticker.symbol,
      criteriaLabel: cand.run.criteriaLabel,
      criteriaVersion: cand.run.criteriaVersion,
      currentStage: cand.stage,
      proposedCount: cand.proposedCount,
      screening: screeningView(cand),
      activity: activityView(cand.jobs),
      buyRange: low && high ? `${low} – ${high}` : null,
      reviewIfBelow: moneyStr(d.reviewIfBelow),
      holdFor: d.holdDuration ?? null,
      evidence: cand.evidence.map((item) => ({
        id: item.id,
        section: item.section,
        summary: item.summary,
        tier: item.tier,
        tierLabel: SOURCE_TIER_LABEL[item.tier] ?? "Other",
        codeChecked: item.codeChecked,
        codeCheckNote: item.codeCheckNote,
        url: item.url,
      })),
      evaluations: cand.evaluations.map((ev) => ({
        id: ev.id,
        call: ev.call,
        callLabel: EVAL_CALL_LABEL[ev.call],
        against: ev.against,
        confidence: ev.confidence,
        createdAt: ev.createdAt.toISOString().slice(0, 10),
        reasons: ev.reasons,
        risks: ev.risks,
        changeMind: ev.changeMind,
        buyRangeLow: moneyStr(ev.buyRangeLow),
        buyRangeHigh: moneyStr(ev.buyRangeHigh),
        reviewIfBelow: moneyStr(ev.reviewIfBelow),
        holdDuration: ev.holdDuration,
        citedCount: ev.citedEvidenceIds.filter((id) => evidenceById.has(id))
          .length,
      })),
      breakdown,
      overallVerdictLabel: EVAL_CALL_LABEL[verdict],
      overallVerdictKey: verdict,
      decision: {
        id: d.id,
        call: d.call,
        origin: d.origin,
        actorLabel: d.actorLabel,
        sentence: d.sentence,
        reviewGo: d.reviewGo,
        reviewTotal: d.reviewTotal,
        reasons: d.reasons,
        answerAgainst: d.answerAgainst,
        answerDissent: d.answerDissent,
        changeMind: d.changeMind,
        reviews: cand.reviews.map((r) => ({
          id: r.id,
          actorLabel: r.actorLabel,
          call: r.call,
          summary: r.summary,
          answerAgainst: r.answerAgainst,
        })),
      },
    };
  }

  for (const cand of researching) {
    const symbol = cand.ticker?.symbol ?? cand.tickerSymbol;
    if (!symbol || detailsBySymbol[symbol]) continue;
    const breakdown = scoreBreakdown(cand.evaluations);
    const verdict = overallVerdict(breakdown);
    const evidenceById = new Map(cand.evidence.map((e) => [e.id, e] as const));
    const levels = evaluationLevels(cand.evaluations);

    detailsBySymbol[symbol] = {
      symbol,
      criteriaLabel: cand.criteriaLabel,
      criteriaVersion: cand.criteriaVersion,
      currentStage: cand.stage,
      proposedCount: cand.proposedCount,
      screening: screeningView(cand),
      activity: activityView(cand.jobs),
      buyRange: levels.buyRange,
      reviewIfBelow: levels.reviewIfBelow,
      holdFor: levels.holdFor,
      evidence: cand.evidence.map((item) => ({
        id: item.id,
        section: item.section,
        summary: item.summary,
        tier: item.tier,
        tierLabel: SOURCE_TIER_LABEL[item.tier] ?? "Other",
        codeChecked: item.codeChecked,
        codeCheckNote: item.codeCheckNote,
        url: item.url,
      })),
      evaluations: cand.evaluations.map((ev) => ({
        id: ev.id,
        call: ev.call,
        callLabel: EVAL_CALL_LABEL[ev.call],
        against: ev.against,
        confidence: ev.confidence,
        createdAt: ev.createdAt.toISOString().slice(0, 10),
        reasons: ev.reasons,
        risks: ev.risks,
        changeMind: ev.changeMind,
        buyRangeLow: moneyStr(ev.buyRangeLow),
        buyRangeHigh: moneyStr(ev.buyRangeHigh),
        reviewIfBelow: moneyStr(ev.reviewIfBelow),
        holdDuration: ev.holdDuration,
        citedCount: ev.citedEvidenceIds.filter((id) => evidenceById.has(id))
          .length,
      })),
      breakdown,
      overallVerdictLabel: EVAL_CALL_LABEL[verdict],
      overallVerdictKey: verdict,
      decision: null,
    };
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      {researching.length > 0 && <FinanceLiveRefresh />}

      <FinanceResearchBoard
        initialCriteria={criteria}
        items={items}
        detailsBySymbol={detailsBySymbol}
        canManageTrades={canManageTrades}
      />
    </div>
  );
}
