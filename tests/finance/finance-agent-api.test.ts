import { NextResponse, type NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAgent = vi.fn();
const findUser = vi.fn();
vi.mock("@/lib/agents/require-agent", () => ({
  requireAgent: (...args: unknown[]) => requireAgent(...args),
  agentErrorResponse: () => NextResponse.json({ error: "invalid_key" }, { status: 401 }),
}));
vi.mock("@/lib/agents/rate-budget", () => ({
  consumeAgentBudget: vi.fn().mockResolvedValue({ allowed: true }),
  agentBudgetExceededResponse: () => NextResponse.json({ error: "rate_limited" }, { status: 429 }),
}));
vi.mock("@/lib/agents/rate-budget-headers", () => ({ withAgentBudgetHeaders: (response: NextResponse) => response }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...args: unknown[]) => findUser(...args) } } }));

import { financeAgentRequest, verdictBodySchema, viewBodySchema } from "@/lib/finance/agent-api";
import { FinanceJobError } from "@/lib/finance/research";

const request = {} as NextRequest;
const context = { agentId: "a1", ownerId: "o1", level: "working", burst: false, pausedAt: null };

describe("the finance agent routes (idea 9)", () => {
  beforeEach(() => {
    requireAgent.mockResolvedValue(context);
    findUser.mockResolvedValue({ financeClearedAt: new Date() });
  });

  it("serves a cleared agent, with its owner and class", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const res = await financeAgentRequest(request, "read", handler);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith({ agentId: "a1", ownerId: "o1", level: "working" });
  });

  it("refuses an agent whose owner isn't finance-cleared, checked on every call", async () => {
    findUser.mockResolvedValue({ financeClearedAt: null });
    const handler = vi.fn();
    const res = await financeAgentRequest(request, "read", handler);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_finance_cleared");
    expect(handler).not.toHaveBeenCalled();
  });

  it("gives a paused agent no work", async () => {
    requireAgent.mockResolvedValue({ ...context, pausedAt: new Date() });
    const res = await financeAgentRequest(request, "read", vi.fn());
    expect((await res.json()).error).toBe("agent_paused");
  });

  it("turns job errors and bad bodies into plain answers", async () => {
    const conflict = await financeAgentRequest(request, "write", async () => {
      throw new FinanceJobError(409, "already_posted", "You already posted a view on this job.");
    });
    expect(conflict.status).toBe(409);
    const invalid = await financeAgentRequest(request, "write", async () => {
      viewBodySchema.parse({});
      return NextResponse.json({});
    });
    expect(invalid.status).toBe(400);
  });
});

describe("what a view and a verdict must contain (idea 7)", () => {
  const view = { call: "consider_selling", risk: "high", reasons: ["Sales fell two quarters in a row"], changeMind: "Sales growing again next quarter", sources: ["https://www.sec.gov/filing"] };

  it("accepts a complete view", () => {
    expect(viewBodySchema.parse(view).call).toBe("consider_selling");
  });

  it("refuses a view without sources or without what would change its mind", () => {
    expect(viewBodySchema.safeParse({ ...view, sources: [] }).success).toBe(false);
    expect(viewBodySchema.safeParse({ ...view, changeMind: "" }).success).toBe(false);
    expect(viewBodySchema.safeParse({ ...view, sources: ["javascript:alert(1)"] }).success).toBe(false);
    expect(viewBodySchema.safeParse({ ...view, reasons: Array(6).fill("A long enough reason") }).success).toBe(false);
  });

  it("needs a verdict and a short reason", () => {
    expect(verdictBodySchema.safeParse({ verdict: "agree", reason: "Matches the filing" }).success).toBe(true);
    expect(verdictBodySchema.safeParse({ verdict: "maybe", reason: "Matches the filing" }).success).toBe(false);
    expect(verdictBodySchema.safeParse({ verdict: "agree" }).success).toBe(false);
  });
});
