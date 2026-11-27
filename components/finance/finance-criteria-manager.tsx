"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  deleteFinanceCriteriaAction,
  saveFinanceCriteriaAction,
  type FinanceCriteriaActionResult,
} from "@/app/actions/finance-criteria";
import { Button } from "@/components/ui/button";
import { FieldError, useFieldErrors } from "@/components/ui/field-errors";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { FinanceCriteriaView } from "@/lib/finance/criteria";
import {
  FINANCE_PRESETS,
  financeCriteriaTitle,
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

const QUICK_PRESETS: Exclude<FinancePreset, "own_words">[] = [
  "quality_at_a_fair_price",
  "steady_dividend_growers",
  "long_term_growth_leaders",
];

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function CriteriaModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: FinanceCriteriaView | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <CriteriaModalInner
      key={editing?.id ?? "new"}
      editing={editing}
      onClose={onClose}
    />
  );
}

function CriteriaModalInner({
  editing,
  onClose,
}: {
  editing: FinanceCriteriaView | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const { fieldErrors, show, clear, attrs } = useFieldErrors(FORM_ID, formRef);

  const [preset, setPreset] = useState<FinancePreset>(
    (editing?.preset as FinancePreset) ?? "own_words",
  );
  const [words, setWords] = useState(editing?.words ?? "");

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
      toast("Criteria saved. A new screening run started.", "success");
      onClose();
      router.refresh();
    } else {
      show(saveState);
    }
  }, [saveState, show, clear, toast, onClose, router]);

  useEffect(() => {
    if (!deleteState) return;
    if (deleteState.ok) {
      toast("Criteria deleted.", "success");
      onClose();
      router.refresh();
    } else if (deleteState.error) {
      toast(deleteState.error, "error");
    }
  }, [deleteState, toast, onClose, router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finance-criteria-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-zk-border bg-zk-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="finance-criteria-modal-title"
              className="text-lg font-bold text-zk-text"
            >
              {editing ? "Edit research criteria" : "New research criteria"}
            </h2>
            <p className="mt-1 text-xs text-zk-muted">
              {editing
                ? "Saving writes a new version and starts a fresh screening run."
                : "Describe the companies you want Ziki's agents to find in plain English."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close criteria modal"
            className="rounded-lg border border-zk-border px-2.5 py-1 text-xs text-zk-muted hover:text-zk-text"
          >
            ✕
          </button>
        </div>

        <form
          ref={formRef}
          action={saveAction}
          className="mt-5 space-y-4"
          noValidate
        >
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <input type="hidden" name="preset" value={preset} />
          <input
            type="hidden"
            name="companySize"
            value={editing?.companySize ?? "any"}
          />
          <input
            type="hidden"
            name="howManyStocks"
            value={String(editing?.howManyStocks ?? 10)}
          />
          <input
            type="hidden"
            name="industries"
            value={editing?.industries.join(", ") ?? ""}
          />
          <input
            type="hidden"
            name="leaveOut"
            value={editing?.leaveOut.join(", ") ?? ""}
          />

          <div className="space-y-2">
            <p className="text-xs font-medium text-zk-muted">
              Quick start (click to prefill)
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PRESETS.map((key) => {
                const selected = preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setPreset(key);
                      setWords(FINANCE_PRESETS[key].words);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selected
                        ? "border-zk-accent bg-zk-tint text-zk-accent"
                        : "border-zk-border bg-zk-bg text-zk-text2 hover:border-zk-accent/60"
                    }`}
                  >
                    {FINANCE_PRESETS[key].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="words"
              className="block text-xs font-medium text-zk-text"
            >
              What are you looking for?
            </label>
            <Textarea
              id="words"
              name="words"
              rows={4}
              value={words}
              onChange={(event) => setWords(event.target.value)}
              placeholder="e.g. Durable, profitable companies with low debt, a growing dividend, and a price I can hold for ten years."
              className="mt-1.5"
              {...attrs("words")}
            />
            <FieldError formId={FORM_ID} field="words" errors={fieldErrors} />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-zk-border pt-4">
            <div>
              {editing ? (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("id", editing.id);
                    deleteAction(fd);
                  }}
                  className="rounded-lg border border-zk-border px-3 py-1.5 text-xs font-medium text-zk-bad-fg transition hover:border-zk-bad-fg/50 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete criteria"}
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving…"
                  : editing
                    ? "Save new version"
                    : "Save & start research"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Side-rail list of saved criteria with modal-based creation and editing.
 */
export function FinanceCriteriaManager({
  initialCriteria,
  activeCriteriaId,
  onSelectCriteria,
  onOpenNew,
  onOpenEdit,
}: {
  initialCriteria: FinanceCriteriaView[];
  activeCriteriaId: string | null;
  onSelectCriteria?: (id: string) => void;
  onOpenNew: () => void;
  onOpenEdit: (item: FinanceCriteriaView) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [deleteState, deleteAction, deleting] = useActionState<
    FinanceCriteriaActionResult | undefined,
    FormData
  >(deleteFinanceCriteriaAction, undefined);

  useEffect(() => {
    if (!deleteState) return;
    if (deleteState.ok) {
      toast("Criteria deleted, with the runs it started.", "success");
      router.refresh();
    } else {
      toast(deleteState.error ?? "The criteria could not be deleted.", "error");
    }
  }, [deleteState, toast, router]);

  return (
    <section
      aria-labelledby="finance-criteria-list-title"
      className="rounded-2xl border border-zk-border bg-zk-surface p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2
            id="finance-criteria-list-title"
            className="text-sm font-bold text-zk-text"
          >
            Saved Criteria
          </h2>
          <p className="text-[11px] text-zk-muted">
            {initialCriteria.length}{" "}
            {initialCriteria.length === 1 ? "strategy" : "strategies"}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenNew}
          className="text-xs font-semibold text-zk-accent hover:underline"
        >
          + New
        </button>
      </div>

      {initialCriteria.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zk-border bg-zk-bg p-4 text-center space-y-2">
          <p className="text-xs text-zk-muted">
            No criteria yet. Add a strategy to start agent screening.
          </p>
          <Button type="button" variant="secondary" onClick={onOpenNew}>
            + Add criteria
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {initialCriteria.map((item) => {
            const isSelected = activeCriteriaId === item.id;
            return (
              <li
                key={item.id}
                className={`rounded-xl border p-3.5 transition ${
                  isSelected
                    ? "border-zk-accent/60 bg-zk-tint/40"
                    : "border-zk-border bg-zk-bg"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectCriteria?.(item.id)}
                    className="min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-zk-text">
                        {financeCriteriaTitle(item)}
                      </span>
                      <span className="shrink-0 rounded bg-zk-chip px-1.5 py-0.5 text-[10px] font-semibold text-zk-text2">
                        v{item.latestVersion}
                      </span>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenEdit(item)}
                      className="text-[11px] font-medium text-zk-muted hover:text-zk-text"
                    >
                      Edit
                    </button>
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
                      <button
                        type="submit"
                        disabled={deleting}
                        className="text-[11px] font-medium text-zk-bad-fg/80 hover:text-zk-bad-fg disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zk-muted">
                  {item.words}
                </p>

                <div className="mt-2.5 flex items-center justify-between border-t border-zk-divider pt-2 text-[11px] text-zk-muted">
                  <span>
                    {item.runCount} {item.runCount === 1 ? "run" : "runs"}
                    {item.latestRun
                      ? ` · ${STAGE_LABELS[item.latestRun.stage] ?? item.latestRun.stage} (${item.latestRun.candidateCount})`
                      : ""}
                  </span>
                  <span>{formatDate(item.updatedAt)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
