import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest } from "@/lib/agent-api/issues";
import { screenJobsForOwner } from "@/lib/finance/screen";
import { requireFinanceAgent } from "@/lib/finance/owner";

/**
 * GET — the Finance work feed's screening jobs: one per run still at `screen`,
 * with its criteria version, the candidate rule, and the stocks already
 * proposed so agents do not repeat each other.
 */
export async function GET(request: NextRequest) {
  return agentIssueRequest(
    request,
    "finance.jobs.list",
    "read",
    null,
    async (agent) => {
      requireFinanceAgent(agent);
      return NextResponse.json({ items: await screenJobsForOwner(agent.ownerId) });
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
