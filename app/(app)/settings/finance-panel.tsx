import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buyZiksAction } from "@/app/actions/coins";
import { EARNED_KINDS, hasEarnedZiks, walletSummary, zikOf } from "@/lib/coins/ledger";
import { owedOf } from "@/lib/coins/loan";
import { ZIKS_PER_DOLLAR, ZIK_PACKS, feePercent, formatUsd, formatZik, zikToCents } from "@/lib/coins/math";
import { stripeConfigured } from "@/lib/coins/stripe";
import { paymentsAvailable } from "@/lib/coins/test-mode";
import { ZIK_PLANS, discountedCents, findPlan } from "@/lib/coins/plans";
import { discountPercentFor, liveSubscriptionOf, syncUserSubscriptions } from "@/lib/coins/subscription";
import { ownedProjectBudgets } from "@/lib/coins/budget-view";
import { safeReturnTo } from "@/lib/coins/return-to";
import { PAYOUT_ROLE_LABELS } from "@/lib/coins/earned";
import { WITHDRAW_MIN_ZIK, syncPayoutsEnabled } from "@/lib/coins/withdraw";
import { WITHDRAW_THRESHOLD } from "@/lib/earnings-threshold";
import { PRIMARY_ACTION } from "@/lib/ui-style";
import { PAYOUT_TABS, financeHref, parseFinanceTab, type FinanceTab } from "@/lib/finance-paths";
import { LocalTime } from "@/components/local-time";
import { ZikiPlans } from "@/components/coins/ziki-plans";
import { UrlNotice } from "@/components/coins/url-notice";
import { BudgetStatusTag } from "@/components/coins/budget-status";
import { ZikAmount } from "@/components/zik-symbol";
import { PayoutsPanel } from "./payouts-panel";

const card = "rounded-panel border border-zk-border bg-zk-surface p-6 flex flex-col gap-4";
const notice = "m-0 rounded-xl px-4 py-3 text-sm font-semibold";

export type FinanceQuery = { tab?: string; bought?: string; subscribed?: string; payouts?: string; error?: string; returnTo?: string };

/** What a ledger row says happened, for the activity list. */
const KIND_LABEL = {
  purchase: "Bought Ziks",
  fund_issue: "Funded an issue",
  release: "Earned from an issue",
  fee: "Fee",
  refund: "Refunded from an issue",
  withdrawal: "Withdrawal",
  withdrawal_reversal: "Withdrawal returned",
  check_payment: "Unlocked security fixes",
  fund_budget: "Funded a project's budget",
  reserve: "Reserved for an issue",
  unreserve: "Returned to a budget",
  budget_return: "Budget returned",
  earning: "Earnings moved in",
  bonus: "Welcome bonus (to spend, not withdraw)",
} as const;

/** Scan admission and finding unlocks share an accounting kind, but not an Activity description. */
function activityLabel(entry: { kind: keyof typeof KIND_LABEL; sourceKey: string }): string {
  if (entry.kind === "check_payment") {
    if (entry.sourceKey.startsWith("deeper-scan:")) return "Deeper scan";
    if (entry.sourceKey.startsWith("rescan:")) return "Scan again";
  }
  // The welcome bonus moved from earnings to spendable (#welcome-bonus): the row that takes it out of earnings.
  if (entry.sourceKey.startsWith("earning-to-bonus:")) return "Welcome bonus moved to spendable";
  return KIND_LABEL[entry.kind];
}

/** Whether the Stripe webhook has already credited what was just paid for (a purchase in the last few minutes). */
function hasRecentPurchase(entries: { kind: string; createdAt: Date }[]): boolean {
  return entries.some((entry) => entry.kind === "purchase" && Date.now() - entry.createdAt.getTime() < 10 * 60 * 1000);
}

const STATUS: Record<"paid" | "failed" | "pending", { label: string; tone: string }> = {
  paid: { label: "Paid", tone: "bg-zk-ok-bg text-zk-ok-fg" },
  pending: { label: "On its way", tone: "bg-zk-tint text-zk-accent" },
  failed: { label: "Returned to your wallet", tone: "bg-zk-warn-bg text-zk-warn-fg" },
};

/**
 * Finance (#finance), in Settings: your Ziks at the top, then one tab at a time. Buying Ziks, project budgets, your plan
 * and what you bought and spent; then withdrawing what you earned, your earnings, past withdrawals and how payouts
 * work. Buying is Stripe Checkout (or instant in test mode); the wallet is only credited when the payment is confirmed.
 * Only earned Ziks can be withdrawn; bought ones are for spending.
 */
export async function FinancePanel({ userId, query }: { userId: string; query: FinanceQuery }) {
  const configured = paymentsAvailable();
  const stripe = stripeConfigured();
  // Coming back from subscribing, or from Stripe's payout onboarding: read it now rather than wait for the webhook.
  if (query.subscribed === "1" && stripe) await syncUserSubscriptions(userId).catch(() => undefined);
  if (query.payouts === "return" && stripe) await syncPayoutsEnabled(userId).catch(() => false);

  const [subscription, discountPercent, wallet, entryRows, budgets, earner] = await Promise.all([
    liveSubscriptionOf(userId),
    discountPercentFor(userId),
    walletSummary(prisma, userId),
    prisma.coinEntry.findMany({
      // Buying and spending only; what was earned and withdrawn is under Earnings and Withdrawals.
      where: { account: "wallet", userId, kind: { in: ["purchase", "fund_issue", "refund", "check_payment", "fund_budget", "budget_return"] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: { id: true, kind: true, sourceKey: true, amount: true, createdAt: true, bug: { select: { number: true, title: true } } },
    }),
    // The projects this person can fund; a failed read just leaves them out.
    ownedProjectBudgets(userId).catch(() => ({ projects: [], more: 0 })),
    hasEarnedZiks(prisma, userId).catch(() => false),
  ]);
  const entries = entryRows.map((entry) => ({ ...entry, amount: zikOf(entry.amount) }));
  const justCredited = hasRecentPurchase(entries);
  // Came from a deeper scan's checkout (#deeper-scan-gate): after paying, Stripe sends them back to that scan.
  const returnTo = safeReturnTo(query.returnTo);
  const owed = owedOf(wallet.balance);
  const plan = subscription ? findPlan(subscription.planId) : null;
  const bestDiscount = Math.max(...ZIK_PLANS.map((option) => option.discountPercent));
  const ownsProjects = budgets.projects.length > 0;

  const tabs: { id: FinanceTab; label: string }[] = [
    { id: "buy", label: "Buy Ziks" },
    ...(ownsProjects ? [{ id: "budgets" as const, label: "Project budgets" }] : []),
    { id: "plan", label: "Your plan" },
    { id: "activity", label: "Activity" },
    { id: "withdraw", label: "Withdraw" },
    { id: "earnings", label: "Earnings" },
    { id: "withdrawals", label: "Withdrawals" },
    { id: "how", label: "How payouts work" },
  ];
  // Back from subscribing, the plan is what they came to see; back from payout setup, Withdraw.
  const wanted = parseFinanceTab(query.tab) ?? (query.subscribed === "1" ? "plan" : query.payouts ? "withdraw" : null);
  const tab: FinanceTab = tabs.find((item) => item.id === wanted)?.id ?? "buy";

  // The payout tabs read the person's payout account, withdrawals and earnings.
  const payouts = PAYOUT_TABS.includes(tab)
    ? await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { stripeAccountId: true, payoutsEnabled: true } }),
        prisma.withdrawal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, zik: true, amountCents: true, status: true, stripeTransferId: true, createdAt: true } }),
        prisma.coinEntry.findMany({
          where: { account: "wallet", userId, kind: { in: [...EARNED_KINDS] } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 30,
          select: { id: true, kind: true, amount: true, payoutRole: true, createdAt: true, bug: { select: { number: true, title: true } } },
        }),
      ]).then(([account, withdrawalRows, earnedRows]) => ({
        account,
        withdrawals: withdrawalRows.map((row) => ({ ...row, zik: zikOf(row.zik) })),
        // What each payment was for (#one-payment): "Fixed", "Confirmed", "Estimated"…
        earnings: earnedRows.map((row) => ({ ...row, amount: zikOf(row.amount), label: row.payoutRole ? PAYOUT_ROLE_LABELS[row.payoutRole] : "Earnings" })),
      }))
    : null;
  const canWithdraw = wallet.withdrawable >= WITHDRAW_MIN_ZIK;
  const toGo = Math.max(0, WITHDRAW_MIN_ZIK - wallet.withdrawable);
  const progress = Math.min(100, (wallet.withdrawable / WITHDRAW_MIN_ZIK) * 100);
  // A withdrawal that is debited but not yet paid: either still waiting for Stripe's funds, or sent and on its way.
  const open = payouts?.withdrawals.find((withdrawal) => withdrawal.status === "pending");

  return (
    <div className="flex flex-col gap-4">
      {/* One-time notices: shown on arrival, then the query is dropped from the address (UrlNotice) so a refresh does not bring them back. */}
      {query.bought === "1" ? (
        <UrlNotice role="status" className={`${notice} bg-zk-ok-bg text-zk-ok-fg`}>
          {justCredited ? "Thanks. Your payment went through and your Ziks are in your wallet." : "Thanks. Your Ziks arrive as soon as Stripe confirms the payment, usually within a few seconds."}
        </UrlNotice>
      ) : null}
      {query.subscribed === "1" ? (
        <UrlNotice role="status" className={`${notice} bg-zk-ok-bg text-zk-ok-fg`}>
          {subscription ? `Thanks. Your plan is on, and every pack is now ${discountPercent}% cheaper.` : "Thanks. Your plan shows here as soon as Stripe confirms the payment, usually within a few seconds."}
        </UrlNotice>
      ) : null}
      {query.payouts === "return" && payouts ? (
        <p role="status" className={`${notice} ${payouts.account.payoutsEnabled ? "bg-zk-ok-bg text-zk-ok-fg" : "bg-zk-warn-bg text-zk-warn-fg"}`}>
          {payouts.account.payoutsEnabled ? "Payouts are set up." : "Stripe still needs a few details before you can withdraw."}
        </p>
      ) : null}
      {query.error ? <UrlNotice role="alert" className={`${notice} bg-zk-warn-bg text-zk-warn-fg`}>{query.error}</UrlNotice> : null}

      {/* What you hold. */}
      <section aria-label="Your Ziks" className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-zk-border bg-zk-surface px-6 py-4">
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-zk-muted">Your Ziks</p>
          <p className="m-0 mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-extrabold tabular-nums text-zk-text" data-testid="wallet-balance"><ZikAmount amount={wallet.balance} /></span>
            <span className="text-sm text-zk-text2">{formatUsd(zikToCents(Math.max(0, wallet.balance)))} in value · {ZIKS_PER_DOLLAR.toLocaleString("en-US")} Ziks are $1</span>
          </p>
          {/* A borrowed overdraft (lib/coins/loan.ts): the part below zero is paid back first by the next top-up. */}
          {owed > 0 ? <p className="m-0 mt-1 text-xs font-semibold text-zk-text">You owe {owed.toLocaleString("en-US")} Ziks you borrowed. Your next top-up pays it back first.</p> : null}
        </div>
        {earner ? (
          <p className="m-0 text-sm text-zk-text2">
            <span className="font-bold text-zk-text" data-testid="withdrawable"><ZikAmount amount={wallet.withdrawable} /></span> earned, ready to withdraw
          </p>
        ) : null}
      </section>

      <nav aria-label="Finance" className="flex flex-wrap gap-1 rounded-2xl bg-zk-bg p-1">
        {tabs.map((item) => {
          const on = tab === item.id;
          return (
            <Link
              key={item.id}
              href={financeHref(item.id, item.id === "buy" ? { returnTo: returnTo ?? undefined } : {})}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue ${on ? "bg-zk-surface font-semibold text-zk-accent" : "font-medium text-zk-text2 hover:bg-zk-surface hover:text-zk-text"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tab === "buy" ? (
        <section className={card}>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-bold text-zk-text">Buy Ziks</h2>
            <span className="text-[13px] text-zk-muted">
              {discountPercent > 0 ? `Your ${plan?.label ?? ""} plan takes ${discountPercent}% off every pack.` : `Ziks fund issues and unlock security fixes. Every pack is its Ziks at ${ZIKS_PER_DOLLAR.toLocaleString("en-US")} to the dollar, straight into your wallet.`}
            </span>
          </div>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {ZIK_PACKS.map((pack) => {
              const full = zikToCents(pack.zik);
              const price = discountedCents(full, discountPercent);
              return (
                <li key={pack.id} className="flex flex-col gap-3 rounded-2xl border border-zk-border p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="m-0 text-sm font-bold text-zk-text">{pack.label}</p>
                    {discountPercent > 0 ? <span className="rounded-full bg-zk-ok-bg px-2 py-0.5 text-[11px] font-bold text-zk-ok-fg">Save {formatUsd(full - price)}</span> : null}
                  </div>
                  <p className="m-0 flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold tabular-nums text-zk-text">{pack.zik.toLocaleString("en-US")}</span>
                    <span className="text-sm text-zk-muted">Ziks</span>
                  </p>
                  <form action={buyZiksAction}>
                    <input type="hidden" name="packId" value={pack.id} />
                    {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
                    <button type="submit" disabled={!configured} className={`${PRIMARY_ACTION} w-full whitespace-nowrap`}>
                      Buy for {formatUsd(price)}
                      {discountPercent > 0 ? <s className="ml-1.5 font-medium opacity-70">{formatUsd(full)}</s> : null}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          {!configured ? <p className="m-0 text-sm text-zk-text2">Buying Ziks isn&apos;t available yet.</p> : null}
          {configured && discountPercent === 0 ? (
            <p className="m-0 text-xs text-zk-muted">
              A plan takes up to {bestDiscount}% off every pack.{" "}
              <Link href={financeHref("plan")} className="font-semibold text-zk-accent hover:underline">See plans</Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {tab === "budgets" ? (
        <section className={card}>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-bold text-zk-text">Project budgets</h2>
            <span className="text-[13px] text-zk-muted">Put Ziks behind a whole project once, and each issue is paid from it as it is awarded.</span>
          </div>
          <ul className="m-0 list-none divide-y divide-zk-divider p-0">
            {budgets.projects.map((project) => (
              <li key={project.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="min-w-0 flex-1 text-sm font-semibold text-zk-text">
                  {project.name}
                  <span className="block text-xs font-normal text-zk-muted">{project.organisationName}</span>
                </span>
                <BudgetStatusTag status={project.status} />
                {project.status !== "none" ? <span className="text-sm font-bold tabular-nums text-zk-text"><ZikAmount amount={project.available} /></span> : null}
                <Link href={project.href} className="text-sm font-semibold text-zk-accent hover:underline">
                  {project.status === "none" ? "Start a budget" : "Open"}
                </Link>
              </li>
            ))}
          </ul>
          {budgets.more > 0 ? <p className="m-0 text-xs text-zk-muted">And {budgets.more} more projects. Open one from its page.</p> : null}
        </section>
      ) : null}

      {tab === "plan" ? <ZikiPlans subscription={subscription} configured={configured} /> : null}

      {tab === "activity" ? (
        <section className={card}>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-bold text-zk-text">Activity</h2>
            <span className="text-[13px] text-zk-muted">What you bought and spent, newest first. What you earned is under Earnings.</span>
          </div>
          {entries.length === 0 ? (
            <p className="m-0 rounded-xl border border-dashed border-zk-border px-5 py-8 text-center text-sm text-zk-muted">Nothing yet. Buy Ziks to fund an issue or unlock security fixes.</p>
          ) : (
            <ul className="m-0 list-none divide-y divide-zk-divider p-0">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5 text-sm text-zk-text">
                  <span className="flex-1">
                    {activityLabel(entry)}
                    {entry.bug ? <span className="text-zk-muted"> · #{entry.bug.number} {entry.bug.title}</span> : null}
                    <span className="block text-xs text-zk-muted"><LocalTime date={entry.createdAt} /></span>
                  </span>
                  <span className={`font-mono font-bold tabular-nums ${entry.amount < 0 ? "text-zk-text2" : "text-zk-ok-fg"}`}>
                    {entry.amount > 0 ? "+" : ""}{formatZik(entry.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "withdraw" && payouts ? (
        <section className={card}>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-bold text-zk-text">Withdraw</h2>
            <span className="text-[13px] text-zk-muted">Earned Ziks go to your bank account through Stripe. Bought Ziks stay for spending.</span>
          </div>
          <div>
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-zk-muted">Ready to withdraw</p>
            <p className="m-0 mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-3xl font-extrabold tabular-nums text-zk-text"><ZikAmount amount={wallet.withdrawable} /></span>
              <span className="text-sm text-zk-text2">{formatUsd(zikToCents(wallet.withdrawable))}</span>
            </p>
          </div>
          {/* How far from the minimum: the one thing an earner wants to know. */}
          <div>
            <div role="img" aria-label={canWithdraw ? "You have reached the minimum to withdraw" : `${wallet.withdrawable.toLocaleString("en-US")} of ${WITHDRAW_MIN_ZIK.toLocaleString("en-US")} Ziks, ${toGo.toLocaleString("en-US")} to go`} className="flex h-2.5 overflow-hidden rounded-full bg-zk-seg">
              <span className={canWithdraw ? "bg-zk-ok-fg" : "bg-electric-blue-strong"} style={{ width: `${progress}%` }} />
            </div>
            <p className="m-0 mt-2 text-xs text-zk-muted">
              {canWithdraw
                ? `You've passed the ${WITHDRAW_MIN_ZIK.toLocaleString("en-US")}-Zik minimum.`
                : `${wallet.withdrawable.toLocaleString("en-US")} of ${WITHDRAW_MIN_ZIK.toLocaleString("en-US")} Ziks: ${toGo.toLocaleString("en-US")} more to go before you can withdraw.`}
            </p>
          </div>
          <div className="border-t border-zk-divider pt-4">
            {stripe ? (
              <PayoutsPanel
                payoutsReady={payouts.account.payoutsEnabled}
                hasAccount={Boolean(payouts.account.stripeAccountId)}
                withdrawable={wallet.withdrawable}
                withdrawableUsd={formatUsd(zikToCents(wallet.withdrawable))}
                thresholdUsd={WITHDRAW_THRESHOLD}
                canWithdraw={canWithdraw}
                inFlight={open ? { usd: formatUsd(open.amountCents), sent: Boolean(open.stripeTransferId) } : null}
              />
            ) : (
              <p className="m-0 text-sm text-zk-text2">Payouts aren&apos;t available yet.</p>
            )}
          </div>
        </section>
      ) : null}

      {tab === "earnings" && payouts ? (
        <section className={card}>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-bold text-zk-text">Earnings</h2>
            <span className="text-[13px] text-zk-muted">Everything you earned, newest first: your share of each funded issue you worked on, paid once it went live.</span>
          </div>
          {payouts.earnings.length === 0 ? (
            <p className="m-0 rounded-xl border border-dashed border-zk-border px-5 py-8 text-center text-sm text-zk-muted">Nothing earned yet. You are paid in Ziks when a funded issue you worked on goes live.</p>
          ) : (
            <ul className="m-0 list-none divide-y divide-zk-divider p-0">
              {payouts.earnings.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5 text-sm text-zk-text">
                  <span className="flex-1">
                    {entry.bug ? <><span className="text-zk-muted">#{entry.bug.number}</span> {entry.bug.title}</> : entry.label}
                    <span className="block text-xs text-zk-muted">{entry.bug ? `${entry.label} · ` : ""}<LocalTime date={entry.createdAt} /></span>
                  </span>
                  <span className={`font-mono font-bold tabular-nums ${entry.amount < 0 ? "text-zk-warn-fg" : "text-zk-ok-fg"}`}>
                    {entry.amount < 0 ? "-" : "+"}
                    {formatZik(Math.abs(entry.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "withdrawals" && payouts ? (
        <section className={card}>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-bold text-zk-text">Withdrawals</h2>
            <span className="text-[13px] text-zk-muted">What you took out to your bank account, newest first.</span>
          </div>
          {payouts.withdrawals.length === 0 ? (
            <p className="m-0 rounded-xl border border-dashed border-zk-border px-5 py-8 text-center text-sm text-zk-muted">Nothing withdrawn yet.</p>
          ) : (
            <ul className="m-0 list-none divide-y divide-zk-divider p-0">
              {payouts.withdrawals.map((withdrawal) => (
                <li key={withdrawal.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm text-zk-text">
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">{formatUsd(withdrawal.amountCents)}</span>
                    <span className="text-zk-muted"> · {formatZik(withdrawal.zik)}</span>
                    <span className="block text-xs text-zk-muted"><LocalTime date={withdrawal.createdAt} /></span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[withdrawal.status].tone}`}>{STATUS[withdrawal.status].label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "how" ? (
        <section className={card}>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-bold text-zk-text">How payouts work</h2>
            <span className="text-[13px] text-zk-muted">From solving an issue to money in your bank.</span>
          </div>
          <ul className="m-0 list-disc space-y-2 pl-5 text-sm text-zk-text2">
            <li>When a funded issue goes live, its Ziks, less Ziki&apos;s {feePercent()}% fee, are shared by everyone who worked on it: the fixer gets the biggest share, and the testers, the merge reviewer, the reporter, the confirmers, the estimators and whoever awarded the bid get theirs. They show under Earnings.</li>
            <li>Only earned Ziks can be withdrawn. Ziks you bought are for funding issues and security checks.</li>
            <li>Set up payouts once: you add your bank account with Stripe, and Ziki never sees your bank details.</li>
            <li>You can withdraw once you have {WITHDRAW_MIN_ZIK.toLocaleString("en-US")} earned Ziks (${WITHDRAW_THRESHOLD}). {ZIKS_PER_DOLLAR.toLocaleString("en-US")} Ziks are $1, and a withdrawal pays whole cents: the few Ziks short of a cent stay in your wallet.</li>
            <li>Stripe sends the money to your bank, usually within a few days. If a transfer fails, the Ziks come back to your wallet.</li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}
