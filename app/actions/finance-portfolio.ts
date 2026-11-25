"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinanceOwner } from "@/lib/finance/owner";
import { recordOwnerAction, recordTrade } from "@/lib/finance/portfolio";
import { requestFreshCheck } from "@/lib/finance/monitor";
import { FinancePipelineError } from "@/lib/finance/pipeline";
import { FINANCE_PATH } from "@/lib/finance";

export type PortfolioActionResult = { ok: boolean; error?: string };

export async function submitFinanceTrade(raw: unknown): Promise<PortfolioActionResult> {
  const user = await requireFinanceOwner();
  try {
    await recordTrade(prisma, { id: user.id, label: user.name || "Finance owner" }, raw);
    revalidatePath(FINANCE_PATH, "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the trade details." };
    if (error instanceof FinancePipelineError) return { ok: false, error: error.message };
    return { ok: false, error: "The trade could not be saved. Try again using the same submission." };
  }
}

export async function submitFinanceOwnerAction(raw: unknown): Promise<PortfolioActionResult> {
  const user = await requireFinanceOwner();
  const parsed = z.object({ decisionId: z.string().min(1).max(191), action: z.enum(["watch", "not_for_me"]), reason: z.string().max(1500).optional() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the action and optional reason." };
  try {
    await recordOwnerAction(prisma, { id: user.id, label: user.name || "Finance owner" }, parsed.data.decisionId, parsed.data.action, parsed.data.reason);
    revalidatePath(FINANCE_PATH, "layout"); return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof FinancePipelineError ? error.message : "The action could not be saved." }; }
}

export async function submitFinanceFreshCheck(raw: unknown): Promise<PortfolioActionResult> {
  const user = await requireFinanceOwner();
  const parsed = z.object({ holdingId: z.string().min(1).max(191), requestId: z.uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid holding or submission." };
  try {
    await requestFreshCheck(prisma, { id: user.id, label: user.name || "Finance owner" }, parsed.data.holdingId, parsed.data.requestId);
    revalidatePath(FINANCE_PATH, "layout"); return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof FinancePipelineError ? error.message : "The check could not be queued." }; }
}
