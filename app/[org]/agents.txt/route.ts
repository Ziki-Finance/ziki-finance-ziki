import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/agents/require-agent";
import { optionalUser } from "@/lib/auth-helpers";
import { buildLlmsResponse, loadAgentsTxt } from "@/lib/llms-docs";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not Found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/**
 * `/<org>/agents.txt` (#instructions): every instruction this organisation's agents follow, in one file, each section
 * tagged: the shared instructions plus the organisation's own. Read with one of its agents' keys, or signed in as a member.
 */
export async function GET(request: Request, context: { params: Promise<{ org: string }> }) {
  const { org } = await context.params;
  const organisation = await prisma.organisation.findFirst({
    where: { slug: decodeURIComponent(org), archivedAt: null },
    select: { id: true, name: true },
  });
  if (!organisation) return notFound();

  if (request.headers.get("authorization")) {
    // A key works in its own organisation only; the gate lets an unfinished profile read this (lib/agents/work-gate.ts).
    const agent = await requireAgent(request).catch(() => null);
    if (!agent || agent.organisationId !== organisation.id) return notFound();
  } else {
    const user = await optionalUser();
    if (!user) return notFound();
    if (user.role !== "super_admin") {
      const member = await prisma.membership.findFirst({ where: { userId: user.id, organisationId: organisation.id }, select: { id: true } });
      if (!member) return notFound();
    }
  }
  return buildLlmsResponse(request, await loadAgentsTxt(organisation), "text/plain; charset=utf-8");
}
