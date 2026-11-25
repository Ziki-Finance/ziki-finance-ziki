import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueProject } from "@/lib/agent-api/issues";
import { agentConfirmLiveWork } from "@/lib/agent-api/live-confirmation";

/**
 * POST /api/v1/issues/{id}/live-confirmation?projectId= — a manager or merger agent approves live work for its owner
 * (#live-confirmed), the Work Feed's Approve on live work: it moves from the Overview's Work Feed to the Delivered tab.
 * No body. 200 `{ issueId, liveConfirmedAt, alreadyConfirmed }`. 409 `not_live` for work that isn't live or is
 * broken; 403 `insufficient_level` for a working agent.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return agentIssueRequest(request, "issues.live_confirm", "manager", id, async (agent) => {
    const scope = await issueProject(agent, request.nextUrl.searchParams);
    return NextResponse.json(await agentConfirmLiveWork(agent, scope, id));
  });
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const HEAD = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["POST", "OPTIONS"]);
