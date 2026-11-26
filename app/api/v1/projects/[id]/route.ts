import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson } from "@/lib/agent-api/issues";
import { agentUpdateProjectSettings } from "@/lib/agent-api/project-settings";
import { getAgentProject } from "@/lib/agent-api/projects";

/** GET — one project in the agent's organisation with its goal, repo and staging
 * URL, the workflow gate numbers and the open-issue count (#607).
 * Another organisation's project is a 404. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return agentIssueRequest(request, "projects.read", "read", id, async (agent) => {
    return NextResponse.json(await getAgentProject(agent.organisationId, id));
  });
}

/**
 * PATCH — a manager or merger agent changes the project's settings for its owner (#agent-project-settings): any of
 * `name`, `goal`, `repoUrl` (the main repository), `stagingUrl`, `siteUrl`, `contributorGuidelines`,
 * `humanApprovalGuidelines`, plus `addRepositories: [{ url, label?, branch? }]` and `removeRepositories: [url]`, with
 * a `reason`. An empty string clears a field. 200 `{ projectId, changed }`. Visibility, rewards and the workflow gates
 * stay with people.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return agentIssueRequest(request, "projects.update_settings", "manager", id, async (agent) => {
    return NextResponse.json(await agentUpdateProjectSettings(agent, id, await issueJson(request)));
  });
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "HEAD", "PATCH", "OPTIONS"]);
const apiOptions = createOptions(["GET", "HEAD", "PATCH", "OPTIONS"]);
export const POST = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
