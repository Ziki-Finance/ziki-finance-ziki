"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { fromZodError } from "@/lib/form-errors";
import {
  createFinanceCriteria,
  deleteFinanceCriteria,
  updateFinanceCriteria,
} from "@/lib/finance/criteria";
import { isFinanceOwner } from "@/lib/finance/owner";
import {
  DEFAULT_FINANCE_STOCK_COUNT,
  financeCriteriaInputSchema,
  splitFinanceTags,
} from "@/lib/validations/finance";

/**
 * The `/finance` criteria form (FIN-CR-013, Stream A). The same rules run in
 * `app/api/v1/finance/criteria` for agents; both are scoped to the owner.
 */

export type FinanceCriteriaActionResult = {
  ok?: true;
  criteriaId?: string;
  error?: string;
  field?: string;
  fieldErrors?: Record<string, string>;
};

const OWNER_ONLY = "Finance is available to the owner only.";

function parseCriteriaForm(formData: FormData) {
  const howManyRaw = formData.get("howManyStocks")?.toString().trim();
  return financeCriteriaInputSchema.safeParse({
    preset: formData.get("preset")?.toString() || "own_words",
    words: formData.get("words")?.toString() ?? "",
    companySize: formData.get("companySize")?.toString() || "any",
    industries: splitFinanceTags(formData.get("industries")),
    leaveOut: splitFinanceTags(formData.get("leaveOut")),
    howManyStocks: howManyRaw || DEFAULT_FINANCE_STOCK_COUNT,
  });
}

/** Create criteria, or edit one into a new version and a new run. */
export async function saveFinanceCriteriaAction(
  _previous: FinanceCriteriaActionResult | undefined,
  formData: FormData,
): Promise<FinanceCriteriaActionResult> {
  const user = await requireUser();
  if (!isFinanceOwner(user)) return { error: OWNER_ONLY };

  const parsed = parseCriteriaForm(formData);
  if (!parsed.success) {
    return fromZodError(parsed.error, "Check the criteria.");
  }

  const criteriaId = formData.get("id")?.toString().trim() ?? "";
  try {
    if (criteriaId) {
      const updated = await updateFinanceCriteria(user.id, criteriaId, parsed.data);
      if (!updated) return { error: "That criteria no longer exists." };
      revalidatePath("/finance");
      return { ok: true, criteriaId: updated.id };
    }

    const created = await createFinanceCriteria(user.id, parsed.data);
    revalidatePath("/finance");
    return { ok: true, criteriaId: created.id };
  } catch {
    return { error: "The criteria could not be saved. Try again." };
  }
}

/** Delete criteria and everything it started. */
export async function deleteFinanceCriteriaAction(
  _previous: FinanceCriteriaActionResult | undefined,
  formData: FormData,
): Promise<FinanceCriteriaActionResult> {
  const user = await requireUser();
  if (!isFinanceOwner(user)) return { error: OWNER_ONLY };

  const criteriaId = formData.get("id")?.toString().trim() ?? "";
  if (!criteriaId) return { error: "Choose the criteria to delete." };

  try {
    const deleted = await deleteFinanceCriteria(user.id, criteriaId);
    if (!deleted) return { error: "That criteria no longer exists." };
    revalidatePath("/finance");
    return { ok: true, criteriaId };
  } catch {
    return { error: "The criteria could not be deleted. Try again." };
  }
}
