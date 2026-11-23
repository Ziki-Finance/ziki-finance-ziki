"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { submitFinanceFreshCheck, submitFinanceOwnerAction, submitFinanceTrade } from "@/app/actions/finance-portfolio";
import type { portfolioForOwner } from "@/lib/finance/portfolio";

type Portfolio = Awaited<ReturnType<typeof portfolioForOwner>>;
export type FinanceLogEntry = { id: string; tickerId: string; kind: string; actorLabel: string; createdAt: string; description: string };
export const financePrimaryButton = "inline-flex items-center justify-center rounded-md bg-zk-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zk-accent";
const secondary = "rounded-md border border-zk-border px-3 py-2 text-xs font-medium text-zk-text hover:bg-zk-chip disabled:opacity-50";
const money = (value: number | null) => value === null ? "—" : value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const percent = (value: number | null) => value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
const reasonLabel: Record<string, string> = { holds: "Holds", weakening: "Weakening", broken: "Broken", not_checked: "Not checked yet" };

export function TradeButton({ symbol, decisionId, label = "+ Log a trade" }: { symbol?: string; decisionId?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={financePrimaryButton} onClick={() => setOpen(true)}>{label}</button>
    {open && <TradeDialog symbol={symbol} decisionId={decisionId} onClose={() => setOpen(false)} />}</>;
}

function TradeDialog({ symbol, decisionId, onClose }: { symbol?: string; decisionId?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [requestId] = useState(() => crypto.randomUUID());
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={event => { if (pending) event.preventDefault(); else onClose(); }} onClose={onClose}
    aria-labelledby="finance-trade-heading" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-zk-border bg-zk-surface p-6 text-zk-text shadow-xl backdrop:bg-black/30">
    <div className="mb-5 flex items-center justify-between"><h2 id="finance-trade-heading" className="text-lg font-bold">Log a trade</h2>
      <button type="button" className={secondary} disabled={pending} onClick={onClose} aria-label="Close trade form">×</button></div>
    <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); setError(undefined);
      startTransition(async () => { const result = await submitFinanceTrade({ symbol: data.get("symbol"), side: data.get("side"), shares: data.get("shares"),
        price: String(data.get("price") || "").trim() || undefined, date: data.get("date"), decisionId, requestId });
      if (result.ok) onClose(); else setError(result.error); }); }} className="space-y-4">
      <label className="block text-sm font-medium">US stock ticker<input name="symbol" defaultValue={symbol} required maxLength={8} readOnly={Boolean(symbol)} className="mt-1 block w-full rounded-md border border-zk-border bg-zk-bg p-2 text-sm uppercase" /></label>
      <label className="block text-sm font-medium">Trade<select name="side" className="mt-1 block w-full rounded-md border border-zk-border bg-zk-bg p-2 text-sm"><option value="bought">Bought</option><option value="sold">Sold</option></select></label>
      <div className="grid grid-cols-2 gap-4"><label className="text-sm font-medium">Shares<input name="shares" inputMode="decimal" required placeholder="10" className="mt-1 block w-full rounded-md border border-zk-border bg-zk-bg p-2 text-sm" /></label>
        <label className="text-sm font-medium">Price per share ($)<input name="price" inputMode="decimal" placeholder="Closing price" className="mt-1 block w-full rounded-md border border-zk-border bg-zk-bg p-2 text-sm" /></label></div>
      <label className="block text-sm font-medium">Trade date<input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} className="mt-1 block w-full rounded-md border border-zk-border bg-zk-bg p-2 text-sm" /></label>
      <p className="text-xs leading-relaxed text-zk-muted">Record a trade you made. If the closing price is unavailable, enter the price paid.</p>
      {error && <p role="alert" className="text-sm text-zk-bad-fg">{error}</p>}
      <button className={`${financePrimaryButton} w-full`} disabled={pending}>{pending ? "Saving…" : "Save trade"}</button>
    </form>
  </dialog>;
}

export function DecisionActions({ decisionId, symbol, call }: { decisionId: string; symbol: string; call: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [reason, setReason] = useState("");
  return <div className="mt-5 space-y-3 border-t border-zk-border pt-4">
    <label className="block text-xs text-zk-muted">Your note (optional)<input value={reason} onChange={e => setReason(e.target.value)} maxLength={1500} className="mt-1 block w-full rounded-md border border-zk-border bg-zk-bg p-2 text-sm text-zk-text" /></label>
    <div className="flex flex-wrap gap-2"><TradeButton symbol={symbol} decisionId={decisionId} label={call === "go" ? "I bought this" : "Log a trade"} />
      {(["watch", "not_for_me"] as const).map(action => <button key={action} className={secondary} disabled={pending} onClick={() => startTransition(async () => {
        const result = await submitFinanceOwnerAction({ decisionId, action, reason }); setMessage(result.ok ? "Saved." : result.error);
      })}>{action === "watch" ? "Watch it" : "Not for me"}</button>)}</div>
    {message && <p role="status" className="text-xs text-zk-text2">{message}</p>}
  </div>;
}

function ChangeLog({ entries }: { entries: FinanceLogEntry[] }) {
  return <section className="mt-6 border-t border-zk-border pt-5"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zk-muted">Change log</h3>
    {!entries.length ? <p className="text-xs text-zk-muted">No changes recorded yet.</p> : <ol className="divide-y divide-zk-divider">{entries.map(entry => <li key={entry.id} className="space-y-1 py-3">
      <p className="text-xs leading-relaxed text-zk-text2">{entry.description}</p>
      <p className="text-[11px] text-zk-muted">{new Date(entry.createdAt).toLocaleString()} · {entry.actorLabel}</p>
    </li>)}</ol>}</section>;
}

export function PortfolioCard({ portfolio, changes }: { portfolio: Portfolio; changes: FinanceLogEntry[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const holding = portfolio.positions.find(p => p.id === selected);
  return <section aria-label="Portfolio" className="rounded-xl border border-zk-accent bg-zk-surface p-5 sm:p-6">
    {holding ? <>
      <div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-1 text-[11px] uppercase tracking-wider text-zk-muted">Your holding · {holding.symbol}</p><h2 className="text-xl font-bold text-zk-text">{holding.name}</h2></div>
        <button type="button" className={secondary} aria-label="Back to portfolio" onClick={() => { setSelected(null); setMessage(undefined); }}>←</button></div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">{[["Value", money(holding.value)], ["Shares", holding.shares], ["Average cost", holding.averageCost === null ? "—" : money(Number(holding.averageCost))], ["Gain", percent(holding.gainPct)]].map(([label, value]) => <div key={label}><p className="mb-2 text-[11px] uppercase text-zk-muted">{label}</p><p className="text-lg font-semibold text-zk-text">{value}</p></div>)}</div>
      <section className="mt-6"><h3 className="mb-2 text-sm font-semibold text-zk-text">Reason · {reasonLabel[holding.reasonStatus]}</h3>
        <p className="text-xs leading-relaxed text-zk-text2">{holding.addedByYou ? "Added by you. Agents establish and check the reasons for holding this stock." : "Agents check whether the original reasons for this holding remain true."}</p>
        <ul className="mt-3 space-y-2">{holding.reasonPoints.map(p => <li key={p.id} className="text-xs leading-relaxed text-zk-text2">{p.main ? "Main reason: " : ""}{p.text}</li>)}</ul></section>
      <section className="mt-6"><h3 className="mb-2 text-sm font-semibold text-zk-text">Next check</h3><p className="mb-3 text-xs text-zk-text2">{holding.nextCheck ? new Date(holding.nextCheck).toLocaleDateString() : "Waiting for the first agent check."}</p>
        <button className={financePrimaryButton} disabled={pending} onClick={() => startTransition(async () => { const result = await submitFinanceFreshCheck({ holdingId: holding.id, requestId: crypto.randomUUID() }); setMessage(result.ok ? "Fresh check queued." : result.error); })}>Ask for a fresh check</button>
        {message && <p role="status" className="mt-2 text-xs text-zk-text2">{message}</p>}</section>
      <div className="mt-5 flex flex-wrap items-center gap-3"><TradeButton symbol={holding.symbol} /><Link className="text-xs font-semibold text-zk-accent" href={`/finance/${encodeURIComponent(holding.symbol)}`}>View stock research →</Link></div>
      <ChangeLog entries={changes.filter(c => c.tickerId === holding.tickerId)} />
    </> : <>
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-zk-text">Portfolio</h2><TradeButton /></div>
      <div className="mb-5"><p className="text-2xl font-bold tracking-tight text-zk-text">{money(portfolio.totalValue)}</p><p className="mt-1 text-xs text-zk-muted">Total holding value · {portfolio.positions.length} holdings</p></div>
      {!portfolio.positions.length ? <p className="py-4 text-sm text-zk-text2">No holdings yet. Log a trade to start your portfolio.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-zk-border text-[10px] uppercase tracking-wide text-zk-muted"><th className="pb-3 font-medium">Holding</th><th className="pb-3 text-right font-medium">Value / gain</th><th className="px-3 pb-3 font-medium">Reason</th><th className="pb-3 text-right font-medium">Next check</th></tr></thead>
        <tbody>{portfolio.positions.map(p => <tr key={p.id} className="border-b border-zk-divider last:border-0"><td className="py-3 pr-3"><button type="button" className="text-left hover:text-zk-accent" onClick={() => setSelected(p.id)}><span className="font-semibold text-zk-text">{p.name}</span><span className="ml-1 text-[10px] text-zk-muted">{p.symbol}</span><span className="mt-1 block text-[10px] text-zk-muted">{p.shares} shares{p.addedByYou ? " · Added by you" : ""}</span></button></td>
          <td className="whitespace-nowrap py-3 text-right"><p className="font-semibold text-zk-text">{money(p.value)}</p><p className="mt-1 text-[10px] text-zk-ok-fg">{percent(p.gainPct)}</p><p className="mt-0.5 text-[10px] text-zk-muted">S&amp;P 500 {percent(p.benchmarkGainPct)}</p></td>
          <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] ${p.reasonStatus === "broken" ? "bg-zk-bad-bg text-zk-bad-fg" : p.reasonStatus === "weakening" ? "bg-zk-warn-bg text-zk-warn-fg" : "bg-zk-ok-bg text-zk-ok-fg"}`}>{reasonLabel[p.reasonStatus]}</span></td>
          <td className="py-3 text-right"><button type="button" onClick={() => setSelected(p.id)} className="rounded-md bg-zk-accent px-2 py-1 text-[10px] text-white">{p.nextCheck ? new Date(p.nextCheck).toLocaleDateString("en-US", { weekday: "short" }) : "Pending"}</button></td></tr>)}</tbody></table></div>}
      {portfolio.positions.some(p => p.priceDate === null) && <p className="mt-3 text-xs text-zk-muted">Market prices are unavailable for some holdings. Values and comparisons appear when data is available.</p>}
      {portfolio.balanceWarning && <p className="mt-4 text-xs leading-relaxed text-zk-text2">{portfolio.balanceWarning}</p>}
      <details className="mt-5"><summary className="cursor-pointer text-xs font-semibold text-zk-accent">View change log</summary><ChangeLog entries={changes} /></details>
    </>}
  </section>;
}
