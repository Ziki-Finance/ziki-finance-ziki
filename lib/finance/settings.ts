import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * The agreement numbers staff set on `/superadmin/finance` (FIN-CR-006, idea 19,
 * FIN-D-022). They replace the `FINANCE_AGREEMENT_NEEDED` and
 * `FINANCE_SELL_AGREEMENT_NEEDED` env vars and the fixed manager weight of 3.
 *
 * A change applies from the next settle: `settleJob` reads the numbers each time
 * it settles a job. `FinanceSettings.updatedAt` and one `FinanceSettingsChange`
 * row record who changed them and when.
 */

export type FinanceSettingsValues = {
  agreementNeeded: number;
  managerVoteWeight: number;
  sellAgreementNeeded: number;
};

/** The numbers before staff have ever changed them. */
export const DEFAULT_FINANCE_SETTINGS: FinanceSettingsValues = {
  agreementNeeded: 3,
  managerVoteWeight: 3,
  sellAgreementNeeded: 4,
};

/** The settings table holds one row. */
export const FINANCE_SETTINGS_ID = "default";

export type FinanceSettingsError = "invalid_number" | "sell_below_agreement";

export const FINANCE_SETTINGS_ERRORS: Record<FinanceSettingsError, string> = {
  invalid_number: "Each number must be a whole number of 1 or more.",
  sell_below_agreement: "The bar for a change to Sell can't be lower than the agreement needed.",
};

/** A whole number of 1 or more, or null. "3.5", "0", "-1" and "" are refused. */
function wholeNumber(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

export function parseFinanceSettings(input: {
  agreementNeeded: unknown;
  managerVoteWeight: unknown;
  sellAgreementNeeded: unknown;
}): { ok: true; values: FinanceSettingsValues } | { ok: false; error: FinanceSettingsError } {
  const agreementNeeded = wholeNumber(input.agreementNeeded);
  const managerVoteWeight = wholeNumber(input.managerVoteWeight);
  const sellAgreementNeeded = wholeNumber(input.sellAgreementNeeded);
  if (agreementNeeded === null || managerVoteWeight === null || sellAgreementNeeded === null) {
    return { ok: false, error: "invalid_number" };
  }
  if (sellAgreementNeeded < agreementNeeded) return { ok: false, error: "sell_below_agreement" };
  return { ok: true, values: { agreementNeeded, managerVoteWeight, sellAgreementNeeded } };
}

type Db = PrismaClient | Prisma.TransactionClient;

/** The numbers in force now, or the defaults before staff have set any. */
export async function readFinanceSettings(db: Db): Promise<FinanceSettingsValues> {
  const row = await db.financeSettings.findUnique({
    where: { id: FINANCE_SETTINGS_ID },
    select: { agreementNeeded: true, managerVoteWeight: true, sellAgreementNeeded: true },
  });
  return row ?? DEFAULT_FINANCE_SETTINGS;
}

/**
 * Staff save the numbers. Records one audit row with who changed them and the
 * numbers before and after; an unchanged save records nothing.
 *
 * Takes the client itself, not a transaction: it opens the transaction that
 * reads the numbers, saves them and records the change together.
 */
export async function saveFinanceSettings(
  db: PrismaClient,
  values: FinanceSettingsValues,
  changedById: string,
  now = new Date(),
): Promise<{ changed: boolean }> {
  return db.$transaction(async (tx) => {
    const before = await readFinanceSettings(tx);
    if (
      before.agreementNeeded === values.agreementNeeded &&
      before.managerVoteWeight === values.managerVoteWeight &&
      before.sellAgreementNeeded === values.sellAgreementNeeded
    ) {
      return { changed: false };
    }
    await tx.financeSettings.upsert({
      where: { id: FINANCE_SETTINGS_ID },
      create: { id: FINANCE_SETTINGS_ID, ...values },
      update: values,
    });
    await tx.financeSettingsChange.create({
      data: {
        changedById,
        beforeAgreementNeeded: before.agreementNeeded,
        beforeManagerVoteWeight: before.managerVoteWeight,
        beforeSellAgreementNeeded: before.sellAgreementNeeded,
        ...values,
        createdAt: now,
      },
    });
    return { changed: true };
  });
}

/** The most recent changes, newest first, for the staff page. */
export async function listFinanceSettingsChanges(db: Db, limit = 5) {
  const rows = await db.financeSettingsChange.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      beforeAgreementNeeded: true,
      beforeManagerVoteWeight: true,
      beforeSellAgreementNeeded: true,
      agreementNeeded: true,
      managerVoteWeight: true,
      sellAgreementNeeded: true,
      changedBy: { select: { name: true, email: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    at: row.createdAt,
    who: row.changedBy?.name ?? row.changedBy?.email ?? "A deleted account",
    before: {
      agreementNeeded: row.beforeAgreementNeeded,
      managerVoteWeight: row.beforeManagerVoteWeight,
      sellAgreementNeeded: row.beforeSellAgreementNeeded,
    },
    after: {
      agreementNeeded: row.agreementNeeded,
      managerVoteWeight: row.managerVoteWeight,
      sellAgreementNeeded: row.sellAgreementNeeded,
    },
  }));
}
