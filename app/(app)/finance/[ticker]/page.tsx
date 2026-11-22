import Link from "next/link";
import { notFound } from "next/navigation";
import { optionalUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { FINANCE_PATH, normalizeSymbol } from "@/lib/finance";
import {
  EVAL_CALL_LABEL,
  SOURCE_TIER_LABEL,
  candidateForTicker,
  overallVerdict,
  scoreBreakdown,
  sectionStatuses,
  type SectionStatus,
} from "@/lib/finance/pipeline";

export const dynamic = "force-dynamic";

const card = "rounded-xl border border-zk-border bg-zk-surface p-5";
const heading = "text-xs font-semibold uppercase tracking-wider text-zk-muted";
const chip = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

const STAGE_LABEL: Record<string, string> = {
  screen: "Screen",
  enrich: "Enrich",
  evaluate: "Evaluate",
  review: "Review",
  decide: "Decide",
  done: "Done",
};

const SECTION_LABEL: Record<string, string> = {
  business: "Business",
  numbers: "Numbers",
  filings: "Filings",
  news: "News",
  social: "Social",
  market_context: "Market context",
};

const VERDICT_STYLE: Record<"buy" | "hold" | "dont_buy", string> = {
  buy: "bg-zk-ok-bg text-zk-ok-fg",
  hold: "bg-zk-chip text-zk-text2",
  dont_buy: "bg-zk-bad-bg text-zk-bad-fg",
};

function money(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return `$${Number(value).toFixed(2)}`;
}

/** The stock detail view (PRD §5.2): verdict first, then the proof. */
export default async function FinanceTickerPage({ params }: { params: Promise<{ ticker: string }> }) {
  const user = await optionalUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 py-10">
        <p className="text-sm text-zk-text2">Sign in to see this stock&apos;s research.</p>
        <Link href="/login?callbackUrl=%2Ffinance" className="text-sm font-medium text-zk-accent">
          Sign in
        </Link>
      </div>
    );
  }

  const { ticker: rawTicker } = await params;
  const symbol = normalizeSymbol(decodeURIComponent(rawTicker));
  if (!symbol) notFound();

  const found = await candidateForTicker(prisma, symbol);
  if (!found) notFound();
  const { ticker, candidate } = found;

  if (!candidate) {
    return (
      <div className="mx-auto max-w-3xl space-y-2 py-10">
        <Link href={FINANCE_PATH} className="text-sm text-zk-accent">
          ← Finance
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">
          {ticker.symbol} · {ticker.name}
        </h1>
        <p className="text-sm text-zk-text2">No candidate has been researched for this stock yet.</p>
      </div>
    );
  }

  const breakdown = scoreBreakdown(candidate.evaluations);
  const verdict = overallVerdict(breakdown);
  const statuses: SectionStatus[] = sectionStatuses(candidate.evidence);
  const evidenceById = new Map(candidate.evidence.map((item) => [item.id, item] as const));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <Link href={FINANCE_PATH} className="text-sm text-zk-accent">
          ← Finance
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">
          {ticker.symbol} · {ticker.name}
        </h1>
        <p className="text-xs text-zk-muted">
          {candidate.run.criteriaLabel} · criteria v{candidate.run.criteriaVersion} · {STAGE_LABEL[candidate.stage] ?? candidate.stage} ·
          proposed by {candidate.proposedCount}
        </p>
      </div>

      <section className={card} aria-labelledby="verdict-heading">
        <h2 id="verdict-heading" className={heading}>
          Verdict
        </h2>
        <p className="mt-2 text-xl font-bold text-zk-text">
          <span className={`${chip} ${VERDICT_STYLE[verdict]}`}>{breakdown.total === 0 ? "Pending" : EVAL_CALL_LABEL[verdict]}</span>
          {breakdown.total > 0 ? (
            <span className="ml-2 text-sm font-normal text-zk-text2">
              {breakdown.buy} buy · {breakdown.hold} hold · {breakdown.dontBuy} don&apos;t buy
            </span>
          ) : null}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zk-text2">
          <span>{breakdown.total} evaluations</span>
          <span>{breakdown.against === 1 ? "1 Against evaluator" : `${breakdown.against} Against evaluators`}</span>
          <span>Confidence {breakdown.averageConfidence === null ? "—" : `${breakdown.averageConfidence}/100`}</span>
          <span>
            Dossier {candidate.evidence.length} {candidate.evidence.length === 1 ? "item" : "items"} ·{" "}
            {statuses.filter((s) => s.done).length}/6 sections covered
          </span>
        </div>
        <p className="mt-2 text-xs text-zk-muted">Confidence is shown for context and never decides the verdict.</p>
      </section>

      <section className={card} aria-labelledby="evidence-heading">
        <h2 id="evidence-heading" className={heading}>
          Evidence
        </h2>
        {candidate.evidence.length === 0 ? (
          <p className="mt-2 text-sm text-zk-text2">No dossier items yet.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {statuses
              .filter((status) => status.items > 0)
              .map((status) => (
                <div key={status.section}>
                  <h3 className="text-sm font-semibold text-zk-text">{SECTION_LABEL[status.section]}</h3>
                  <ul className="mt-1 space-y-2">
                    {candidate.evidence
                      .filter((item) => item.section === status.section)
                      .map((item) => (
                        <li key={item.id} className="text-sm">
                          <p className="text-zk-text">{item.summary}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zk-muted">
                            <span className={`${chip} bg-zk-chip text-zk-text2`}>Tier {item.tier} · {SOURCE_TIER_LABEL[item.tier] ?? "Other"}</span>
                            {item.codeChecked ? (
                              <span className={`${chip} bg-zk-ok-bg text-zk-ok-fg`}>Checked by code</span>
                            ) : null}
                            <a href={item.url} target="_blank" rel="noreferrer noopener" className="text-zk-accent underline">
                              Source
                            </a>
                            {item.codeCheckNote ? <span>{item.codeCheckNote}</span> : null}
                          </p>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </section>

      <section className={card} aria-labelledby="history-heading">
        <h2 id="history-heading" className={heading}>
          Evaluation history
        </h2>
        {candidate.evaluations.length === 0 ? (
          <p className="mt-2 text-sm text-zk-text2">No evaluations yet.</p>
        ) : (
          <ol className="mt-3 space-y-4">
            {candidate.evaluations.map((evaluation) => (
              <li key={evaluation.id} className="border-t border-zk-border pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`${chip} ${VERDICT_STYLE[evaluation.call]}`}>{EVAL_CALL_LABEL[evaluation.call]}</span>
                  {evaluation.against ? <span className={`${chip} bg-zk-bad-bg text-zk-bad-fg`}>Against</span> : null}
                  <span className="text-xs text-zk-muted">
                    Confidence {evaluation.confidence}/100 · {evaluation.createdAt.toISOString().slice(0, 10)}
                  </span>
                </div>
                <ul className="mt-2 list-disc pl-5 text-sm text-zk-text">
                  {evaluation.reasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
                {evaluation.risks.length > 0 ? (
                  <p className="mt-1 text-sm text-zk-text2">
                    <span className="font-medium text-zk-text">Risks:</span> {evaluation.risks.join("; ")}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-zk-text2">
                  <span className="font-medium text-zk-text">Would change its mind:</span> {evaluation.changeMind}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zk-muted">
                  {money(evaluation.buyRangeLow) || money(evaluation.buyRangeHigh) ? (
                    <span>
                      Buy range {money(evaluation.buyRangeLow) ?? "—"}–{money(evaluation.buyRangeHigh) ?? "—"}
                    </span>
                  ) : null}
                  {money(evaluation.reviewIfBelow) ? <span>Review if below {money(evaluation.reviewIfBelow)}</span> : null}
                  <span>Hold {evaluation.holdDuration}</span>
                  <span>
                    Cites {evaluation.citedEvidenceIds.filter((id) => evidenceById.has(id)).length} dossier{" "}
                    {evaluation.citedEvidenceIds.length === 1 ? "item" : "items"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
