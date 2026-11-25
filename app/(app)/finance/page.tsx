import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireFinanceOwner } from "@/lib/finance/owner";
import { listFinanceCriteria } from "@/lib/finance/criteria";
import { decisionsForOwner } from "@/lib/finance/decisions";
import { portfolioForOwner } from "@/lib/finance/portfolio";
import { describeFinanceChange } from "@/lib/finance/change-description";
import {
  FinanceResearchBoard,
  type ResearchStockItem,
} from "@/components/finance/finance-research-board";
import { PortfolioCard } from "@/components/finance/portfolio-card";
import { FinanceLiveRefresh } from "@/components/finance/live-refresh";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finance",
  robots: { index: false, follow: false, nocache: true },
};

export default async function FinancePage() {
  const user = await requireFinanceOwner();
  let data: [
    Awaited<ReturnType<typeof listFinanceCriteria>>,
    Array<{
      id: string;
      criteriaId: string | null;
      criteriaLabel: string;
      criteriaVersion: number;
      candidates: Array<{
        id: string;
        stage: string;
        tickerSymbol: string | null;
        companyName: string | null;
        ticker: { symbol: string; name: string } | null;
        decision: { id: string } | null;
        evaluations: Array<{ reasons: string[] }>;
        _count: { evidence: number; reviews: number };
      }>;
    }>,
    Awaited<ReturnType<typeof decisionsForOwner>>,
    Awaited<ReturnType<typeof portfolioForOwner>>,
    Array<{
      id: string;
      tickerId: string;
      kind: string;
      actorLabel: string;
      createdAt: Date;
      detail: unknown;
    }>,
  ];
  try {
    data = await Promise.all([
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
              tickerSymbol: true,
              companyName: true,
              ticker: { select: { symbol: true, name: true } },
              decision: { select: { id: true } },
              evaluations: { select: { reasons: true } },
              _count: { select: { evidence: true, reviews: true } },
            },
          },
        },
      }),
      decisionsForOwner(prisma, user.id),
      portfolioForOwner(prisma, user.id),
      prisma.financeChange.findMany({
        where: { OR: [{ userId: user.id }, { userId: null }] },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
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

  const [criteria, runs, decisions, portfolio, changes] = data;
  const heldSymbols = new Set(portfolio.positions.map((p) => p.symbol));

  const researching = runs.flatMap((r) =>
    r.candidates
      .filter((c) => !c.decision)
      .map((c) => ({ ...c, criteriaId: r.criteriaId })),
  );

  const items: ResearchStockItem[] = [
    ...decisions.needsYou.map((d) => ({
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
      criteriaId: null,
      isHeld: heldSymbols.has(d.ticker.symbol),
    })),
    ...researching.map((c) => {
      const symbol = c.ticker?.symbol ?? c.tickerSymbol ?? "—";
      const name = c.ticker?.name ?? c.companyName ?? symbol;
      return {
        id: `cand-${c.id}`,
        symbol,
        name,
        bucket: "in_progress" as const,
        call: null,
        stage: c.stage,
        summary:
          c.evaluations[0]?.reasons[0] ??
          `${c._count.evidence} research sources gathered`,
        reviewGo: null,
        reviewTotal: null,
        origin: null,
        criteriaId: c.criteriaId,
        isHeld: heldSymbols.has(symbol),
      };
    }),
    ...decisions.notNow.map((d) => ({
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
      criteriaId: null,
      isHeld: heldSymbols.has(d.ticker.symbol),
    })),
  ];

  const serializedChanges = changes.map((c) => ({
    id: c.id,
    tickerId: c.tickerId,
    kind: c.kind,
    actorLabel: c.actorLabel,
    createdAt: c.createdAt.toISOString(),
    description: describeFinanceChange(c.kind, c.detail),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      {researching.length > 0 && <FinanceLiveRefresh />}

      <FinanceResearchBoard
        initialCriteria={criteria}
        items={items}
        portfolioTotalValue={portfolio.totalValue}
        holdingsCount={portfolio.positions.length}
      />

      <PortfolioCard portfolio={portfolio} changes={serializedChanges} />
    </div>
  );
}
