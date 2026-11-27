import type { PrismaClient } from "@prisma/client";
import { findDemoStock, type DemoStockDetail } from "./demo-stocks";
import {
  EVAL_CALL_LABEL,
  SOURCE_TIER_LABEL,
  candidateForTicker,
  overallVerdict,
  scoreBreakdown,
  sectionStatuses,
  type ScoreBreakdown,
  type SectionStatus,
} from "./pipeline";
import { portfolioForOwner } from "./portfolio";

function moneyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return `$${Number(value).toFixed(2)}`;
}

export type FinanceOwnerHolding = Awaited<
  ReturnType<typeof portfolioForOwner>
>["positions"][number];

export type FinanceTickerDetailPayload = {
  isDemo: boolean;
  symbol: string;
  demoStock: DemoStockDetail | null;
  holding: FinanceOwnerHolding | null;
  latestPrice: number | null;
  priceDate: string | null;
  candidateForTicker: {
    ticker: {
      id: string;
      symbol: string;
      name: string;
      exchange: string | null;
      type: string;
    };
    candidate: {
      id: string;
      stage: string;
      proposedCount: number;
      codeCheck: unknown;
      createdAt: string;
      run: {
        id: string;
        criteriaLabel: string;
        criteriaVersion: number;
      };
      evidence: Array<{
        id: string;
        section: string;
        summary: string;
        tier: number;
        tierLabel: string;
        codeChecked: boolean;
        codeCheckNote: string | null;
        url: string;
      }>;
      evaluations: Array<{
        id: string;
        call: "buy" | "hold" | "dont_buy";
        callLabel: string;
        against: boolean;
        confidence: number;
        createdAt: string;
        reasons: string[];
        risks: string[];
        changeMind: string;
        buyRangeLow: string | null;
        buyRangeHigh: string | null;
        reviewIfBelow: string | null;
        holdDuration: string;
        citedCount: number;
      }>;
    } | null;
  } | null;
  overallVerdict: {
    key: "buy" | "hold" | "dont_buy";
    label: string;
  };
  scoreBreakdown: ScoreBreakdown;
  sectionStatuses: SectionStatus[];
  decision: {
    id: string;
    call: string;
    origin: string;
    actorLabel: string;
    sentence: string;
    reviewGo: number;
    reviewTotal: number;
    reasons: string[];
    answerAgainst: string;
    answerDissent: string | null;
    changeMind: string;
    buyRangeLow: string | null;
    buyRangeHigh: string | null;
    reviewIfBelow: string | null;
    holdDuration: string | null;
    reviews: Array<{
      id: string;
      actorLabel: string;
      call: string;
      summary: string;
      answerAgainst: string;
    }>;
  } | null;
};

/**
 * Load the owner-scoped ticker detail payload used by both `/finance/[ticker]`
 * and `GET /api/finance/ticker/[symbol]`.
 */
export async function getFinanceTickerDetail(
  db: PrismaClient,
  {
    ownerId,
    symbol,
    demo = false,
  }: { ownerId: string; symbol: string; demo?: boolean },
): Promise<FinanceTickerDetailPayload | null> {
  const portfolio = await portfolioForOwner(db, ownerId);
  const holding =
    portfolio.positions.find((p) => p.symbol === symbol) ?? null;

  const demoStock = demo ? findDemoStock(symbol) : null;
  if (demoStock) {
    return {
      isDemo: true,
      symbol,
      demoStock,
      holding,
      latestPrice: demoStock.item.latestPrice ?? null,
      priceDate: null,
      candidateForTicker: null,
      overallVerdict: {
        key: demoStock.overallVerdictKey,
        label: demoStock.overallVerdictLabel,
      },
      scoreBreakdown: demoStock.breakdown,
      sectionStatuses: [],
      decision: demoStock.decision
        ? {
            ...demoStock.decision,
            buyRangeLow: null,
            buyRangeHigh: null,
            reviewIfBelow: demoStock.reviewIfBelow,
            holdDuration: demoStock.holdFor,
          }
        : null,
    };
  }

  const decision = await db.financeDecision.findFirst({
    where: {
      ticker: { symbol },
      OR: [
        { candidateId: { not: null } },
        { check: { holding: { userId: ownerId } } },
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
    db,
    symbol,
    decision?.candidateId ?? undefined,
  );
  if (!found) return null;

  const { ticker, candidate } = found;
  const latestSnapshot = await db.financeSnapshot.findFirst({
    where: { tickerId: ticker.id },
    orderBy: { date: "desc" },
    select: { close: true, date: true },
  });

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
  const statuses = candidate ? sectionStatuses(candidate.evidence) : [];
  const evidenceById = new Map(
    (candidate?.evidence ?? []).map((item) => [item.id, item] as const),
  );

  return {
    isDemo: false,
    symbol,
    demoStock: null,
    holding,
    latestPrice:
      latestSnapshot?.close != null ? Number(latestSnapshot.close) : null,
    priceDate: latestSnapshot?.date ?? null,
    candidateForTicker: {
      ticker,
      candidate: candidate
        ? {
            id: candidate.id,
            stage: candidate.stage,
            proposedCount: candidate.proposedCount,
            codeCheck: candidate.codeCheck,
            createdAt: candidate.createdAt.toISOString(),
            run: candidate.run,
            evidence: candidate.evidence.map((item) => ({
              id: item.id,
              section: item.section,
              summary: item.summary,
              tier: item.tier,
              tierLabel: SOURCE_TIER_LABEL[item.tier] ?? "Other",
              codeChecked: item.codeChecked,
              codeCheckNote: item.codeCheckNote,
              url: item.url,
            })),
            evaluations: candidate.evaluations.map((ev) => ({
              id: ev.id,
              call: ev.call,
              callLabel: EVAL_CALL_LABEL[ev.call],
              against: ev.against,
              confidence: ev.confidence,
              createdAt: ev.createdAt.toISOString().slice(0, 10),
              reasons: ev.reasons,
              risks: ev.risks,
              changeMind: ev.changeMind,
              buyRangeLow: moneyString(ev.buyRangeLow),
              buyRangeHigh: moneyString(ev.buyRangeHigh),
              reviewIfBelow: moneyString(ev.reviewIfBelow),
              holdDuration: ev.holdDuration,
              citedCount: ev.citedEvidenceIds.filter((id) =>
                evidenceById.has(id),
              ).length,
            })),
          }
        : null,
    },
    overallVerdict: {
      key: verdict,
      label: EVAL_CALL_LABEL[verdict],
    },
    scoreBreakdown: breakdown,
    sectionStatuses: statuses,
    decision: decision
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
          buyRangeLow: moneyString(decision.buyRangeLow),
          buyRangeHigh: moneyString(decision.buyRangeHigh),
          reviewIfBelow: moneyString(decision.reviewIfBelow),
          holdDuration: decision.holdDuration,
          reviews: (decision.candidate?.reviews ?? []).map((r) => ({
            id: r.id,
            actorLabel: r.actorLabel,
            call: r.call,
            summary: r.summary,
            answerAgainst: r.answerAgainst,
          })),
        }
      : null,
  };
}
