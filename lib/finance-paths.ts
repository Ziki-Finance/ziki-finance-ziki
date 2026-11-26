/**
 * Ziks, budgets, your plan and payouts live in Settings, under Finance (#finance): `/settings?section=finance`, one tab
 * at a time. Every link, redirect and Stripe return address builds its address here.
 */
export const FINANCE_TABS = ["buy", "budgets", "plan", "activity", "withdraw", "earnings", "withdrawals", "how"] as const;
export type FinanceTab = (typeof FINANCE_TABS)[number];

/** The payout tabs: they read the person's earnings and withdrawals. */
export const PAYOUT_TABS: readonly FinanceTab[] = ["withdraw", "earnings", "withdrawals", "how"];

export function parseFinanceTab(value: unknown): FinanceTab | null {
  return typeof value === "string" && (FINANCE_TABS as readonly string[]).includes(value) ? (value as FinanceTab) : null;
}

/** `/settings?section=finance`, with a tab and any extra query (`bought`, `subscribed`, `payouts`, `error`, `returnTo`). */
export function financeHref(tab?: FinanceTab, extra: Record<string, string | undefined> = {}): string {
  const query = new URLSearchParams({ section: "finance" });
  if (tab) query.set("tab", tab);
  for (const [key, value] of Object.entries(extra)) if (value !== undefined && value !== "") query.set(key, value);
  return `/settings?${query.toString()}`;
}
