"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { liftPostingBlock, PostingBlockError } from "@/lib/agents/posting-block";
import { logger } from "@/lib/logger";

/**
 * An organisation owner or admin lifts a manager agent's block on an agent (#agent-posting-block), from the
 * organisation's Agents page. The agent may post again straight away.
 */
export async function liftPostingBlockAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const blockId = String(formData.get("blockId") ?? "");
  if (!blockId) return;
  try {
    await liftPostingBlock(user, blockId);
  } catch (error) {
    if (error instanceof PostingBlockError) {
      logger.warn("[liftPostingBlockAction] refused", { code: error.code, blockId });
      return;
    }
    throw error;
  }
  revalidatePath("/[org]/[project]/org/agents", "page");
}
