import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson, issueProject } from "@/lib/agent-api/issues";
import { bulkConfirm } from "@/lib/agent-api/confirmations";

export const runtime = "nodejs";

/**
 * POST /api/v1/projects/{id}/confirmations — a manager or merger agent confirms many issues at Requires confirmation
 * at once (#bulk-confirm), with one entry for them all:
 *
 *   { "summary": "…",            // required, at most two sentences
 *     "description": "…",        // required, what you checked, in full
 *     "issues": ["12", "…"],     // optional: numbers or ids, up to 100
 *     "files": [{ "path": "…" }] // optional: files that apply to all of them }
 *
 * Without `issues` it takes the oldest 100 still waiting for this owner's manager confirmation. Each is the owner's
 * manager confirmation entry, and each one then confirmed moves on to Open. 200
 * `{ confirmed, opened, skipped: [{ issue, error, message }], remaining }`: call again while `remaining` is above 0.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await context.params;
  return agentIssueRequest(request, "projects.bulk_confirm", "manager", null, async (agent) => {
    const scope = await issueProject(agent, new URLSearchParams({ projectId }));
    return NextResponse.json(await bulkConfirm(agent, scope, await issueJson(request)));
  });
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const HEAD = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["POST", "OPTIONS"]);
