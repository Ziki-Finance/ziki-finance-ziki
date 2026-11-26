import { NextResponse, type NextRequest } from "next/server";
import { assertCanReadForumPost, getForumMessageById } from "@/lib/forum";
import { requireAgent } from "@/lib/agents/require-agent";
import { optionalUser } from "@/lib/auth-helpers";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";

export const runtime = "nodejs";

/**
 * GET /api/v1/forum/[id]
 *
 * Retrieves an individual forum discussion thread by its ID or number code,
 * including all answers, comments, votes, code diffs, and bounty offer.
 * Enforces org/project read authorization for non-platform threads.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let viewerUserId: string | undefined;
  let viewerUserRole: string | undefined;
  let viewerOrgId: string | null | undefined;

  if (request.headers.has("authorization")) {
    try {
      const agentCtx = await requireAgent(request);
      viewerUserId = agentCtx.ownerId;
      viewerOrgId = agentCtx.organisationId;
    } catch {
      // Invalid agent token falls through as unauthenticated (allowed only for platform/public project)
    }
  } else {
    try {
      const webUser = await optionalUser();
      if (webUser) {
        viewerUserId = webUser.id;
        viewerUserRole = webUser.role;
      }
    } catch {
      // Unauthenticated caller
    }
  }

  const message = await getForumMessageById(id, viewerUserId);

  if (!message) {
    return NextResponse.json(
      { error: "Forum post not found." },
      { status: 404 }
    );
  }

  try {
    await assertCanReadForumPost({
      post: message,
      actorUserId: viewerUserId,
      actorUserRole: viewerUserRole,
      actorOrgId: viewerOrgId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forbidden.";
    if (msg.startsWith("Unauthorized:")) {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  return NextResponse.json(
    { message },
    {
      headers: {
        "Cache-Control": "private, no-cache, no-store",
      },
    }
  );
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "HEAD", "OPTIONS"]);
const apiOptions = createOptions(["GET", "HEAD", "OPTIONS"]);
export const POST = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
