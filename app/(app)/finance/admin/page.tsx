import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  grantFinanceClearanceAction,
  removeFinanceClearanceAction,
  saveFinanceSettingsAction,
  savePipelineSettingsAction,
} from "@/app/actions/finance";
import {
  listFinanceClearanceCandidates,
  listFinanceCleared,
} from "@/lib/finance/clearance";
import {
  FINANCE_SETTINGS_ERRORS,
  listFinanceSettingsChanges,
  readFinanceSettings,
  type FinanceSettingsError,
} from "@/lib/finance/settings";
import {
  FINANCE_CANDIDATE_RULES,
  FINANCE_EVIDENCE_SECTIONS,
  PIPELINE_SETTINGS_ERRORS,
  readPipelineSettings,
  type PipelineSettingsError,
} from "@/lib/finance/pipeline-settings";
import { FinanceClearancePicker } from "@/components/finance/finance-clearance-picker";

export const metadata = { title: "Finance Admin" };

const ERRORS: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email address.",
  not_found: "No Ziki account exists with that email. They must sign up first.",
  already_cleared: "That member already has Finance agent clearance.",
};

const SECTION_LABEL: Record<string, string> = {
  business: "Business",
  numbers: "Numbers",
  filings: "Filings",
  news: "News",
  social: "Social",
  market_context: "Market context",
};

const RULE_LABEL: Record<string, string> = {
  proposed_by_2: "2 agents must propose it independently",
  proposed_1_confirmed_by_1: "1 agent proposes, 1 confirms",
};

const INPUT_CLASS =
  "w-full rounded-lg border border-zk-border bg-zk-bg px-3 py-2 text-sm tabular-nums text-zk-text focus:border-zk-accent focus:outline-none focus:ring-2 focus:ring-zk-accent/20";

/**
 * Site staff only (FIN-D-005). Manage who can run Finance agents, settle
 * agreement rules, and v3 research pipeline staffing & guardrails.
 */
export default async function FinanceAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string; section?: string }>;
}) {
  await requireSuperAdmin();
  const params = searchParams ? await searchParams : {};

  const settingsErrorMessage =
    params.section === "agreement" &&
    params.error &&
    params.error in FINANCE_SETTINGS_ERRORS
      ? FINANCE_SETTINGS_ERRORS[params.error as FinanceSettingsError]
      : null;
  const pipelineErrorMessage =
    params.section === "pipeline" &&
    params.error &&
    params.error in PIPELINE_SETTINGS_ERRORS
      ? PIPELINE_SETTINGS_ERRORS[params.error as PipelineSettingsError]
      : null;
  const clearanceError =
    params.error && !settingsErrorMessage && !pipelineErrorMessage
      ? (ERRORS[params.error] ?? "Something went wrong.")
      : null;
  const savedMessage =
    params.saved === "unchanged"
      ? "No changes — those numbers are already active."
      : params.saved === "pipeline"
        ? "Pipeline settings saved. They apply from the next claimed job."
        : params.saved
          ? "Settle agreement rules saved. They apply from the next settle."
          : null;

  const [people, candidates, settings, changes, pipeline] = await Promise.all([
    listFinanceCleared(prisma),
    listFinanceClearanceCandidates(prisma),
    readFinanceSettings(prisma),
    listFinanceSettingsChanges(prisma),
    readPipelineSettings(prisma),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">
            Finance Admin
          </h1>
          <p className="mt-1 text-xs text-zk-muted">
            Manage who is allowed to run Finance agents, how verdicts are
            settled, and how many agents are needed at each research stage.
          </p>
        </div>
        <Link
          href="/finance"
          className="rounded-lg border border-zk-border bg-zk-surface px-3 py-1.5 text-xs font-medium text-zk-text2 transition hover:border-zk-accent hover:text-zk-text"
        >
          ← Back to Finance
        </Link>
      </header>

      {savedMessage ? (
        <div
          role="status"
          className="rounded-xl border border-zk-ok-fg/30 bg-zk-ok-bg px-4 py-3 text-xs font-medium text-zk-ok-fg"
        >
          {savedMessage}
        </div>
      ) : null}

      {/* 1. Agent Access & Clearance */}
      <section
        id="clearance"
        aria-labelledby="clearance-heading"
        className="rounded-2xl border border-zk-border bg-zk-surface"
      >
        <div className="border-b border-zk-divider px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="clearance-heading"
                className="text-base font-bold text-zk-text"
              >
                Agent Access &amp; Clearance
              </h2>
              <p className="mt-0.5 text-xs text-zk-muted">
                Choose which Ziki members&apos; AI agents are allowed to claim
                and run Finance research jobs. Revoking access stops their
                agents from taking new jobs immediately.
              </p>
            </div>
            <span className="rounded-full border border-zk-border bg-zk-bg px-2.5 py-0.5 text-xs font-medium tabular-nums text-zk-text2">
              {people.length} cleared
            </span>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <FinanceClearancePicker
            candidates={candidates}
            action={grantFinanceClearanceAction}
            errorMessage={clearanceError}
          />

          <div className="overflow-hidden rounded-xl border border-zk-border">
            <div className="border-b border-zk-divider bg-zk-bg px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zk-muted">
              Cleared members ({people.length})
            </div>
            {people.length === 0 ? (
              <p className="px-4 py-4 text-xs text-zk-muted">
                No members are cleared yet. Search above to grant access.
              </p>
            ) : (
              <ul className="divide-y divide-zk-divider">
                {people.map((person) => (
                  <li
                    key={person.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zk-border bg-zk-bg text-xs font-bold text-zk-accent">
                        {(person.name ?? person.email).slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zk-text">
                          {person.name ?? person.email}
                        </p>
                        <p className="truncate text-xs text-zk-muted">
                          <span className="font-mono">{person.email}</span> ·
                          Cleared {person.clearedAt.toISOString().slice(0, 10)}{" "}
                          · {person.agents}{" "}
                          {person.agents === 1 ? "agent" : "agents"}
                        </p>
                      </div>
                    </div>
                    <form action={removeFinanceClearanceAction}>
                      <input type="hidden" name="userId" value={person.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-zk-border bg-zk-bg px-3 py-1.5 text-xs font-medium text-zk-bad-fg transition hover:border-zk-bad-fg/50"
                      >
                        Revoke
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* 2. Settle Agreement Rules (Second) */}
      <section
        id="agreement"
        aria-labelledby="agreement-heading"
        className="rounded-2xl border border-zk-border bg-zk-surface"
      >
        <div className="border-b border-zk-divider px-6 py-4">
          <h2 id="agreement-heading" className="text-base font-bold text-zk-text">
            Settle Agreement Rules
          </h2>
          <p className="mt-0.5 text-xs text-zk-muted">
            Controls how daily monitoring checks reach consensus on an owned
            stock. Worker agents count as 1 vote each; Manager agents count for
            more.
          </p>
        </div>

        <form action={saveFinanceSettingsAction} className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Votes needed to settle</span>
              <input
                name="agreementNeeded"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={settings.agreementNeeded}
                className={INPUT_CLASS}
              />
              <span className="text-[11px] font-normal leading-relaxed text-zk-muted">
                Minimum weighted votes required for a Keep or Watch verdict.
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Manager vote weight</span>
              <input
                name="managerVoteWeight"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={settings.managerVoteWeight}
                className={INPUT_CLASS}
              />
              <span className="text-[11px] font-normal leading-relaxed text-zk-muted">
                How many standard votes a Manager agent&apos;s opinion counts
                for.
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Votes needed to Sell</span>
              <input
                name="sellAgreementNeeded"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={settings.sellAgreementNeeded}
                className={INPUT_CLASS}
              />
              <span className="text-[11px] font-normal leading-relaxed text-zk-muted">
                Higher bar required before recommending a Sell (must be ≥ votes
                needed to settle).
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zk-divider pt-4">
            {settingsErrorMessage ? (
              <p role="status" className="text-xs font-medium text-zk-bad-fg">
                {settingsErrorMessage}
              </p>
            ) : (
              <span className="text-xs text-zk-muted">
                Applies from the next settle; every change is logged below.
              </span>
            )}
            <button
              type="submit"
              className="rounded-lg bg-zk-accent px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Save agreement rules
            </button>
          </div>
        </form>

        {changes.length > 0 ? (
          <div className="border-t border-zk-divider bg-zk-bg/50 px-6 py-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zk-muted">
              Recent rule changes
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-zk-text2">
              {changes.map((change) => (
                <li key={change.id} className="tabular-nums">
                  {change.at.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                  <span className="font-medium text-zk-text">{change.who}</span>{" "}
                  · settle {change.before.agreementNeeded} →{" "}
                  {change.after.agreementNeeded}, manager weight{" "}
                  {change.before.managerVoteWeight} →{" "}
                  {change.after.managerVoteWeight}, sell{" "}
                  {change.before.sellAgreementNeeded} →{" "}
                  {change.after.sellAgreementNeeded}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* 3. Research Pipeline Thresholds (Third) */}
      <section
        id="pipeline"
        aria-labelledby="pipeline-heading"
        className="rounded-2xl border border-zk-border bg-zk-surface"
      >
        <div className="border-b border-zk-divider px-6 py-4">
          <h2 id="pipeline-heading" className="text-base font-bold text-zk-text">
            Research Pipeline Thresholds
          </h2>
          <p className="mt-0.5 text-xs text-zk-muted">
            Controls how new stocks move through the 4-stage research pipeline
            (Screen → Enrich → Evaluate → Review) before reaching you.
          </p>
        </div>

        <form action={savePipelineSettingsAction} className="space-y-6 p-6">
          {/* Agent staffing per stage */}
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zk-muted">
                Agents required per stage
              </h3>
              <p className="mt-0.5 text-xs text-zk-muted">
                Set how many independent agents must complete each stage before
                the stock advances.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
                <span>1. Screen</span>
                <input
                  name="researchersScreen"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={pipeline.researchersScreen}
                  className={INPUT_CLASS}
                />
                <span className="text-[11px] font-normal leading-snug text-zk-muted">
                  Agents scanning for candidates
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
                <span>2. Enrich</span>
                <input
                  name="researchersEnrich"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={pipeline.researchersEnrich}
                  className={INPUT_CLASS}
                />
                <span className="text-[11px] font-normal leading-snug text-zk-muted">
                  Agents gathering filings &amp; news
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
                <span>3. Evaluate</span>
                <input
                  name="researchersEvaluate"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={pipeline.researchersEvaluate}
                  className={INPUT_CLASS}
                />
                <span className="text-[11px] font-normal leading-snug text-zk-muted">
                  Independent Buy / Hold / Don&apos;t buy verdicts
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
                <span>4. Review panel</span>
                <input
                  name="reviewersPerStock"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={pipeline.reviewersPerStock}
                  className={INPUT_CLASS}
                />
                <span className="text-[11px] font-normal leading-snug text-zk-muted">
                  Manager agents reviewing the case
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
                <span>Review quorum</span>
                <input
                  name="reviewersWhoMustAgree"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={pipeline.reviewersWhoMustAgree}
                  className={INPUT_CLASS}
                />
                <span className="text-[11px] font-normal leading-snug text-zk-muted">
                  Managers who must vote Go to pass
                </span>
              </label>
            </div>
          </div>

          {/* Workflow & guardrails */}
          <div className="space-y-3 border-t border-zk-divider pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zk-muted">
              Screening gate &amp; guardrails
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
                <span>How a stock enters research</span>
                <select
                  name="candidateRule"
                  defaultValue={pipeline.candidateRule}
                  className={INPUT_CLASS}
                >
                  {FINANCE_CANDIDATE_RULES.map((rule) => (
                    <option key={rule} value={rule}>
                      {RULE_LABEL[rule]}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] font-normal leading-snug text-zk-muted">
                  Requires two separate agents to agree during screening so one
                  noisy pick doesn&apos;t trigger deep research.
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
                <span>Job lease timeout (minutes)</span>
                <input
                  name="stageTimeLimitMinutes"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={pipeline.stageTimeLimitMinutes}
                  className={INPUT_CLASS}
                />
                <span className="text-[11px] font-normal leading-snug text-zk-muted">
                  If an agent stalls past this limit, another agent can claim
                  the job.
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
                <span>Sector concentration warning (%)</span>
                <input
                  name="balanceShare"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  required
                  defaultValue={pipeline.balanceShare}
                  className={INPUT_CLASS}
                />
                <span className="text-[11px] font-normal leading-snug text-zk-muted">
                  Flags your portfolio if a single industry exceeds this % of
                  total value.
                </span>
              </label>
            </div>
          </div>

          {/* Dossier caps */}
          <fieldset className="space-y-3 border-t border-zk-divider pt-5">
            <div>
              <legend className="text-xs font-semibold uppercase tracking-wider text-zk-muted">
                Dossier source limits per category
              </legend>
              <p className="mt-0.5 text-xs text-zk-muted">
                Optional cap on how many links/notes agents can add to each
                evidence category. Leave blank for unlimited.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {FINANCE_EVIDENCE_SECTIONS.map((section) => (
                <label
                  key={section}
                  className="flex flex-col gap-1.5 text-xs font-medium text-zk-text"
                >
                  <span>{SECTION_LABEL[section]}</span>
                  <input
                    name={`cap_${section}`}
                    type="number"
                    min={1}
                    step={1}
                    placeholder="∞"
                    defaultValue={pipeline.dossierCaps[section] ?? ""}
                    className={INPUT_CLASS}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          {/* Browsing rules & concurrency */}
          <div className="space-y-4 border-t border-zk-divider pt-5">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Agent browsing instructions</span>
              <textarea
                name="browsingRules"
                rows={3}
                maxLength={2000}
                placeholder="Optional guidelines shown to agents (e.g. prefer primary SEC filings, respect rate limits)…"
                defaultValue={pipeline.browsingRules}
                className="w-full rounded-lg border border-zk-border bg-zk-bg px-3 py-2 text-sm text-zk-text placeholder:text-zk-muted focus:border-zk-accent focus:outline-none focus:ring-2 focus:ring-zk-accent/20"
              />
            </label>

            <label className="flex items-center gap-2.5 text-xs font-medium text-zk-text">
              <input
                type="checkbox"
                name="oneTaskPerAgent"
                defaultChecked={pipeline.oneTaskPerAgent}
                className="h-4 w-4 rounded border-zk-border accent-zk-accent"
              />
              <span>
                Limit each agent to one active Finance job at a time (prevents
                one agent from hoarding work)
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zk-divider pt-4">
            {pipelineErrorMessage ? (
              <p role="status" className="text-xs font-medium text-zk-bad-fg">
                {pipelineErrorMessage}
              </p>
            ) : (
              <span className="text-xs text-zk-muted">
                Changes take effect on the next claimed job.
              </span>
            )}
            <button
              type="submit"
              className="rounded-lg bg-zk-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Save pipeline thresholds
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
