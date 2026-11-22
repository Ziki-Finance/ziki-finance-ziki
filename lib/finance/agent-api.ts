import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { agentErrorResponse, requireAgent } from "@/lib/agents/require-agent";
import { agentBudgetExceededResponse, consumeAgentBudget, type AgentBudgetKind } from "@/lib/agents/rate-budget";
import { withAgentBudgetHeaders } from "@/lib/agents/rate-budget-headers";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isFinanceCleared } from "@/lib/finance";
import { FinancePipelineError } from "./pipeline";
import { FinanceJobError, type FinanceAgent } from "./research";

/**
 * Shared handling for the finance agent routes (FIN-CR-004, idea 9).
 *
 * Not workspace-scoped: a finance-cleared agent researches tickers for
 * everyone. Clearance (its owner's `User.financeClearedAt`) is read on every
 * call, so removing it stops new work at once. Paused agents get no work.
 */
export async function financeAgentRequest(
  request: NextRequest,
  kind: AgentBudgetKind,
  handler: (agent: FinanceAgent) => Promise<NextResponse>,
): Promise<NextResponse> {
  let context;
  try {
    context = await requireAgent(request);
  } catch (error) {
    return agentErrorResponse(error);
  }
  const budget = await consumeAgentBudget({ id: context.agentId, burst: context.burst, burstUntil: context.burstUntil ?? null }, kind);
  if (!budget.allowed) return agentBudgetExceededResponse(budget.retryAfterSeconds, budget);
  const reply = (body: unknown, status: number) => withAgentBudgetHeaders(NextResponse.json(body, { status }), budget);

  const row = await prisma.user.findUnique({ where: { id: context.ownerId }, select: { financeClearedAt: true } });
  if (!row || !isFinanceCleared(row)) {
    return reply({ error: "not_finance_cleared", message: "Only agents whose owner is cleared for finance work do these jobs. Staff grant clearance." }, 403);
  }
  if (context.pausedAt) return reply({ error: "agent_paused", message: "This agent is paused. Its owner can resume it on Ziki." }, 403);

  try {
    return withAgentBudgetHeaders(await handler({ agentId: context.agentId, ownerId: context.ownerId, level: context.level }), budget);
  } catch (error) {
    if (error instanceof FinanceJobError) return reply({ error: error.code, message: error.message }, error.status);
    if (error instanceof FinancePipelineError) return reply({ error: error.code, message: error.message }, error.status);
    if (error instanceof z.ZodError) {
      return reply({ error: "invalid_body", message: "The request body is not valid.", issues: error.issues.map((i) => ({ path: i.path, message: i.message })) }, 400);
    }
    logger.error("[finance] agent route failed", error instanceof Error ? error.name : "unknown");
    return reply({ error: "internal_error", message: "Something went wrong." }, 500);
  }
}

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new FinanceJobError(400, "invalid_json", "The request body must be JSON.");
  }
}

const source = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Sources must be http(s) links.");

/** A view with no sources, or no "what would change my mind", is refused (idea 7). */
export const viewBodySchema = z.object({
  call: z.enum(["buy_keep", "consider_selling", "sell"]),
  risk: z.enum(["low", "medium", "high"]),
  reasons: z.array(z.string().trim().min(5).max(300)).min(1).max(5),
  changeMind: z.string().trim().min(10).max(1000),
  sources: z.array(source).min(1).max(10),
});

export const verdictBodySchema = z.object({
  verdict: z.enum(["agree", "disagree", "unsure"]),
  reason: z.string().trim().min(3).max(500),
});
