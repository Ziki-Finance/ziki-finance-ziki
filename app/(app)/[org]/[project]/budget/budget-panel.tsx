"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fundBudgetAction, setBudgetPausedAction, takeBackBudgetAction } from "@/app/actions/coins";
import { financeHref } from "@/lib/finance-paths";

type Result = { ok: true; message: string } | { ok: false; error: string };

const primary =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-control bg-electric-blue-strong px-4 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-zk-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

/** Runs one budget action and shows what it said; refreshes the page when it worked. */
function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (action: () => Promise<Result>, after?: () => void) => {
    setNote(null);
    startTransition(async () => {
      const result = await action();
      setNote({ ok: result.ok, text: result.ok ? result.message : result.error });
      if (result.ok) {
        after?.();
        router.refresh();
      }
    });
  };
  const message = note ? <p role="status" className={`m-0 text-sm font-semibold ${note.ok ? "text-zk-ok-fg" : "text-zk-warn-fg"}`}>{note.text}</p> : null;
  return { pending, run, message };
}

/**
 * Fund the project (#project-budget): Ziks from the owner's wallet into the budget. The request id is made when the form
 * first draws, so a double click or a retry funds once.
 */
/**
 * `suggested` (#price-lock) is what the project's priced issues call for, with room for the next few: the box starts with
 * it. `waiting` is what the issues waiting for funding need now, for an owner who would rather fund only those. Either
 * can be picked with one tap, and the amount can still be changed.
 */
export function FundForm({ projectId, wallet, suggested = 0, waiting = null }: { projectId: string; wallet: number; suggested?: number; waiting?: { need: number; count: number } | null }) {
  const { pending, run, message } = useAction();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState(suggested > 0 ? String(suggested) : "");
  const value = Number(amount);
  const valid = amount !== "" && Number.isInteger(value) && value > 0 && value <= wallet;
  const shortBy = Math.max(0, value - wallet);
  const choices = [
    ...(suggested > 0
      ? [{ id: "suggested", amount: suggested, title: "Keep the project going", hint: `What waits now, and room for the next few issues at your project's average price. New issues are funded from it as they're priced.` }]
      : []),
    ...(waiting && waiting.need > 0 && waiting.need !== suggested
      ? [{ id: "waiting", amount: waiting.need, title: "Just what's waiting", hint: `The ${waiting.count} ${waiting.count === 1 ? "issue" : "issues"} priced and waiting for funding now, nothing more.` }]
      : []),
  ];

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        run(() => fundBudgetAction(projectId, value, requestId), () => {
          setAmount("");
          setRequestId(crypto.randomUUID());
        });
      }}
    >
      {choices.length > 0 ? (
        <div role="group" aria-label="Suggested amounts" className="grid gap-2 sm:grid-cols-2">
          {choices.map((choice) => {
            const on = value === choice.amount;
            return (
              <button
                key={choice.id}
                type="button"
                aria-pressed={on}
                onClick={() => setAmount(String(choice.amount))}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue ${on ? "border-electric-blue-strong bg-zk-tint" : "border-zk-border bg-zk-surface hover:bg-zk-chip"}`}
              >
                <span className="text-sm font-bold text-zk-text">{choice.title}</span>
                <span className="text-lg font-extrabold tabular-nums text-zk-text">{choice.amount.toLocaleString("en-US")} Ziks</span>
                <span className="text-xs text-zk-muted">{choice.hint}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <label className="text-sm font-bold text-zk-text" htmlFor="budget-amount">{choices.length > 0 ? "Or choose an amount" : "How many Ziks?"}</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="budget-amount"
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))}
          placeholder="e.g. 100000"
          className="h-11 w-full rounded-full border border-zk-border bg-zk-surface px-4 text-sm font-semibold tabular-nums text-zk-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue sm:max-w-xs"
        />
        <button type="submit" disabled={!valid || pending} className={primary}>
          {pending ? "Adding…" : valid ? `Add ${value.toLocaleString("en-US")} ${value === 1 ? "Zik" : "Ziks"}` : "Add to budget"}
        </button>
      </div>
      <p className="m-0 text-xs text-zk-muted">
        You have {wallet.toLocaleString("en-US")} {wallet === 1 ? "Zik" : "Ziks"}.{" "}
        <Link href={financeHref("buy")} className="font-semibold text-zk-accent hover:underline">
          {shortBy > 0 ? `Buy ${shortBy.toLocaleString("en-US")} more Ziks` : "Buy Ziks"}
        </Link>
      </p>
      {message}
    </form>
  );
}

/** Take back what the budget hasn't reserved, to the people who funded it. */
export function TakeBackButton({ projectId, available }: { projectId: string; available: number }) {
  const { pending, run, message } = useAction();
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => run(() => takeBackBudgetAction(projectId))} disabled={pending || available <= 0} className={`${primary} self-start`}>
        {pending ? "Taking back…" : available > 0 ? `Take back ${available.toLocaleString("en-US")} ${available === 1 ? "Zik" : "Ziks"}` : "Nothing to take back"}
      </button>
      {message}
    </div>
  );
}

/** Pause or resume the project's budget. */
export function PauseButton({ projectId, paused }: { projectId: string; paused: boolean }) {
  const { pending, run, message } = useAction();
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => run(() => setBudgetPausedAction(projectId, !paused))} disabled={pending} className={`${primary} self-start`}>
        {pending ? "Saving…" : paused ? "Resume the project" : "Pause the project"}
      </button>
      {message}
    </div>
  );
}
