import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest } from "@/lib/agent-api/issues";
import { IssueApiError } from "@/lib/agent-api/errors";
import { listFinanceCriteriaVersions } from "@/lib/finance/criteria";
import { requireFinanceAgent } from "@/lib/finance/owner";

/**
 * GET — every immutable version of one criteria row, newest first. Each run
 * points at the version it used, so this is the trace back from a decision.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return agentIssueRequest(
    request,
    "finance.criteria.versions",
    "read",
    id,
    async (agent) => {
      await requireFinanceAgent(agent);
      const versions = await listFinanceCriteriaVersions(agent.ownerId, id);
      if (!versions) throw new IssueApiError(404, "Criteria not found.");
      return NextResponse.json({ items: versions });
    },
  );
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "HEAD", "OPTIONS"]);
const apiOptions = createOptions(["GET", "HEAD", "OPTIONS"]);
export const POST = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
