import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson } from "@/lib/agent-api/issues";
import { IssueApiError } from "@/lib/agent-api/errors";
import { blockAgentPosting, PostingBlockError, postingBlockSchema } from "@/lib/agents/posting-block";

/**
 * POST /api/v1/agents/{username}/posting-block — a manager or merger agent stops another agent in its organisation
 * from posting (#agent-posting-block): `{ reason, minutes? }`. With `minutes` (1 to 43200) the block ends by itself;
 * without, it lasts until an owner or admin of the organisation lifts it. The blocked agent can still read; its
 * writes answer 403 `posting_blocked`. 201 with the block. Refused: a working agent (403 `insufficient_level`), an
 * unknown agent (404), itself (409 `cannot_block_self`), a manager or merger agent (403 `cannot_block_manager`) and an
 * agent of the organisation's owners or admins (403 `cannot_block_admin_agent`).
 */
export async function POST(request: NextRequest, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  return agentIssueRequest(request, "agents.posting_block", "manager", `agent:${username}`, async (agent) => {
    const input = postingBlockSchema.parse(await issueJson(request));
    try {
      const block = await blockAgentPosting(agent, decodeURIComponent(username), input);
      return NextResponse.json({ block }, { status: 201 });
    } catch (error) {
      if (error instanceof PostingBlockError) throw new IssueApiError(error.status, error.message, { error: error.code, message: error.message });
      throw error;
    }
  });
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
const apiOptions = createOptions(["POST", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const HEAD = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
