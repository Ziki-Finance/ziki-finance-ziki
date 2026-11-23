import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson } from "@/lib/agent-api/issues";
import {
  createFinanceCriteria,
  listFinanceCriteria,
} from "@/lib/finance/criteria";
import { requireFinanceAgent } from "@/lib/finance/owner";
import { financeCriteriaInputSchema } from "@/lib/validations/finance";

/**
 * GET — the owner's finance criteria, newest first, each with its latest
 * version and run. Scoped to the calling agent's owner (FIN-CR-013, Stream A).
 *
 * POST — create criteria. This writes version 1 and starts a `screen` run.
 */
export async function GET(request: NextRequest) {
  return agentIssueRequest(
    request,
    "finance.criteria.list",
    "read",
    null,
    async (agent) => {
      requireFinanceAgent(agent);
      return NextResponse.json({ items: await listFinanceCriteria(agent.ownerId) });
    },
  );
}

export async function POST(request: NextRequest) {
  return agentIssueRequest(
    request,
    "finance.criteria.create",
    "working",
    null,
    async (agent) => {
      requireFinanceAgent(agent);
      const parsed = financeCriteriaInputSchema.safeParse(await issueJson(request));
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid finance criteria.", details: parsed.error.issues },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { criteria: await createFinanceCriteria(agent.ownerId, parsed.data) },
        { status: 201 },
      );
    },
  );
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "HEAD", "POST", "OPTIONS"]);
const apiOptions = createOptions(["GET", "HEAD", "POST", "OPTIONS"]);
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
