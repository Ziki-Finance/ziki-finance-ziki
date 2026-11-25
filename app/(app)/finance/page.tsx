import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireFinanceOwner } from "@/lib/finance/owner";
import { decisionsForOwner } from "@/lib/finance/decisions";
import { portfolioForOwner } from "@/lib/finance/portfolio";
import { describeFinanceChange } from "@/lib/finance/change-description";
import { PortfolioCard } from "@/components/finance/portfolio-card";
import { FinanceLiveRefresh } from "@/components/finance/live-refresh";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const user = await requireFinanceOwner();
  const [run, decisions, portfolio, changes] = await Promise.all([
    prisma.financeRun.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true, criteriaLabel: true, criteriaVersion: true,
      candidates: { orderBy: { createdAt: "asc" }, select: { id: true, stage: true, ticker: { select: { symbol: true, name: true } },
        decision: { select: { id: true } }, evaluations: { select: { reasons: true } }, _count: { select: { evidence: true, reviews: true } } } } } }),
    decisionsForOwner(prisma, user.id), portfolioForOwner(prisma, user.id),
    prisma.financeChange.findMany({ where: { OR: [{ userId: user.id }, { userId: null }] }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const researching = run?.candidates.filter(c => !c.decision) ?? [];
  const groups = [{ title: "Needs you", entries: decisions.needsYou, actionable: true }, { title: "Not now", entries: decisions.notNow, actionable: false }];
  return <div className="mx-auto max-w-4xl space-y-5 pb-8">
    {researching.length > 0 && <FinanceLiveRefresh />}
    <header><h1 className="text-2xl font-extrabold tracking-tight text-zk-text">Finance</h1></header>
    <section className={`rounded-xl border bg-zk-surface p-5 sm:p-6 ${decisions.needsYou.length ? "border-zk-accent" : "border-zk-border"}`} aria-label="Stock research and decisions">
      <h2 className="text-lg font-bold text-zk-text">Stock Research and Analysis</h2>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-zk-muted">Screen · enrich · evaluate · decide</p>
      {run && <p className="mt-4 text-xs text-zk-text2">{run.criteriaLabel} · criteria v{run.criteriaVersion}</p>}
      {researching.length > 0 && <section className="mt-5" aria-label="Research in progress"><h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-zk-muted">Stocks found · {researching.length}</h3>
        <ul className="divide-y divide-zk-divider">{researching.map(c => <li key={c.id} className="flex items-center justify-between gap-3 py-3">
          <Link href={`/finance/${encodeURIComponent(c.ticker.symbol)}`} className="min-w-0"><span className="text-xs font-semibold text-zk-text">{c.ticker.name}</span><span className="ml-2 text-[10px] text-zk-muted">{c.ticker.symbol}</span>
            <span className="mt-1 block truncate text-[11px] text-zk-text2">{c.evaluations[0]?.reasons[0] ?? `${c._count.evidence} research sources gathered`}</span></Link>
          <div role="status" className="flex shrink-0 items-center gap-2 text-[10px] text-zk-muted"><span aria-hidden="true" className="flex gap-0.5 motion-safe:animate-pulse">{[1, 2, 3, 4].map(n => <span key={n} className="h-1 w-1 bg-zk-accent" />)}</span>
            {({ screen: "Waiting for agents", enrich: "Enriching", evaluate: "Evaluating", review: "Reviewing", decide: "Deciding", done: "Complete" })[c.stage]}</div>
        </li>)}</ul></section>}
      {groups.map(group => group.entries.length > 0 && <section key={group.title} className="mt-6" aria-label={group.title}>
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-zk-muted">{group.title} · {group.entries.length}</h3>
        <ul className="space-y-2">{group.entries.map(d => <li key={d.id}>
          <Link href={`/finance/${encodeURIComponent(d.ticker.symbol)}`} className="flex items-center justify-between gap-3 rounded-md bg-zk-bg px-3 py-3 hover:bg-zk-tint">
            <span className="flex min-w-0 items-center gap-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${d.call === "no_go" ? "bg-zk-bad-bg text-zk-bad-fg" : "bg-zk-ok-bg text-zk-ok-fg"}`}>{({ go: "Go", no_go: "No-go", keep: "Keep", trim: "Trim", sell: "Sell" } as Record<string, string>)[d.call]}</span>
              <span className="truncate text-xs font-semibold text-zk-text">{d.ticker.name}<span className="ml-2 text-[10px] font-normal text-zk-muted">{d.ticker.symbol}</span></span></span>
            <span className="flex shrink-0 items-center gap-4"><span className="hidden text-[10px] text-zk-muted sm:inline">{d.origin === "monitor" ? "Reason check complete" : `Reviewers ${d.reviewGo} of ${d.reviewTotal}`}</span><span className="text-[10px] font-semibold text-zk-accent">Open →</span></span>
          </Link></li>)}</ul></section>)}
      {!researching.length && !decisions.needsYou.length && <p className="mt-6 text-sm text-zk-text2">Nothing needs you today.</p>}
    </section>
    <PortfolioCard portfolio={portfolio} changes={changes.map(c => ({ id: c.id, tickerId: c.tickerId, kind: c.kind, actorLabel: c.actorLabel,
      createdAt: c.createdAt.toISOString(), description: describeFinanceChange(c.kind, c.detail) }))} />
  </div>;
}
