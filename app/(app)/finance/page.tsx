import Link from "next/link";
import { optionalUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { tickerPath } from "@/lib/finance";
import { EVAL_CALL_LABEL, overallVerdict, scoreBreakdown } from "@/lib/finance/pipeline";

export const dynamic = "force-dynamic";

const card = "rounded-xl border border-zk-border bg-zk-surface";
const chip = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

const STAGE_LABEL: Record<string, string> = {
  screen: "Screen",
  enrich: "Enrich",
  evaluate: "Evaluate",
  review: "Review",
  decide: "Decide",
  done: "Done",
};

const VERDICT_STYLE: Record<"buy" | "hold" | "dont_buy", string> = {
  buy: "bg-zk-ok-bg text-zk-ok-fg",
  hold: "bg-zk-chip text-zk-text2",
  dont_buy: "bg-zk-bad-bg text-zk-bad-fg",
};

/**
 * The one Finance page (PRD §5.1). It shows the current run's pipeline: one row
 * per stock with its stage and the agents' verdict, linking to the detail view.
 * Criteria entry and the decision/portfolio sections belong to Streams A and C;
 * this page shows the enrichment and evaluation part Stream B owns.
 */
export default async function FinancePage() {
  const user = await optionalUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">Finance</h1>
        <p className="text-sm text-zk-text2">Sign in to see the research.</p>
        <Link href="/login?callbackUrl=%2Ffinance" className="text-sm font-medium text-zk-accent">
          Sign in
        </Link>
      </div>
    );
  }

  const run = await prisma.financeRun.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      criteriaLabel: true,
      criteriaVersion: true,
      createdAt: true,
      candidates: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          stage: true,
          evaluations: { select: { call: true, confidence: true, against: true, reasons: true } },
          _count: { select: { evidence: true } },
          ticker: { select: { symbol: true, name: true } },
        },
      },
    },
  });

  if (!run || run.candidates.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-2 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">Finance</h1>
        <p className="text-sm text-zk-text2">Nothing needs you today.</p>
        <p className="text-xs text-zk-muted">When criteria start a run, the stocks and their evaluations appear here.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">Finance</h1>
        <p className="text-sm text-zk-text2">
          {run.criteriaLabel} · criteria v{run.criteriaVersion} · {run.candidates.length} {run.candidates.length === 1 ? "stock" : "stocks"}
        </p>
      </header>

      <section className={card} aria-label="Pipeline">
        <ul className="divide-y divide-zk-border">
          {run.candidates.map((candidate) => {
            const breakdown = scoreBreakdown(candidate.evaluations);
            const verdict = overallVerdict(breakdown);
            const reason = candidate.evaluations.flatMap((e) => e.reasons)[0] ?? "Waiting for evaluations.";
            return (
              <li key={candidate.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <Link href={tickerPath(candidate.ticker.symbol)} className="min-w-0 flex-1">
                  <span className="font-semibold text-zk-text">{candidate.ticker.symbol}</span>{" "}
                  <span className="text-zk-text2">{candidate.ticker.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-zk-muted">{reason}</span>
                </Link>
                <span className={`${chip} bg-zk-chip text-zk-text2`}>{STAGE_LABEL[candidate.stage] ?? candidate.stage}</span>
                <span className={`${chip} ${VERDICT_STYLE[verdict]}`}>
                  {breakdown.total === 0 ? "Pending" : EVAL_CALL_LABEL[verdict]}
                </span>
                <span className="text-xs text-zk-muted">
                  {candidate._count.evidence} {candidate._count.evidence === 1 ? "source" : "sources"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
