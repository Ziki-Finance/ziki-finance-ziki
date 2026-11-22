import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  grantFinanceClearanceAction,
  removeFinanceClearanceAction,
  saveFinanceSettingsAction,
  savePipelineSettingsAction,
} from "@/app/actions/finance";
import { listFinanceCleared } from "@/lib/finance/clearance";
import { FINANCE_SETTINGS_ERRORS, listFinanceSettingsChanges, readFinanceSettings, type FinanceSettingsError } from "@/lib/finance/settings";
import {
  FINANCE_CANDIDATE_RULES,
  FINANCE_EVIDENCE_SECTIONS,
  PIPELINE_SETTINGS_ERRORS,
  readPipelineSettings,
  type PipelineSettingsError,
} from "@/lib/finance/pipeline-settings";

export const metadata = { title: "Finance clearance" };

const ERRORS: Record<string, string> = {
  invalid_email: "That doesn't look like an email address.",
  not_found: "No one has that email. They need to sign up first.",
  already_cleared: "That person is already cleared for finance work.",
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
  proposed_by_2: "2 Researchers propose it",
  proposed_1_confirmed_by_1: "1 proposes, 1 confirms",
};

const card = "rounded-xl border border-zk-border bg-zk-surface";
const primary = "rounded-md bg-zk-accent px-3 py-1.5 text-sm font-medium text-white";
const button = "rounded-md border border-zk-border px-3 py-1.5 text-sm text-zk-text2 hover:bg-zk-chip";
const numberBox = "w-20 rounded-md border border-zk-border bg-zk-surface px-2 py-1.5 text-sm";

/**
 * Site staff only (FIN-D-005). Clear a person for Ziki Finance work, set the
 * agreement numbers (FIN-D-022), and set the v3 pipeline thresholds: researcher
 * slots per stage, the reviewers bar, the candidate rule, dossier caps, the
 * stage time limit and the balance share (PRD §3).
 */
export default async function FinanceClearancePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string; section?: string }>;
}) {
  await requireSuperAdmin();
  const params = searchParams ? await searchParams : {};

  const settingsErrorMessage =
    params.section === "agreement" && params.error && params.error in FINANCE_SETTINGS_ERRORS
      ? FINANCE_SETTINGS_ERRORS[params.error as FinanceSettingsError]
      : null;
  const pipelineErrorMessage =
    params.section === "pipeline" && params.error && params.error in PIPELINE_SETTINGS_ERRORS
      ? PIPELINE_SETTINGS_ERRORS[params.error as PipelineSettingsError]
      : null;
  const clearanceError =
    params.error && !settingsErrorMessage && !pipelineErrorMessage ? (ERRORS[params.error] ?? "Something went wrong.") : null;
  const savedMessage =
    params.saved === "unchanged"
      ? "Those are the numbers already in use."
      : params.saved === "pipeline"
        ? "Saved. The new thresholds apply from the next job."
        : params.saved
          ? "Saved. They apply from the next settle."
          : null;

  const [people, settings, changes, pipeline] = await Promise.all([
    listFinanceCleared(prisma),
    readFinanceSettings(prisma),
    listFinanceSettingsChanges(prisma),
    readPipelineSettings(prisma),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-zk-text">Finance clearance</h1>
        <p className="text-sm text-zk-text2">
          Only the agents of a cleared person get Ziki Finance jobs. Removing clearance stops new finance work for their agents at once.
        </p>
      </header>

      <section id="agreement" className={card} aria-labelledby="agreement-heading">
        <h2 id="agreement-heading" className="border-b border-zk-border px-4 py-3 text-sm font-semibold text-zk-text">
          Agreement numbers
        </h2>
        <form action={saveFinanceSettingsAction} className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm text-zk-text">
              Agreement needed
              <input name="agreementNeeded" type="number" min={1} step={1} required defaultValue={settings.agreementNeeded} className={numberBox} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zk-text">
              A manager agent&apos;s vote counts
              <input name="managerVoteWeight" type="number" min={1} step={1} required defaultValue={settings.managerVoteWeight} className={numberBox} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zk-text">
              Bar for a change to Sell
              <input name="sellAgreementNeeded" type="number" min={1} step={1} required defaultValue={settings.sellAgreementNeeded} className={numberBox} />
            </label>
            <button type="submit" className={primary}>
              Save numbers
            </button>
          </div>
          <p className="text-xs text-zk-muted">
            Weighted agree verdicts a view needs. A change applies from the next settle, and is recorded below. The Sell bar can&apos;t be
            lower than the agreement needed.
          </p>
          {settingsErrorMessage ? (
            <p role="status" className="text-sm text-zk-bad-fg">
              {settingsErrorMessage}
            </p>
          ) : null}
        </form>
        {changes.length > 0 ? (
          <div className="border-t border-zk-border px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zk-muted">Recent changes</h3>
            <ul className="mt-2 space-y-1 text-sm text-zk-text2">
              {changes.map((change) => (
                <li key={change.id}>
                  {change.at.toISOString().slice(0, 16).replace("T", " ")} · {change.who} · agreement {change.before.agreementNeeded} →{" "}
                  {change.after.agreementNeeded}, manager weight {change.before.managerVoteWeight} → {change.after.managerVoteWeight}, Sell bar{" "}
                  {change.before.sellAgreementNeeded} → {change.after.sellAgreementNeeded}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section id="pipeline" className={card} aria-labelledby="pipeline-heading">
        <h2 id="pipeline-heading" className="border-b border-zk-border px-4 py-3 text-sm font-semibold text-zk-text">
          Pipeline thresholds
        </h2>
        <form action={savePipelineSettingsAction} className="space-y-4 px-4 py-3">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm text-zk-text">
              Researchers: screen
              <input name="researchersScreen" type="number" min={1} step={1} required defaultValue={pipeline.researchersScreen} className={numberBox} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zk-text">
              Researchers: enrich
              <input name="researchersEnrich" type="number" min={1} step={1} required defaultValue={pipeline.researchersEnrich} className={numberBox} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zk-text">
              Researchers: evaluate
              <input
                name="researchersEvaluate"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={pipeline.researchersEvaluate}
                className={numberBox}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zk-text">
              Reviewers per stock
              <input name="reviewersPerStock" type="number" min={1} step={1} required defaultValue={pipeline.reviewersPerStock} className={numberBox} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zk-text">
              Reviewers who must agree
              <input
                name="reviewersWhoMustAgree"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={pipeline.reviewersWhoMustAgree}
                className={numberBox}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm text-zk-text">
              Candidate rule
              <select name="candidateRule" defaultValue={pipeline.candidateRule} className="rounded-md border border-zk-border bg-zk-surface px-2 py-1.5 text-sm">
                {FINANCE_CANDIDATE_RULES.map((rule) => (
                  <option key={rule} value={rule}>
                    {RULE_LABEL[rule]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-zk-text">
              Stage time limit (minutes)
              <input
                name="stageTimeLimitMinutes"
                type="number"
                min={1}
                step={1}
                required
                defaultValue={pipeline.stageTimeLimitMinutes}
                className={numberBox}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zk-text">
              Balance share (%)
              <input name="balanceShare" type="number" min={1} max={100} step={1} required defaultValue={pipeline.balanceShare} className={numberBox} />
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zk-text">Dossier caps per section (blank = no cap)</legend>
            <div className="flex flex-wrap gap-4">
              {FINANCE_EVIDENCE_SECTIONS.map((section) => (
                <label key={section} className="flex flex-col gap-1 text-sm text-zk-text">
                  {SECTION_LABEL[section]}
                  <input name={`cap_${section}`} type="number" min={1} step={1} defaultValue={pipeline.dossierCaps[section] ?? ""} className={numberBox} />
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm text-zk-text">
            Polite-browsing rules (shown to agents and on this page)
            <textarea
              name="browsingRules"
              rows={3}
              maxLength={2000}
              defaultValue={pipeline.browsingRules}
              className="rounded-md border border-zk-border bg-zk-surface px-2 py-1.5 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-zk-text">
            <input type="checkbox" name="oneTaskPerAgent" defaultChecked={pipeline.oneTaskPerAgent} />
            An agent holds at most one Finance task at a time
          </label>

          <div className="flex items-center gap-3">
            <button type="submit" className={primary}>
              Save thresholds
            </button>
            {pipelineErrorMessage ? (
              <p role="status" className="text-sm text-zk-bad-fg">
                {pipelineErrorMessage}
              </p>
            ) : null}
          </div>
        </form>
      </section>

      <form action={grantFinanceClearanceAction} className={`${card} flex flex-wrap items-end gap-2 p-4`}>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-zk-text">
          Clear a person by email
          <input name="email" type="email" required placeholder="name@example.com" className="rounded-md border border-zk-border bg-zk-surface px-2 py-1.5 text-sm" />
        </label>
        <button type="submit" className={primary}>
          Clear for finance
        </button>
        {clearanceError ? (
          <p role="alert" className="basis-full text-sm text-zk-bad-fg">
            {clearanceError}
          </p>
        ) : null}
      </form>

      <section className={card} aria-labelledby="cleared-heading">
        <h2 id="cleared-heading" className="border-b border-zk-border px-4 py-3 text-sm font-semibold text-zk-text">
          Cleared people ({people.length})
        </h2>
        {people.length === 0 ? (
          <p className="px-4 py-3 text-sm text-zk-text2">No one is cleared yet.</p>
        ) : (
          <ul className="divide-y divide-zk-border">
            {people.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-zk-text">{person.name}</span> <span className="text-zk-text2">{person.email}</span>
                  <span className="block text-xs text-zk-muted">
                    Cleared {person.clearedAt.toISOString().slice(0, 10)} · {person.agents} {person.agents === 1 ? "agent" : "agents"}
                  </span>
                </span>
                <form action={removeFinanceClearanceAction}>
                  <input type="hidden" name="userId" value={person.id} />
                  <button type="submit" className={button}>
                    Remove clearance
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {savedMessage ? (
        <p role="status" className="text-sm text-zk-text2">
          {savedMessage}
        </p>
      ) : null}
    </div>
  );
}
