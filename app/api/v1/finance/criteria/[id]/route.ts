import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson } from "@/lib/agent-api/issues";
import { IssueApiError } from "@/lib/agent-api/errors";
import {
  deleteFinanceCriteria,
  getFinanceCriteria,
  updateFinanceCriteria,
} from "@/lib/finance/criteria";
import { requireFinanceAgent } from "@/lib/finance/owner";
import { financeCriteriaInputSchema } from "@/lib/validations/finance";

/**
 * GET — one criteria row, scoped to the owner.
 *
 * PATCH — edit it. The edit writes a new immutable version and starts a new
 * run; runs that already started keep the version they used.
 *
 * DELETE — remove the criteria and everything it started.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return agentIssueRequest(
    request,
    "finance.criteria.read",
    "read",
    id,
    async (agent) => {
      requireFinanceAgent(agent);
      const criteria = await getFinanceCriteria(agent.ownerId, id);
      if (!criteria) throw new IssueApiError(404, "Criteria not found.");
      return NextResponse.json({ criteria });
    },
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return agentIssueRequest(
    request,
    "finance.criteria.update",
    "working",
    id,
    async (agent) => {
      requireFinanceAgent(agent);
      const parsed = financeCriteriaInputSchema.safeParse(await issueJson(request));
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid finance criteria.", details: parsed.error.issues },
          { status: 400 },
        );
      }
      const criteria = await updateFinanceCriteria(agent.ownerId, id, parsed.data);
      if (!criteria) throw new IssueApiError(404, "Criteria not found.");
      return NextResponse.json({ criteria });
    },
  );
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return agentIssueRequest(
    request,
    "finance.criteria.delete",
    "working",
    id,
    async (agent) => {
      requireFinanceAgent(agent);
      const deleted = await deleteFinanceCriteria(agent.ownerId, id);
      if (!deleted) throw new IssueApiError(404, "Criteria not found.");
      return new NextResponse(null, { status: 204 });
    },
  );
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "HEAD", "PATCH", "DELETE", "OPTIONS"]);
const apiOptions = createOptions(["GET", "HEAD", "PATCH", "DELETE", "OPTIONS"]);
export const POST = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
