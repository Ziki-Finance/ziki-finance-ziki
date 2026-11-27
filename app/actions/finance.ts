"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { FinanceClearanceError, grantFinanceClearance, removeFinanceClearance } from "@/lib/finance/clearance";
import { parseFinanceSettings, saveFinanceSettings } from "@/lib/finance/settings";
import {
  FINANCE_EVIDENCE_SECTIONS,
  parsePipelineSettings,
  savePipelineSettings,
  type FinanceEvidenceSectionName,
} from "@/lib/finance/pipeline-settings";

/**
 * Ziki Finance staff actions: finance clearance (FIN-D-005) and the numbers and
 * pipeline thresholds staff set on `/superadmin/finance` (FIN-D-022, PRD §3).
 */

const CLEARANCE_PAGE = "/finance/admin";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

// ---------------------------------------------------------------------------
// Staff: finance clearance (idea 5)
// ---------------------------------------------------------------------------

export async function grantFinanceClearanceAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const rawEmails = [
    ...formData.getAll("emails").map((v) => String(v).trim()),
    ...field(formData, "email").split(/[\s,;]+/),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const emails = Array.from(new Set(rawEmails));
  if (emails.length === 0) {
    redirect(`${CLEARANCE_PAGE}?error=invalid_email#clearance`);
  }

  let granted = 0;
  let lastError: FinanceClearanceError | null = null;
  for (const email of emails) {
    try {
      await grantFinanceClearance(prisma, email);
      granted += 1;
    } catch (error) {
      if (error instanceof FinanceClearanceError) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  revalidatePath(CLEARANCE_PAGE);
  if (granted === 0 && lastError) {
    redirect(`${CLEARANCE_PAGE}?error=${lastError.code}#clearance`);
  }
  const skipped = emails.length - granted;
  const skippedParam = skipped > 0 ? `&skipped=${skipped}` : "";
  redirect(`${CLEARANCE_PAGE}?saved=clearance&count=${granted}${skippedParam}#clearance`);
}

export async function removeFinanceClearanceAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  await removeFinanceClearance(prisma, field(formData, "userId"));
  revalidatePath(CLEARANCE_PAGE);
  redirect(`${CLEARANCE_PAGE}?saved=revoked#clearance`);
}

/** Staff set the agreement numbers (idea 19, FIN-D-022). A change applies from the next settle. */
export async function saveFinanceSettingsAction(formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  const parsed = parseFinanceSettings({
    agreementNeeded: field(formData, "agreementNeeded"),
    managerVoteWeight: field(formData, "managerVoteWeight"),
    sellAgreementNeeded: field(formData, "sellAgreementNeeded"),
  });
  if (!parsed.ok) redirect(`${CLEARANCE_PAGE}?error=${parsed.error}&section=agreement#agreement`);
  const result = await saveFinanceSettings(prisma, parsed.values, user.id);
  revalidatePath(CLEARANCE_PAGE);
  redirect(`${CLEARANCE_PAGE}?saved=${result.changed ? "1" : "unchanged"}#agreement`);
}

/** Staff set the v3 pipeline thresholds (PRD §3, §4.3, §4.4). */
export async function savePipelineSettingsAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const dossierCaps: Partial<Record<FinanceEvidenceSectionName, string>> = {};
  for (const section of FINANCE_EVIDENCE_SECTIONS) {
    dossierCaps[section] = field(formData, `cap_${section}`);
  }
  const parsed = parsePipelineSettings({
    researchersScreen: field(formData, "researchersScreen"),
    researchersEnrich: field(formData, "researchersEnrich"),
    researchersEvaluate: field(formData, "researchersEvaluate"),
    reviewersPerStock: field(formData, "reviewersPerStock"),
    reviewersWhoMustAgree: field(formData, "reviewersWhoMustAgree"),
    candidateRule: field(formData, "candidateRule"),
    stageTimeLimitMinutes: field(formData, "stageTimeLimitMinutes"),
    balanceShare: field(formData, "balanceShare"),
    browsingRules: field(formData, "browsingRules"),
    oneTaskPerAgent: formData.get("oneTaskPerAgent") === "on",
    dossierCaps,
  });
  if (!parsed.ok) redirect(`${CLEARANCE_PAGE}?error=${parsed.error}&section=pipeline#pipeline`);
  await savePipelineSettings(prisma, parsed.values);
  revalidatePath(CLEARANCE_PAGE);
  redirect(`${CLEARANCE_PAGE}?saved=pipeline#pipeline`);
}
