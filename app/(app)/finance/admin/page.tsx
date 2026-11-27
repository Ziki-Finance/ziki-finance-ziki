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
  FINANCE_EVIDENCE_SECTIONS,
  PIPELINE_SETTINGS_ERRORS,
  proposalsRequiredFromRule,
  readPipelineSettings,
  type PipelineSettingsError,
} from "@/lib/finance/pipeline-settings";
import { FinanceClearancePicker } from "@/components/finance/finance-clearance-picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finance Admin" };

const ERRORS: Record<string, string> = {
  invalid_email: "Please enter a valid email address.",
  not_found: "No account exists with that email yet.",
  already_cleared: "That member already has access.",
};

const SECTION_LABEL: Record<string, string> = {
  business: "Business",
  numbers: "Numbers",
  filings: "Filings",
  news: "News",
  social: "Social",
  market_context: "Market context",
};

const INPUT_CLASS =
  "w-full rounded-lg border border-zk-border bg-zk-bg px-3 py-2 text-sm tabular-nums text-zk-text focus:border-zk-accent focus:outline-none focus:ring-2 focus:ring-zk-accent/20";

/**
 * Site staff only (FIN-D-005). Manage member access, voting rules, and
 * research pipeline settings.
 */
export default async function FinanceAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    saved?: string;
    section?: string;
    count?: string;
    skipped?: string;
  }>;
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
  const grantedCount = Number(params.count ?? 1);
  const skippedCount = Number(params.skipped ?? 0);
  const savedMessage =
    params.saved === "clearance"
      ? `Access granted to ${grantedCount} ${grantedCount === 1 ? "member" : "members"}${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}.`
      : params.saved === "revoked"
        ? "Access removed."
        : params.saved === "unchanged"
          ? "No changes saved."
          : params.saved === "pipeline"
            ? "Pipeline settings saved."
            : params.saved
              ? "Voting rules saved."
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">
            Finance Admin
          </h1>
          <p className="mt-1 text-xs text-zk-muted">
            Manage team access, voting rules, and research pipeline settings.
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

      {/* 1. Team Access */}
      <section
        id="clearance"
        aria-labelledby="clearance-heading"
        className="rounded-2xl border border-zk-border bg-zk-surface"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zk-divider px-6 py-4">
          <div>
            <h2
              id="clearance-heading"
              className="text-base font-bold text-zk-text"
            >
              Team Access
            </h2>
            <p className="mt-0.5 text-xs text-zk-muted">
              Only agents belonging to cleared members can run Finance jobs.
            </p>
          </div>
          <span className="rounded-full border border-zk-border bg-zk-bg px-2.5 py-0.5 text-xs font-medium tabular-nums text-zk-text2">
            {people.length} cleared
          </span>
        </div>

        <div className="space-y-5 p-6">
          <FinanceClearancePicker
            key={people.map((p) => p.id).join(",")}
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
                No members cleared yet.
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
                          <span className="font-mono">{person.email}</span> ·{" "}
                          {person.agents}{" "}
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
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* 2. Voting Rules */}
      <section
        id="agreement"
        aria-labelledby="agreement-heading"
        className="rounded-2xl border border-zk-border bg-zk-surface"
      >
        <div className="border-b border-zk-divider px-6 py-4">
          <h2 id="agreement-heading" className="text-base font-bold text-zk-text">
            Voting Rules
          </h2>
          <p className="mt-0.5 text-xs text-zk-muted">
            How many weighted votes agents need to agree on an owned stock.
          </p>
        </div>

        <form action={saveFinanceSettingsAction} className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Votes to agree</span>
              <input
                name="agreementNeeded"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={settings.agreementNeeded}
                className={INPUT_CLASS}
              />
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
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Votes to sell</span>
              <input
                name="sellAgreementNeeded"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={settings.sellAgreementNeeded}
                className={INPUT_CLASS}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zk-divider pt-4">
            {settingsErrorMessage ? (
              <p role="status" className="text-xs font-medium text-zk-bad-fg">
                {settingsErrorMessage}
              </p>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="rounded-lg bg-zk-accent px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Save
            </button>
          </div>
        </form>

        {changes.length > 0 ? (
          <div className="border-t border-zk-divider bg-zk-bg/50 px-6 py-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zk-muted">
              Recent changes
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-zk-text2">
              {changes.map((change) => (
                <li key={change.id} className="tabular-nums">
                  {change.at.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                  <span className="font-medium text-zk-text">{change.who}</span>{" "}
                  · agree {change.before.agreementNeeded} →{" "}
                  {change.after.agreementNeeded}, weight{" "}
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

      {/* 3. Research Pipeline */}
      <section
        id="pipeline"
        aria-labelledby="pipeline-heading"
        className="rounded-2xl border border-zk-border bg-zk-surface"
      >
        <div className="border-b border-zk-divider px-6 py-4">
          <h2 id="pipeline-heading" className="text-base font-bold text-zk-text">
            Research Pipeline
          </h2>
          <p className="mt-0.5 text-xs text-zk-muted">
            Number of agents per stage and limits for new stock research.
          </p>
        </div>

        <form action={savePipelineSettingsAction} className="space-y-6 p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Screen</span>
              <input
                name="researchersScreen"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={pipeline.researchersScreen}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Research</span>
              <input
                name="researchersEnrich"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={pipeline.researchersEnrich}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Evaluate</span>
              <input
                name="researchersEvaluate"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={pipeline.researchersEvaluate}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Reviewers</span>
              <input
                name="reviewersPerStock"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={pipeline.reviewersPerStock}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Must agree</span>
              <input
                name="reviewersWhoMustAgree"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={pipeline.reviewersWhoMustAgree}
                className={INPUT_CLASS}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-5 border-t border-zk-divider pt-5 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Agents to qualify</span>
              <input
                name="candidateRule"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={proposalsRequiredFromRule(pipeline.candidateRule)}
                className={INPUT_CLASS}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Job timeout (minutes)</span>
              <input
                name="stageTimeLimitMinutes"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={pipeline.stageTimeLimitMinutes}
                className={INPUT_CLASS}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Sector limit (%)</span>
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
            </label>
          </div>

          <fieldset className="space-y-3 border-t border-zk-divider pt-5">
            <legend className="text-xs font-medium text-zk-text">
              Max sources per category (leave blank for unlimited)
            </legend>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {FINANCE_EVIDENCE_SECTIONS.map((section) => (
                <label
                  key={section}
                  className="flex flex-col gap-1.5 text-xs font-medium text-zk-text"
                >
                  <span className="text-zk-text2">
                    {SECTION_LABEL[section]}
                  </span>
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

          <div className="space-y-4 border-t border-zk-divider pt-5">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zk-text">
              <span>Browsing instructions (optional)</span>
              <textarea
                name="browsingRules"
                rows={3}
                maxLength={2000}
                placeholder="Any extra instructions for agents..."
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
              <span>One active Finance job per agent</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zk-divider pt-4">
            {pipelineErrorMessage ? (
              <p role="status" className="text-xs font-medium text-zk-bad-fg">
                {pipelineErrorMessage}
              </p>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="rounded-lg bg-zk-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Save
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
