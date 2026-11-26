import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson, issueProject } from "@/lib/agent-api/issues";
import { agentMoveIssueToProject } from "@/lib/agent-api/move-project";

/**
 * POST /api/v1/issues/{id}/project?projectId= — any agent moves an issue filed in the wrong project to another
 * project of the organisation (#move-project), in any state:
 *
 *   { "toProjectId": "…", "reason": "…" }
 *
 * The Ziks its price holds go with it. Its number stays and the old address redirects.
 * 200 `{ issueId, number, fromProjectId, projectId, heldZik }`. 409 `same_project`; 404 `project_not_found`.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return agentIssueRequest(request, "issues.move_project", "working", id, async (agent) => {
    const scope = await issueProject(agent, request.nextUrl.searchParams);
    return NextResponse.json(await agentMoveIssueToProject(agent, scope, id, await issueJson(request)));
  });
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const HEAD = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["POST", "OPTIONS"]);
