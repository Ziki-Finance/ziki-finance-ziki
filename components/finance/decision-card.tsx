import Link from "next/link";
import type { FinanceDecision, FinanceReview, FinanceRun } from "@prisma/client";
import { DecisionActions } from "./portfolio-card";

export function DecisionCard({ decision, symbol, reviews, run }: { decision: FinanceDecision; symbol: string; reviews: FinanceReview[]; run?: Pick<FinanceRun, "criteriaLabel" | "criteriaVersion"> }) {
  const labels: Record<string, string> = { go: "Go", no_go: "No-go", keep: "Keep", trim: "Trim", sell: "Sell" };
  const money = (value: { toString(): string } | null) => value === null ? "—" : `$${Number(value.toString()).toFixed(2)}`;
  return <section className="rounded-xl border border-zk-border bg-zk-surface p-5 sm:p-6" aria-label="Final decision">
    <div className="mb-4 flex items-center gap-3"><Link href="/finance" aria-label="Back to Finance" className="rounded-md border border-zk-border px-2 py-1 text-zk-accent">←</Link>
      <span className={`rounded px-2 py-1 text-xs font-semibold ${decision.call === "no_go" || decision.call === "sell" ? "bg-zk-bad-bg text-zk-bad-fg" : "bg-zk-ok-bg text-zk-ok-fg"}`}>{labels[decision.call]}</span>
      <span className="text-xs text-zk-muted">{symbol} · {decision.origin === "review" ? "Rejected by review" : decision.actorLabel}</span></div>
    <h1 className="text-xl font-bold leading-snug text-zk-text">{decision.sentence}</h1>
    {run && <p className="mt-2 text-xs text-zk-muted">{run.criteriaLabel} · exact criteria version {run.criteriaVersion}</p>}
    {decision.origin !== "monitor" && <p className="mt-3 text-xs font-medium text-zk-text2">Reviewers: {decision.reviewGo} Go / {decision.reviewTotal - decision.reviewGo} No-go{decision.reviewGo > 0 && decision.reviewGo < decision.reviewTotal ? " · Split vote" : ""}</p>}
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Buy range", `${money(decision.buyRangeLow)} – ${money(decision.buyRangeHigh)}`], ["Review if below", money(decision.reviewIfBelow)], ["Hold for", decision.holdDuration ?? "—"], ["Verdict", labels[decision.call]]].map(([title, value]) => <div key={title} className="rounded-md bg-zk-bg p-3"><p className="mb-2 text-[10px] uppercase tracking-wide text-zk-muted">{title}</p><p className="text-sm font-semibold text-zk-text">{value}</p></div>)}</div>
    <section className="mt-6"><h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zk-muted">Why · in the agents’ words</h2><ul className="space-y-2">{decision.reasons.map((r, i) => <li key={i} className="text-xs leading-relaxed text-zk-text2">{r}</li>)}</ul></section>
    <section className="mt-6"><h2 className="mb-2 text-xs font-semibold text-zk-text">The case against</h2><p className="whitespace-pre-line text-xs leading-relaxed text-zk-text2">{decision.answerAgainst}</p></section>
    {decision.answerDissent && <section className="mt-5"><h2 className="mb-2 text-xs font-semibold text-zk-text">Answer to the dissent</h2><p className="text-xs leading-relaxed text-zk-text2">{decision.answerDissent}</p></section>}
    <section className="mt-5"><h2 className="mb-2 text-xs font-semibold text-zk-text">What would change this decision</h2><p className="text-xs leading-relaxed text-zk-text2">{decision.changeMind}</p></section>
    {reviews.length > 0 && <section className="mt-6"><h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zk-muted">How reviewers voted</h2><ul className="space-y-4">{reviews.map(r => <li key={r.id}><p className="mb-1 text-xs font-semibold text-zk-text">{r.actorLabel} · {r.call === "go" ? "Go" : "No-go"}</p><p className="text-xs leading-relaxed text-zk-text2">{r.summary}</p><p className="mt-2 text-xs leading-relaxed text-zk-muted">Against response: {r.answerAgainst}</p></li>)}</ul></section>}
    <DecisionActions decisionId={decision.id} symbol={symbol} call={decision.call} />
  </section>;
}
