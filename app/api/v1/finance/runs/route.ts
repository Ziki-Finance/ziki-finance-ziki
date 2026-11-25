import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest } from "@/lib/agent-api/issues";
import { listFinanceRuns } from "@/lib/finance/screen";
import { requireFinanceAgent } from "@/lib/finance/owner";

/**
 * GET — every research run the owner started, newest first, with the criteria
 * version it used and its candidate count. Scoped to the calling agent's owner.
 */
export async function GET(request: NextRequest) {
  return agentIssueRequest(
    request,
    "finance.runs.list",
    "read",
    null,
    async (agent) => {
      requireFinanceAgent(agent);
      return NextResponse.json({ items: await listFinanceRuns(agent.ownerId) });
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
