"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deleteFinanceCriteriaAction,
  saveFinanceCriteriaAction,
  type FinanceCriteriaActionResult,
} from "@/app/actions/finance-criteria";
import { Button } from "@/components/ui/button";
import { FieldError, useFieldErrors } from "@/components/ui/field-errors";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { FinanceCriteriaView } from "@/lib/finance/criteria";
import {
  FINANCE_PRESETS,
  FINANCE_STOCK_COUNTS,
  financeCriteriaTitle,
  financePresetValues,
  type FinancePreset,
} from "@/lib/validations/finance";

const FORM_ID = "finance-criteria";

const STAGE_LABELS: Record<string, string> = {
  screen: "Screening",
  enrich: "Enriching",
  evaluate: "Evaluating",
  review: "In review",
  decide: "Deciding",
  done: "Done",
};

const COMPANY_SIZE_LABELS: Record<string, string> = {
  any: "Any size",
  small: "Small (under $2B)",
  mid: "Mid ($2B–$10B)",
  large: "Large ($10B and up)",
};

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The criteria form and list (FIN-CR-013, Stream A, job 3). Saving creates a
 * version and starts a run; editing writes a new version and starts another.
 */
export function FinanceCriteriaManager({
  initialCriteria,
}: {
  initialCriteria: FinanceCriteriaView[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const { fieldErrors, show, clear, attrs } = useFieldErrors(FORM_ID, formRef);

  const [editing, setEditing] = useState<FinanceCriteriaView | null>(null);
  const [preset, setPreset] = useState<FinancePreset>("own_words");
  const [formKey, setFormKey] = useState(0);

  const [saveState, saveAction, saving] = useActionState<
    FinanceCriteriaActionResult | undefined,
    FormData
  >(saveFinanceCriteriaAction, undefined);
  const [deleteState, deleteAction, deleting] = useActionState<
    FinanceCriteriaActionResult | undefined,
    FormData
  >(deleteFinanceCriteriaAction, undefined);

  useEffect(() => {
    if (!saveState) return;
    if (saveState.ok) {
      clear();
      toast("Criteria saved. A new run started.", "success");
      setEditing(null);
      setPreset("own_words");
      setFormKey((key) => key + 1);
    } else {
      show(saveState);
    }
  }, [saveState, show, clear, toast]);

  useEffect(() => {
    if (!deleteState) return;
    if (deleteState.ok) {
      toast("Criteria deleted, with the runs it started.", "success");
      if (editing && deleteState.criteriaId === editing.id) {
        setEditing(null);
        setPreset("own_words");
        setFormKey((key) => key + 1);
      }
    } else {
      toast(deleteState.error ?? "The criteria could not be deleted.", "error");
    }
  }, [deleteState, editing, toast]);

  function startEditing(item: FinanceCriteriaView) {
    setEditing(item);
    setPreset(item.preset as FinancePreset);
    setFormKey((key) => key + 1);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEditing() {
    setEditing(null);
    setPreset("own_words");
    setFormKey((key) => key + 1);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <section aria-labelledby="finance-criteria-form-title">
        <form
          key={formKey}
          ref={formRef}
          action={saveAction}
          className="space-y-4 rounded-[20px] border border-zk-border bg-zk-surface p-5"
          noValidate
        >
          <div>
            <h2
              id="finance-criteria-form-title"
              className="text-sm font-bold text-zk-text"
            >
              {editing ? "Edit criteria" : "New criteria"}
            </h2>
            <p className="mt-1 text-xs text-zk-muted">
              {editing
                ? "Saving writes a new version and starts a new run. The old run keeps its criteria."
                : "Saving starts a screening run your agents can pick up."}
            </p>
          </div>

          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <div>
            <label
              htmlFor="preset"
              className="block text-sm font-medium text-zk-text"
            >
              Start from
            </label>
            <Select
              id="preset"
              name="preset"
              value={preset}
              onChange={(event) => setPreset(event.target.value as FinancePreset)}
              className="mt-1"
              {...attrs("preset")}
            >
              {financePresetValues.map((value) => (
                <option key={value} value={value}>
                  {FINANCE_PRESETS[value].label}
                </option>
              ))}
            </Select>
            <FieldError formId={FORM_ID} field="preset" errors={fieldErrors} />
          </div>

          <div>
            <label
              htmlFor="words"
              className="block text-sm font-medium text-zk-text"
            >
              {preset === "own_words"
                ? "What are you looking for?"
                : "Your own words (optional)"}
            </label>
            <Textarea
              id="words"
              name="words"
              rows={4}
              defaultValue={editing?.words ?? ""}
              placeholder={
                preset === "own_words"
                  ? "e.g. Profitable companies with low debt, a growing dividend and a price I can hold for ten years."
                  : FINANCE_PRESETS[preset].words
              }
              className="mt-1"
              {...attrs("words")}
            />
            <FieldError formId={FORM_ID} field="words" errors={fieldErrors} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="companySize"
                className="block text-sm font-medium text-zk-text"
              >
                Company size
              </label>
              <Select
                id="companySize"
                name="companySize"
                defaultValue={editing?.companySize ?? "any"}
                className="mt-1"
                {...attrs("companySize")}
              >
                {Object.entries(COMPANY_SIZE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <FieldError
                formId={FORM_ID}
                field="companySize"
                errors={fieldErrors}
              />
            </div>

            <div>
              <label
                htmlFor="howManyStocks"
                className="block text-sm font-medium text-zk-text"
              >
                How many stocks
              </label>
              <Select
                id="howManyStocks"
                name="howManyStocks"
                defaultValue={String(editing?.howManyStocks ?? 10)}
                className="mt-1"
                {...attrs("howManyStocks")}
              >
                {FINANCE_STOCK_COUNTS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </Select>
              <FieldError
                formId={FORM_ID}
                field="howManyStocks"
                errors={fieldErrors}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="industries"
              className="block text-sm font-medium text-zk-text"
            >
              Industries (comma separated)
            </label>
            <Input
              id="industries"
              name="industries"
              defaultValue={editing?.industries.join(", ") ?? ""}
              placeholder="software, banks, healthcare"
              className="mt-1"
              {...attrs("industries")}
            />
            <FieldError formId={FORM_ID} field="industries" errors={fieldErrors} />
          </div>

          <div>
            <label
              htmlFor="leaveOut"
              className="block text-sm font-medium text-zk-text"
            >
              Leave out (comma separated)
            </label>
            <Input
              id="leaveOut"
              name="leaveOut"
              defaultValue={editing?.leaveOut.join(", ") ?? ""}
              placeholder="tobacco, gambling"
              className="mt-1"
              {...attrs("leaveOut")}
            />
            <FieldError formId={FORM_ID} field="leaveOut" errors={fieldErrors} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : editing
                  ? "Save as new version"
                  : "Save and start research"}
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" onClick={cancelEditing}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section aria-labelledby="finance-criteria-list-title" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="finance-criteria-list-title"
            className="text-sm font-bold text-zk-text"
          >
            Your criteria
          </h2>
          <span className="text-xs text-zk-muted">
            {initialCriteria.length} saved
          </span>
        </div>

        {initialCriteria.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-zk-border bg-zk-surface p-5 text-sm text-zk-muted">
            No criteria yet. Write what you are looking for, or start from a
            preset.
          </p>
        ) : (
          <ul className="space-y-3">
            {initialCriteria.map((item) => (
              <li
                key={item.id}
                className="rounded-[20px] border border-zk-border bg-zk-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zk-text">
                      {financeCriteriaTitle(item)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-zk-muted">
                      {item.words}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-zk-chip px-2 py-0.5 text-[11px] font-semibold text-zk-text2">
                    v{item.latestVersion}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Tag>
                    {item.companySize === "any"
                      ? "Any size"
                      : COMPANY_SIZE_LABELS[item.companySize]}
                  </Tag>
                  {item.industries.map((industry) => (
                    <Tag key={`in-${industry}`}>{industry}</Tag>
                  ))}
                  {item.leaveOut.map((industry) => (
                    <Tag key={`out-${industry}`} tone="out">
                      not {industry}
                    </Tag>
                  ))}
                  <Tag>{item.howManyStocks} stocks</Tag>
                </div>

                <p className="mt-3 text-xs text-zk-muted">
                  {item.versionCount}{" "}
                  {item.versionCount === 1 ? "version" : "versions"} ·{" "}
                  {item.runCount} {item.runCount === 1 ? "run" : "runs"}
                  {item.latestRun
                    ? ` · latest ${STAGE_LABELS[item.latestRun.stage] ?? item.latestRun.stage} with ${item.latestRun.candidateCount} ${
                        item.latestRun.candidateCount === 1
                          ? "candidate"
                          : "candidates"
                      }`
                    : ""}{" "}
                  · saved {formatDate(item.updatedAt)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => startEditing(item)}
                  >
                    Edit
                  </Button>
                  <form
                    action={deleteAction}
                    onSubmit={(event) => {
                      if (
                        !window.confirm(
                          "Delete these criteria and every run they started?",
                        )
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" variant="danger-secondary" disabled={deleting}>
                      {deleting ? "Deleting…" : "Delete"}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-zk-muted">
          Your agents read the screening jobs from{" "}
          <code className="rounded bg-zk-chip px-1.5 py-0.5 font-mono text-[11px] text-zk-text2">
            GET /api/v1/finance/jobs
          </code>{" "}
          and propose stocks with{" "}
          <code className="rounded bg-zk-chip px-1.5 py-0.5 font-mono text-[11px] text-zk-text2">
            POST /api/v1/finance/candidates
          </code>
          .
        </p>
      </section>
    </div>
  );
}

function Tag({
  children,
  tone = "in",
}: {
  children: ReactNode;
  tone?: "in" | "out";
}) {
  return (
    <span
      className={
        tone === "out"
          ? "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
          : "rounded-full border border-zk-border bg-zk-bg px-2 py-0.5 text-[11px] font-medium text-zk-text2"
      }
    >
      {children}
    </span>
  );
}
