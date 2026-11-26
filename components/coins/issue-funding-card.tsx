"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { raiseIssuePriceAction } from "@/app/actions/coins";
import { ZikAmount } from "@/components/zik-symbol";

export type FundingCardProps = {
  bugId: string;
  /** Where the price stands (lib/coins/budget.ts priceStage). */
  stage: "estimating" | "settling" | "settled" | "locked";
  /** In Ziks, once three agents have estimated it. */
  price: number | null;
  /** While settling: how long until the price settles, so the card can redraw then. */
  settlesInMs: number | null;
  /** Ziks held for this issue (its escrow). */
  held: number;
  /** A payer (#payers): an owner, or an admin an owner lets pay, the only people who fund. They fund from the project's Budget page. */
  canFundProject: boolean;
  /** The project's Budget page. */
  budgetHref: string;
};

const SECONDARY =
  "inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-control border border-zk-border bg-zk-surface px-4 text-sm font-semibold text-zk-text transition hover:bg-zk-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue disabled:cursor-not-allowed disabled:opacity-60";

const zik = (amount: number) => `${amount.toLocaleString("en-US")} ${amount === 1 ? "Zik" : "Ziks"}`;

/**
 * The price behind an issue (#price-lock), inside the Reward panel: agents estimating it, the price settling, waiting
 * for funding, or locked and held for the fixer. Funding itself happens on the project's Budget page (#funding-button),
 * which the project's header links to, so payers get a link here and nothing more.
 */
export function IssueFundingCard(props: FundingCardProps) {
  const { bugId, stage, price, settlesInMs, held, canFundProject, budgetHref } = props;
  const router = useRouter();

  // Settling: redraw once the quiet minute is over, so the price shows as ready without a reload.
  useEffect(() => {
    if (stage !== "settling" || settlesInMs === null) return;
    const timer = window.setTimeout(() => router.refresh(), Math.max(0, settlesInMs) + 1500);
    return () => window.clearTimeout(timer);
  }, [stage, settlesInMs, router]);

  const box = "flex flex-col gap-2 rounded-2xl border border-zk-border bg-zk-chip px-4 py-3";
  const fundLink = canFundProject ? (
    <Link href={`${budgetHref}?section=fund`} className="self-start text-xs font-semibold text-zk-accent hover:underline">
      Fund the project
    </Link>
  ) : null;

  // The Reward panel's own header already says how many estimates are in.
  if (stage === "estimating") return null;

  if (stage === "settling" || price === null) {
    return (
      <div className={box} data-testid="issue-funding" data-stage="settling">
        <p className="m-0 text-sm font-semibold text-zk-text">
          Priced at about {price !== null ? <ZikAmount amount={price} /> : null} · settling
        </p>
        <p className="m-0 text-xs text-zk-muted">The price settles a minute after the last estimate, in case more agents estimate it.</p>
      </div>
    );
  }

  const need = Math.max(0, price - held);

  // Held in full: locked (or locking at the next sweep).
  if (need === 0) {
    return (
      <div className={box} data-testid="issue-funding" data-stage="funded">
        <p className="m-0 text-sm font-bold text-zk-ok-fg">
          {stage === "locked" ? "Price locked" : "Funded"} · <ZikAmount amount={price} />
        </p>
        <p className="m-0 text-xs text-zk-muted">Held until the work is live, then paid to everyone who worked on it: the fixer gets the most.</p>
        {canFundProject ? <RaisePrice bugId={bugId} price={price} /> : null}
      </div>
    );
  }

  return (
    <div className={box} data-testid="issue-funding" data-stage="waiting">
      <p className="m-0 text-sm font-semibold text-zk-text">
        Priced at <ZikAmount amount={price} /> · waiting for funding
      </p>
      <p className="m-0 text-xs text-zk-muted">
        {held > 0 ? `${zik(held)} are held for it already. ` : ""}Agents can bid now. It is awarded once it is funded.
      </p>
      {fundLink}
    </div>
  );
}

/**
 * Raise the price (#price-lock): a payer (#payers) offers more than the agents' price, so the issue is picked up
 * sooner. It only goes up; the difference is funded like the rest.
 */
function RaisePrice({ bugId, price }: { bugId: string; price: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const value = Number(amount);
  const valid = amount !== "" && Number.isInteger(value) && value > price;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start cursor-pointer text-xs font-semibold text-zk-accent hover:underline">
        Want it picked up sooner? Raise the price
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 border-t border-zk-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        setNote(null);
        startTransition(async () => {
          const result = await raiseIssuePriceAction(bugId, value);
          setNote({ ok: result.ok, text: result.ok ? result.message : result.error });
          if (result.ok) {
            setAmount("");
            router.refresh();
          }
        });
      }}
    >
      <label className="text-xs font-bold text-zk-text" htmlFor={`raise-${bugId}`}>A higher price in Ziks</label>
      <div className="flex items-center gap-2">
        <input
          id={`raise-${bugId}`}
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))}
          placeholder={`More than ${price}`}
          className="h-10 min-w-0 flex-1 rounded-control border border-zk-border bg-zk-surface px-3 text-sm font-semibold tabular-nums text-zk-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue"
        />
        <button type="submit" disabled={!valid || pending} className={`${SECONDARY} w-auto! shrink-0 px-3`}>
          {pending ? "Saving…" : "Raise price"}
        </button>
      </div>
      <p className="m-0 text-xs text-zk-muted">A higher price draws agents to it sooner. It can only go up, and you fund the difference.</p>
      {note ? <p role="status" className={`m-0 text-sm font-semibold ${note.ok ? "text-zk-ok-fg" : "text-zk-warn-fg"}`}>{note.text}</p> : null}
    </form>
  );
}
