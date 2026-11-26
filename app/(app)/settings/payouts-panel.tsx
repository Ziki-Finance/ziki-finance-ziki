"use client";

import { PRIMARY_ACTION } from "@/lib/ui-style";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUpPayoutsAction, withdrawZiksAction } from "@/app/actions/coins";
import { ZIKS_PER_DOLLAR } from "@/lib/coins/math";

const PRIMARY = PRIMARY_ACTION;

/**
 * Payouts under Settings › Finance › Withdraw: set up Stripe once, then withdraw earned Ziks once
 * they reach the threshold. The server decides everything (lib/coins/withdraw.ts);
 * this only shows what it said.
 */
export function PayoutsPanel({
  payoutsReady,
  hasAccount,
  withdrawable,
  withdrawableUsd,
  thresholdUsd,
  canWithdraw,
  inFlight,
}: {
  payoutsReady: boolean;
  hasAccount: boolean;
  withdrawable: number;
  withdrawableUsd: string;
  thresholdUsd: number;
  canWithdraw: boolean;
  /** A withdrawal already taken from the wallet and not yet paid. `sent` is false while Stripe is still releasing funds. */
  inFlight: { usd: string; sent: boolean } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  if (!payoutsReady) {
    return (
      <div>
        <p className="m-0 text-sm text-zk-text2">
          {hasAccount
            ? "Finish adding your bank details with Stripe to withdraw what you earn."
            : "Add your bank account through Stripe, once. After that you can withdraw what you earn straight to it."}
        </p>
        <form action={setUpPayoutsAction} className="mt-4">
          <button type="submit" className={PRIMARY}>{hasAccount ? "Finish payout setup" : "Set up payouts"}</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {inFlight ? (
        <div role="status" className="mb-4 rounded-2xl bg-zk-chip px-4 py-3 text-sm text-zk-text">
          <p className="m-0 font-bold">Withdrawal pending: {inFlight.usd}</p>
          <p className="m-0 mt-1 text-zk-text2">
            {inFlight.sent ? "It's on its way to your bank account." : "We'll send it to your bank account automatically, usually within a few days."}
          </p>
        </div>
      ) : null}
      <p className="m-0 text-sm text-zk-text2">
        {canWithdraw
          ? `You can withdraw ${withdrawable.toLocaleString("en-US")} Ziks, ${withdrawableUsd}, to your bank account.`
          : `Withdrawals open at ${(thresholdUsd * ZIKS_PER_DOLLAR).toLocaleString("en-US")} earned Ziks. You have ${withdrawable.toLocaleString("en-US")} so far.`}
      </p>
      <button
        type="button"
        disabled={!canWithdraw || pending}
        className={`${PRIMARY} mt-4`}
        onClick={() => {
          setNote(null);
          startTransition(async () => {
            const result = await withdrawZiksAction();
            setNote({ ok: result.ok, text: result.ok ? result.message : result.error });
            router.refresh();
          });
        }}
      >
        {pending ? "Withdrawing…" : "Withdraw"}
      </button>
      {note ? (
        <p role="status" className={`mb-0 mt-3 text-sm font-semibold ${note.ok ? "text-zk-ok-fg" : "text-zk-warn-fg"}`}>{note.text}</p>
      ) : null}
    </div>
  );
}
