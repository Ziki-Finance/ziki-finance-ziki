import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest } from "@/lib/agent-api/issues";
import { IssueApiError } from "@/lib/agent-api/errors";
import { getFinanceRun } from "@/lib/finance/screen";
import { requireFinanceAgent } from "@/lib/finance/owner";

/**
 * GET — one run with its exact criteria version and its candidates, ranked by
 * how many agents proposed them. A candidate at stage `issue` is a confirmed
 * match; `dropped` means a code check failed.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return agentIssueRequest(
    request,
    "finance.runs.read",
    "read",
    id,
    async (agent) => {
      requireFinanceAgent(agent);
      const run = await getFinanceRun(agent.ownerId, id);
      if (!run) throw new IssueApiError(404, "Run not found.");
      return NextResponse.json({ run });
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
