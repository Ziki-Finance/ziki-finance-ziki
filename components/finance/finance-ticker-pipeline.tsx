"use client";

import { useState } from "react";
import { DecisionActions } from "./portfolio-card";

export type PipelineStageKey = "screen" | "enrich" | "evaluate" | "decide";

export type SerializedEvidenceItem = {
  id: string;
  section: string;
  summary: string;
  tier: number;
  tierLabel: string;
  codeChecked: boolean;
  codeCheckNote: string | null;
  url: string;
};

export type SerializedEvaluationItem = {
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
};

export type SerializedDecision = {
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
  reviews: Array<{
    id: string;
    actorLabel: string;
    call: string;
    summary: string;
    answerAgainst: string;
  }>;
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

const STAGE_ORDER: Record<string, number> = {
  screen: 1,
  enrich: 2,
  evaluate: 3,
  review: 3,
  decide: 4,
  done: 5,
};

export function FinanceTickerPipeline({
  symbol,
  currentStage,
  criteriaLabel,
  criteriaVersion,
  proposedCount,
  sectionsCovered,
  evidence,
  evaluations,
  breakdown,
  overallVerdictLabel,
  overallVerdictKey,
  decision,
  isDemo = false,
  compact = false,
}: {
  symbol: string;
  currentStage: string;
  criteriaLabel: string;
  criteriaVersion: number;
  proposedCount: number;
  sectionsCovered: number;
  evidence: SerializedEvidenceItem[];
  evaluations: SerializedEvaluationItem[];
  breakdown: {
    total: number;
    buy: number;
    hold: number;
    dontBuy: number;
    against: number;
    averageConfidence: number | null;
  };
  overallVerdictLabel: string;
  overallVerdictKey: "buy" | "hold" | "dont_buy";
  decision: SerializedDecision | null;
  isDemo?: boolean;
  compact?: boolean;
}) {
  const stageNum = STAGE_ORDER[currentStage] ?? 1;
  const defaultTab: PipelineStageKey = decision
    ? "decide"
    : stageNum >= 3
      ? "evaluate"
      : stageNum === 2
        ? "enrich"
        : "screen";

  const [activeTab, setActiveTab] = useState<PipelineStageKey>(defaultTab);

  const stages: Array<{
    key: PipelineStageKey;
    num: number;
    title: string;
    subtitle: string;
  }> = [
    {
      key: "screen",
      num: 1,
      title: "1. Screen",
      subtitle: `${criteriaLabel} · v${criteriaVersion}`,
    },
    {
      key: "enrich",
      num: 2,
      title: "2. Enrich",
      subtitle: `${evidence.length} items · ${sectionsCovered}/6 sections`,
    },
    {
      key: "evaluate",
      num: 3,
      title: "3. Evaluate",
      subtitle:
        breakdown.total > 0
          ? `${breakdown.total} evaluations · ${overallVerdictLabel}`
          : "Awaiting evaluations",
    },
    {
      key: "decide",
      num: 4,
      title: "4. Decide",
      subtitle: decision
        ? `${decision.reviewGo}/${decision.reviewTotal} Go`
        : "Pending decision",
    },
  ];

  const evidenceSections = Object.keys(SECTION_LABEL).filter((sec) =>
    evidence.some((item) => item.section === sec),
  );

  return (
    <section
      aria-label="Research pipeline"
      className={
        compact
          ? "rounded-xl border border-zk-border bg-zk-bg p-4 space-y-4"
          : "rounded-2xl border border-zk-border bg-zk-surface p-5 sm:p-6 space-y-5"
      }
    >
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zk-muted">
          Research pipeline (click a stage to inspect)
        </h2>
        <div
          className={
            compact
              ? "mt-2.5 grid grid-cols-2 gap-2"
              : "mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4"
          }
        >
          {stages.map((st) => {
            const isSelected = activeTab === st.key;
            const isDone = stageNum > st.num || (st.key === "decide" && decision);
            const isActive = stageNum === st.num && !isDone;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => setActiveTab(st.key)}
                className={`rounded-xl border ${compact ? "p-2.5" : "p-3.5"} text-left transition ${
                  isSelected
                    ? "border-zk-accent bg-zk-tint/60 ring-1 ring-zk-accent"
                    : "border-zk-border bg-zk-bg hover:border-zk-accent/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-zk-text">
                    {st.title}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      isDone
                        ? "text-zk-ok-fg"
                        : isActive
                          ? "text-zk-accent"
                          : "text-zk-muted"
                    }`}
                  >
                    {isDone ? "✓" : isActive ? "●" : "·"}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-zk-muted">
                  {st.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage 1: Screen */}
      {activeTab === "screen" && (
        <div className="rounded-xl border border-zk-border bg-zk-bg p-4 space-y-2">
          <h3 className="text-sm font-bold text-zk-text">
            Stage 1: Screening
          </h3>
          <p className="text-xs leading-relaxed text-zk-text2">
            Proposed for <span className="font-semibold">{criteriaLabel}</span>{" "}
            (criteria v{criteriaVersion}) by {proposedCount}{" "}
            {proposedCount === 1 ? "screening agent" : "screening agents"}.
          </p>
          <p className="text-xs text-zk-muted">
            Current pipeline stage: {currentStage}
          </p>
        </div>
      )}

      {/* Stage 2: Enrich */}
      {activeTab === "enrich" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zk-text">
              Stage 2: Enrichment Dossier
            </h3>
            <span className="text-xs text-zk-muted">
              {sectionsCovered}/6 sections covered · {evidence.length} items
            </span>
          </div>
          {evidence.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zk-border bg-zk-bg p-4 text-xs text-zk-muted">
              No dossier items gathered yet.
            </p>
          ) : (
            <div className="space-y-4">
              {evidenceSections.map((sec) => (
                <div
                  key={sec}
                  className="rounded-xl border border-zk-border bg-zk-bg p-4 space-y-2.5"
                >
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zk-muted">
                    {SECTION_LABEL[sec]}
                  </h4>
                  <ul className="space-y-3">
                    {evidence
                      .filter((item) => item.section === sec)
                      .map((item) => (
                        <li key={item.id} className="text-xs space-y-1">
                          <p className="text-zk-text leading-relaxed">
                            {item.summary}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zk-muted">
                            <span className="rounded-full bg-zk-chip px-2 py-0.5 text-zk-text2">
                              Tier {item.tier} · {item.tierLabel}
                            </span>
                            {item.codeChecked ? (
                              <span className="rounded-full bg-zk-ok-bg px-2 py-0.5 text-zk-ok-fg">
                                Checked by code
                              </span>
                            ) : null}
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-zk-accent underline"
                            >
                              Source
                            </a>
                            {item.codeCheckNote ? (
                              <span>{item.codeCheckNote}</span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stage 3: Evaluate */}
      {activeTab === "evaluate" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zk-text">
                Stage 3: Evaluations
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${VERDICT_STYLE[overallVerdictKey]}`}
              >
                {breakdown.total === 0 ? "Pending" : overallVerdictLabel}
              </span>
            </div>
            {breakdown.total > 0 && (
              <span className="text-xs text-zk-muted">
                {breakdown.buy} buy · {breakdown.hold} hold ·{" "}
                {breakdown.dontBuy} don&apos;t buy · Confidence{" "}
                {breakdown.averageConfidence === null
                  ? "—"
                  : `${breakdown.averageConfidence}/100`}
              </span>
            )}
          </div>

          {evaluations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zk-border bg-zk-bg p-4 text-xs text-zk-muted">
              No evaluations submitted yet.
            </p>
          ) : (
            <ol className="space-y-3">
              {evaluations.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-xl border border-zk-border bg-zk-bg p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${VERDICT_STYLE[ev.call]}`}
                    >
                      {ev.callLabel}
                    </span>
                    {ev.against ? (
                      <span className="rounded-full bg-zk-bad-bg px-2 py-0.5 text-[11px] font-medium text-zk-bad-fg">
                        Against
                      </span>
                    ) : null}
                    <span className="text-xs text-zk-muted">
                      Confidence {ev.confidence}/100 · {ev.createdAt}
                    </span>
                  </div>
                  <ul className="list-disc pl-5 text-xs leading-relaxed text-zk-text space-y-1">
                    {ev.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  {ev.risks.length > 0 && (
                    <p className="text-xs text-zk-text2">
                      <span className="font-semibold text-zk-text">Risks:</span>{" "}
                      {ev.risks.join("; ")}
                    </p>
                  )}
                  <p className="text-xs text-zk-text2">
                    <span className="font-semibold text-zk-text">
                      Would change mind:
                    </span>{" "}
                    {ev.changeMind}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zk-muted pt-1">
                    {(ev.buyRangeLow || ev.buyRangeHigh) && (
                      <span>
                        Buy range {ev.buyRangeLow ?? "—"}–
                        {ev.buyRangeHigh ?? "—"}
                      </span>
                    )}
                    {ev.reviewIfBelow && (
                      <span>Review if below {ev.reviewIfBelow}</span>
                    )}
                    <span>Hold {ev.holdDuration}</span>
                    <span>Cites {ev.citedCount} dossier items</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Stage 4: Decide */}
      {activeTab === "decide" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zk-text">
            Stage 4: Final Decision
          </h3>
          {!decision ? (
            <p className="rounded-xl border border-dashed border-zk-border bg-zk-bg p-4 text-xs text-zk-muted">
              No final decision generated yet. Complete enrichment and
              evaluation stages first.
            </p>
          ) : (
            <div className="rounded-xl border border-zk-border bg-zk-bg p-4 space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zk-muted mb-2">
                  Why · in the agents&apos; words
                </h4>
                <ul className="space-y-1.5 list-disc pl-5 text-xs leading-relaxed text-zk-text2">
                  {decision.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zk-text mb-1">
                  The case against
                </h4>
                <p className="whitespace-pre-line text-xs leading-relaxed text-zk-text2">
                  {decision.answerAgainst}
                </p>
              </div>
              {decision.answerDissent && (
                <div>
                  <h4 className="text-xs font-semibold text-zk-text mb-1">
                    Answer to the dissent
                  </h4>
                  <p className="text-xs leading-relaxed text-zk-text2">
                    {decision.answerDissent}
                  </p>
                </div>
              )}
              <div>
                <h4 className="text-xs font-semibold text-zk-text mb-1">
                  What would change this decision
                </h4>
                <p className="text-xs leading-relaxed text-zk-text2">
                  {decision.changeMind}
                </p>
              </div>
              {decision.reviews.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zk-muted mb-2">
                    How reviewers voted
                  </h4>
                  <ul className="space-y-3">
                    {decision.reviews.map((r) => (
                      <li
                        key={r.id}
                        className="border-t border-zk-divider pt-2.5 first:border-t-0 first:pt-0"
                      >
                        <p className="text-xs font-semibold text-zk-text">
                          {r.actorLabel} · {r.call === "go" ? "Go" : "No-go"}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-zk-text2">
                          {r.summary}
                        </p>
                        <p className="mt-1 text-[11px] text-zk-muted">
                          Against response: {r.answerAgainst}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {isDemo ? (
                <p className="border-t border-zk-border pt-3 text-xs text-zk-muted">
                  Demo mode: owner decision actions are disabled for sample
                  data.
                </p>
              ) : (
                <DecisionActions
                  decisionId={decision.id}
                  symbol={symbol}
                  call={decision.call}
                />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
