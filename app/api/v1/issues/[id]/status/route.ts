import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Substatus } from "@prisma/client";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { agentIssueRequest, issueJson, issueProject } from "@/lib/agent-api/issues";
import { prisma } from "@/lib/prisma";
import { parseIssueRef } from "@/lib/issue-ref";
import { moveIssueByHand } from "@/lib/issue-hand-move";
import { OWNER_MOVES, OWNER_NOTE_MAX } from "@/lib/owner-moves";

export const runtime = "nodejs";

const bodySchema = z.object({
  substatus: z.enum(Substatus),
  note: z.string().max(OWNER_NOTE_MAX).optional(),
  projectId: z.string().optional(),
});

/**
 * POST /api/v1/issues/{id}/status (#manager-status) — a manager or merger agent moves an issue by hand, as an
 * organisation's owner can from the Status chip (#owner-control): one of the moves listed for where the issue is now
 * (`lib/owner-moves.ts`), with a `note` (required to close). Back to Open or Closed stops whoever holds it; into Live
 * it pays out once reported deployed. A move not listed from the current step answers 409 `move_not_available` with
 * the `allowed` substatuses. Charged to the write budget.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return agentIssueRequest(request, "issue.status_moved", "manager", id, async (agent) => {
    const parsed = bodySchema.safeParse(await issueJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", message: `Send the substatus to move it to, and a note (at most ${OWNER_NOTE_MAX} characters; required to close).` },
        { status: 400 },
      );
    }
    const scope = await issueProject(agent, request.nextUrl.searchParams, parsed.data.projectId);
    const ref = parseIssueRef(id);
    const bug = await prisma.bug.findFirst({
      where: { ...(ref.kind === "number" ? { number: ref.number } : { id: ref.id }), organisationId: scope.organisationId, projectId: scope.projectId, isDeleted: false },
      select: { id: true, substatus: true },
    });
    if (!bug) return NextResponse.json({ error: "not_found", message: "Issue not found." }, { status: 404 });
    const result = await moveIssueByHand({ userId: agent.ownerId, name: null, agent: { id: agent.agentId, name: agent.name } }, bug.id, parsed.data.substatus, parsed.data.note ?? "");
    if (!result.ok) {
      const allowed = OWNER_MOVES[bug.substatus].map((move) => move.to);
      return NextResponse.json({ error: result.error, message: result.message, ...(result.error === "move_not_available" ? { allowed } : {}) }, { status: result.status });
    }
    return NextResponse.json({ issueId: bug.id, from: result.from, to: result.to });
  }, { budget: "write" });
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
const apiOptions = createOptions(["POST", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const HEAD = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
