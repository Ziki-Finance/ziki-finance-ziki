"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  submitFinanceFreshCheck,
  submitFinanceOwnerAction,
  submitFinanceTrade,
} from "@/app/actions/finance-portfolio";
import type { portfolioForOwner } from "@/lib/finance/portfolio";

type Portfolio = Awaited<ReturnType<typeof portfolioForOwner>>;
export type FinanceLogEntry = {
  id: string;
  tickerId: string;
  kind: string;
  actorLabel: string;
  createdAt: string;
  description: string;
};

export const financePrimaryButton =
  "inline-flex items-center justify-center rounded-lg bg-zk-accent px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zk-accent";
const secondary =
  "rounded-lg border border-zk-border px-3 py-2 text-xs font-medium text-zk-text hover:bg-zk-chip disabled:opacity-50";

const money = (value: number | null) =>
  value === null
    ? null
    : value.toLocaleString("en-US", { style: "currency", currency: "USD" });

const percent = (value: number | null) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

const reasonLabel: Record<string, string> = {
  holds: "Holds",
  weakening: "Weakening",
  broken: "Broken",
  not_checked: "Not checked yet",
};

function reasonBadgeClass(status: string): string {
  if (status === "holds") return "bg-zk-ok-bg text-zk-ok-fg";
  if (status === "weakening") return "bg-zk-warn-bg text-zk-warn-fg";
  if (status === "broken") return "bg-zk-bad-bg text-zk-bad-fg";
  return "border border-zk-border bg-zk-chip text-zk-muted";
}

export function TradeButton({
  symbol,
  decisionId,
  label = "+ Log a trade",
  variant = "primary",
}: {
  symbol?: string;
  decisionId?: string;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={variant === "secondary" ? secondary : financePrimaryButton}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <TradeDialog
          symbol={symbol}
          decisionId={decisionId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TradeDialog({
  symbol,
  decisionId,
  onClose,
}: {
  symbol?: string;
  decisionId?: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [requestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        if (pending) event.preventDefault();
        else onClose();
      }}
      onClose={onClose}
      aria-labelledby="finance-trade-heading"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-zk-border bg-zk-surface p-6 text-zk-text shadow-xl backdrop:bg-black/40"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 id="finance-trade-heading" className="text-lg font-bold">
          Log a trade{symbol ? ` · ${symbol}` : ""}
        </h2>
        <button
          type="button"
          className={secondary}
          disabled={pending}
          onClick={onClose}
          aria-label="Close trade form"
        >
          ×
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setError(undefined);
          startTransition(async () => {
            const result = await submitFinanceTrade({
              symbol: data.get("symbol"),
              side: data.get("side"),
              shares: data.get("shares"),
              price: String(data.get("price") || "").trim() || undefined,
              date: data.get("date"),
              decisionId,
              requestId,
            });
            if (result.ok) onClose();
            else setError(result.error);
          });
        }}
        className="space-y-4"
      >
        <label className="block text-xs font-medium">
          US stock ticker
          <input
            name="symbol"
            defaultValue={symbol}
            required
            maxLength={8}
            readOnly={Boolean(symbol)}
            className="mt-1 block w-full rounded-lg border border-zk-border bg-zk-bg p-2 text-sm uppercase"
          />
        </label>
        <label className="block text-xs font-medium">
          Trade
          <select
            name="side"
            className="mt-1 block w-full rounded-lg border border-zk-border bg-zk-bg p-2 text-sm"
          >
            <option value="bought">Bought</option>
            <option value="sold">Sold</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-xs font-medium">
            Shares
            <input
              name="shares"
              inputMode="decimal"
              required
              placeholder="10"
              className="mt-1 block w-full rounded-lg border border-zk-border bg-zk-bg p-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium">
            Price per share ($)
            <input
              name="price"
              inputMode="decimal"
              placeholder="Closing price"
              className="mt-1 block w-full rounded-lg border border-zk-border bg-zk-bg p-2 text-sm"
            />
          </label>
        </div>
        <label className="block text-xs font-medium">
          Trade date
          <input
            type="date"
            name="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            max={new Date().toISOString().slice(0, 10)}
            className="mt-1 block w-full rounded-lg border border-zk-border bg-zk-bg p-2 text-sm"
          />
        </label>
        <p className="text-xs leading-relaxed text-zk-muted">
          Record a trade you made. If the closing price is unavailable, enter
          the price paid.
        </p>
        {error && (
          <p role="alert" className="text-sm text-zk-bad-fg">
            {error}
          </p>
        )}
        <button
          className={`${financePrimaryButton} w-full`}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save trade"}
        </button>
      </form>
    </dialog>
  );
}

export function FreshCheckButton({ holdingId }: { holdingId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className="text-xs font-semibold text-zk-accent hover:underline disabled:opacity-50"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await submitFinanceFreshCheck({
              holdingId,
              requestId: crypto.randomUUID(),
            });
            setMessage(result.ok ? "Fresh check queued." : result.error);
          })
        }
      >
        {pending ? "Queuing…" : "Ask for fresh check"}
      </button>
      {message && (
        <span role="status" className="text-[11px] text-zk-text2">
          {message}
        </span>
      )}
    </div>
  );
}

export function DecisionActions({
  decisionId,
  symbol,
  call,
}: {
  decisionId: string;
  symbol: string;
  call: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [reason, setReason] = useState("");
  return (
    <div className="mt-5 space-y-3 border-t border-zk-border pt-4">
      <label className="block text-xs text-zk-muted">
        Your note (optional)
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1500}
          className="mt-1 block w-full rounded-lg border border-zk-border bg-zk-bg p-2 text-sm text-zk-text"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <TradeButton
          symbol={symbol}
          decisionId={decisionId}
          label={call === "go" ? "I bought this" : `Log a trade (${symbol})`}
        />
        {(["watch", "not_for_me"] as const).map((action) => (
          <button
            key={action}
            type="button"
            className={secondary}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await submitFinanceOwnerAction({
                  decisionId,
                  action,
                  reason,
                });
                setMessage(result.ok ? "Saved." : result.error);
              })
            }
          >
            {action === "watch" ? "Watch it" : "Not for me"}
          </button>
        ))}
      </div>
      {message && (
        <p role="status" className="text-xs text-zk-text2">
          {message}
        </p>
      )}
    </div>
  );
}

function ChangeLog({ entries }: { entries: FinanceLogEntry[] }) {
  return (
    <section className="mt-5 border-t border-zk-border pt-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zk-muted">
        Change log
      </h3>
      {!entries.length ? (
        <p className="text-xs text-zk-muted">No changes recorded yet.</p>
      ) : (
        <ol className="divide-y divide-zk-divider">
          {entries.map((entry) => (
            <li key={entry.id} className="space-y-1 py-3">
              <p className="text-xs leading-relaxed text-zk-text2">
                {entry.description}
              </p>
              <p className="text-[11px] text-zk-muted">
                {new Date(entry.createdAt).toLocaleString()} ·{" "}
                {entry.actorLabel}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function PortfolioCard({
  portfolio,
  changes,
}: {
  portfolio: Portfolio;
  changes: FinanceLogEntry[];
}) {
  const totalValue = portfolio.totalValue;
  return (
    <section
      aria-label="Portfolio"
      className="rounded-2xl border border-zk-border bg-zk-surface p-5 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zk-text">Portfolio</h2>
          <p className="mt-0.5 text-xs text-zk-muted">
            Select any holding to view thesis checks and log trades.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-zk-muted">
            {portfolio.positions.length}{" "}
            {portfolio.positions.length === 1 ? "holding" : "holdings"} ·{" "}
            {money(totalValue) ?? "Awaiting prices"}
          </span>
          <TradeButton label="+ Add holding" variant="secondary" />
        </div>
      </div>

      {!portfolio.positions.length ? (
        <p className="rounded-xl border border-dashed border-zk-border bg-zk-bg py-8 text-center text-xs text-zk-muted">
          No holdings yet. Open a researched stock or click &ldquo;+ Add
          holding&rdquo; to log your first trade.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zk-border text-[10px] uppercase tracking-wider text-zk-muted">
                <th className="pb-3 font-medium">Holding</th>
                <th className="hidden pb-3 font-medium sm:table-cell">
                  Allocation
                </th>
                <th className="pb-3 text-right font-medium">Value</th>
                <th className="pb-3 text-right font-medium">Gain / S&amp;P 500</th>
                <th className="px-4 pb-3 font-medium">Thesis health</th>
                <th className="pb-3 text-right font-medium">Next check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zk-divider">
              {portfolio.positions.map((p) => {
                const allocationPct =
                  totalValue && totalValue > 0 && p.value !== null
                    ? Math.round((p.value / totalValue) * 100)
                    : null;
                const formattedValue = money(p.value);
                return (
                  <tr
                    key={p.id}
                    className="transition hover:bg-zk-tint/40"
                  >
                    <td className="py-3.5 pr-3">
                      <Link
                        href={`/finance/${encodeURIComponent(p.symbol)}`}
                        className="group flex items-center gap-2.5"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zk-border bg-zk-bg text-xs font-bold text-zk-accent">
                          {p.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <span className="font-semibold text-zk-text group-hover:text-zk-accent">
                            {p.name}
                          </span>
                          <span className="ml-1.5 font-mono text-[11px] text-zk-muted">
                            {p.symbol}
                          </span>
                          <span className="mt-0.5 block text-[11px] tabular-nums text-zk-muted">
                            {p.shares} shares
                            {p.averageCost !== null
                              ? ` · Avg $${Number(p.averageCost).toFixed(2)}`
                              : ""}
                            {p.addedByYou ? " · Added by you" : ""}
                          </span>
                        </div>
                      </Link>
                    </td>
                    <td className="hidden w-36 py-3.5 pr-4 sm:table-cell">
                      {allocationPct !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zk-chip">
                            <div
                              className="h-full rounded-full bg-zk-accent"
                              style={{ width: `${allocationPct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right tabular-nums text-zk-muted">
                            {allocationPct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-zk-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3.5 text-right tabular-nums">
                      {formattedValue ? (
                        <span className="font-semibold text-zk-text">
                          {formattedValue}
                        </span>
                      ) : (
                        <span className="text-zk-muted">Awaiting price</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3.5 text-right tabular-nums">
                      <p
                        className={
                          p.gainPct === null
                            ? "text-zk-muted"
                            : p.gainPct >= 0
                              ? "font-medium text-zk-ok-fg"
                              : "font-medium text-zk-bad-fg"
                        }
                      >
                        {percent(p.gainPct)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zk-muted">
                        S&amp;P 500 {percent(p.benchmarkGainPct)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${reasonBadgeClass(p.reasonStatus)}`}
                      >
                        {reasonLabel[p.reasonStatus]}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        href={`/finance/${encodeURIComponent(p.symbol)}`}
                        className="inline-block rounded-md border border-zk-border bg-zk-bg px-2.5 py-1 text-[11px] font-medium text-zk-text2 hover:border-zk-accent/60"
                      >
                        {p.nextCheck
                          ? new Date(p.nextCheck).toLocaleDateString("en-US", {
                              weekday: "short",
                            })
                          : "Pending"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {portfolio.positions.some((p) => p.priceDate === null) && (
        <p className="mt-3 text-xs text-zk-muted">
          Market prices are unavailable for some holdings. Values and
          comparisons appear once price data is synced.
        </p>
      )}
      {portfolio.balanceWarning && (
        <p className="mt-3 text-xs leading-relaxed text-zk-text2">
          {portfolio.balanceWarning}
        </p>
      )}
      <details className="mt-5">
        <summary className="cursor-pointer text-xs font-semibold text-zk-accent">
          View change log
        </summary>
        <ChangeLog entries={changes} />
      </details>
    </section>
  );
}
