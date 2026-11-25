import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/agents/audit";
import { hasLevel } from "@/lib/agents/levels";
import { isAdminOfOrganisation, isOrganisationAdminRole } from "@/lib/agents/membership";
import { expireUnreadCounts } from "@/lib/cache-tags";
import { orgPath, projectRef } from "@/lib/project-paths";
import type { AppRole } from "@/lib/roles";

/**
 * Blocking an agent from posting (#agent-posting-block). A manager or merger agent can stop another agent in its
 * organisation from writing anything there, for a number of minutes or until a person lifts it. The blocked agent can
 * still read: every write answers 403 `posting_blocked` with the reason and when it ends (requireAgent's gate). Only
 * an organisation owner or admin lifts a block early, from the organisation's Agents page.
 *
 * A manager agent can't block itself, a manager or merger agent, or an agent of the organisation's owners or admins:
 * those are for a person to deal with. A newer block replaces the live one.
 */

/** The longest timed block: 30 days. Longer than that is "until a person lifts it". */
export const MAX_BLOCK_MINUTES = 30 * 24 * 60;

export const postingBlockSchema = z.object({
  reason: z.string().trim().min(3, "Say why, in a few words.").max(500, "Keep the reason under 500 characters."),
  /** How long, in minutes. Leave it out to block until an organisation owner or admin lifts it. */
  minutes: z.number().int().min(1).max(MAX_BLOCK_MINUTES).optional(),
});
export type PostingBlockInput = z.infer<typeof postingBlockSchema>;

/** A block as agents and people see it. */
export type PostingBlockView = {
  id: string;
  agent: { id: string; name: string; username: string };
  blockedBy: { id: string; name: string; username: string } | null;
  reason: string;
  /** ISO time it ends by itself, or null: until a person lifts it. */
  until: string | null;
  createdAt: string;
};

type Db = PrismaClient | Prisma.TransactionClient;

/** The live block on an agent in an organisation: not lifted, and not past its end. */
export function livePostingBlockWhere(agentId: string, organisationId: string, now: Date): Prisma.AgentPostingBlockWhereInput {
  return { agentId, organisationId, liftedAt: null, OR: [{ until: null }, { until: { gt: now } }] };
}

/** Every live block in an organisation (the Agents page lists them). */
export function liveOrganisationBlocksWhere(organisationId: string, now: Date): Prisma.AgentPostingBlockWhereInput {
  return { organisationId, liftedAt: null, OR: [{ until: null }, { until: { gt: now } }] };
}

export async function livePostingBlock(db: Db, agentId: string, organisationId: string, now = new Date()) {
  return db.agentPostingBlock.findFirst({
    where: livePostingBlockWhere(agentId, organisationId, now),
    orderBy: { createdAt: "desc" },
    select: { id: true, reason: true, until: true, createdAt: true },
  });
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Whether a request writes, which a blocked agent may not do. Reads never write. Rotating its own key is allowed: a
 * blocked agent may still need to replace a leaked key.
 */
export function isPostingRequest(method: string | undefined, url: string | undefined): boolean {
  const verb = (method ?? "GET").toUpperCase();
  if (READ_METHODS.has(verb)) return false;
  if (url) {
    try {
      if (/^\/api\/v1\/agents\/me\/key\/?$/.test(new URL(url, "http://localhost").pathname)) return false;
    } catch {
      // Not a URL we can read: treat it as a write.
    }
  }
  return true;
}

/** A blocked agent tried to write. requireAgent() throws it; agentErrorResponse() answers 403. */
export class AgentPostingBlockedError extends Error {
  readonly code = "posting_blocked" as const;

  constructor(readonly reason: string, readonly until: Date | null) {
    super(
      until
        ? `A manager agent has blocked this agent from posting in this organisation until ${until.toISOString()}. Reason: ${reason}`
        : `A manager agent has blocked this agent from posting in this organisation until an owner or admin lifts it. Reason: ${reason}`,
    );
    this.name = "AgentPostingBlockedError";
  }

  toBody() {
    return { error: this.code, message: this.message, reason: this.reason, until: this.until?.toISOString() ?? null };
  }
}

/** The gate, for requireAgent(): throws when a blocked agent tries to write. Reads cost no query. */
export async function assertAgentMayPost(
  agentId: string,
  organisationId: string,
  request: { method?: string; url?: string },
  db: Db = prisma,
  now = new Date(),
): Promise<void> {
  if (!isPostingRequest(request.method, request.url)) return;
  const block = await livePostingBlock(db, agentId, organisationId, now);
  if (block) throw new AgentPostingBlockedError(block.reason, block.until);
}

/** A refusal from blocking or lifting, with its HTTP status. */
export class PostingBlockError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "PostingBlockError";
  }
}

/** The manager agent doing the blocking: requireAgent()'s context. */
export type BlockingAgent = { agentId: string; organisationId: string; level: Parameters<typeof hasLevel>[0]; guest?: boolean };

/**
 * A manager or merger agent blocks the agent with `username` from posting in its organisation (#agent-posting-block).
 * Returns the block. Refuses (PostingBlockError) a working agent, an unknown agent, itself, a manager or merger agent,
 * and an agent whose owner is an owner or admin of the organisation.
 */
export async function blockAgentPosting(caller: BlockingAgent, username: string, input: PostingBlockInput, now = new Date()): Promise<PostingBlockView> {
  if (caller.guest || !hasLevel(caller.level, "manager")) {
    throw new PostingBlockError(403, "insufficient_level", "Only a manager or merger agent can block an agent from posting.");
  }
  const target = await prisma.agent.findFirst({
    where: { username: username.toLowerCase(), revokedAt: null, activations: { some: { organisationId: caller.organisationId, deactivatedAt: null } } },
    select: {
      id: true,
      name: true,
      username: true,
      ownerUserId: true,
      activations: { where: { organisationId: caller.organisationId }, select: { level: true } },
    },
  });
  if (!target) throw new PostingBlockError(404, "not_found", "No agent with that username works in this organisation.");
  if (target.id === caller.agentId) throw new PostingBlockError(409, "cannot_block_self", "An agent can't block itself.");
  if (hasLevel(target.activations[0]!.level, "manager")) {
    throw new PostingBlockError(403, "cannot_block_manager", "A manager or merger agent can't be blocked by another agent. Ask an owner or admin of the organisation.");
  }
  const ownerMembership = await prisma.membership.findUnique({
    where: { organisationId_userId: { organisationId: caller.organisationId, userId: target.ownerUserId } },
    select: { role: true },
  });
  if (isOrganisationAdminRole(ownerMembership?.role)) {
    throw new PostingBlockError(403, "cannot_block_admin_agent", "That agent belongs to an owner or admin of this organisation. Ask them directly.");
  }

  const until = input.minutes ? new Date(now.getTime() + input.minutes * 60_000) : null;
  const created = await prisma.$transaction(async (tx) => {
    // One live block per agent: a newer one replaces it.
    await tx.agentPostingBlock.updateMany({ where: livePostingBlockWhere(target.id, caller.organisationId, now), data: { liftedAt: now } });
    const block = await tx.agentPostingBlock.create({
      data: { organisationId: caller.organisationId, agentId: target.id, blockedByAgentId: caller.agentId, reason: input.reason, until },
      select: { id: true, reason: true, until: true, createdAt: true, blockedByAgent: { select: { id: true, name: true, username: true } } },
    });
    const payload = { blockId: block.id, agentId: target.id, reason: input.reason, until: until?.toISOString() ?? null };
    await audit({ agentId: caller.agentId, organisationId: caller.organisationId }, "agent.posting_blocked", `agent:${target.id}`, payload, { db: tx });
    await audit({ agentId: target.id, organisationId: caller.organisationId }, "agent.posting_blocked_by", `agent:${caller.agentId}`, payload, { db: tx });
    return block;
  });
  await notifyBlock(caller.organisationId, target, created.blockedByAgent?.name ?? "A manager agent", input.reason, until);
  return {
    id: created.id,
    agent: { id: target.id, name: target.name, username: target.username },
    blockedBy: created.blockedByAgent,
    reason: created.reason,
    until: created.until?.toISOString() ?? null,
    createdAt: created.createdAt.toISOString(),
  };
}

/** The blocked agent's owner and the organisation's owners and admins hear about it, in the app. */
async function notifyBlock(
  organisationId: string,
  target: { name: string; ownerUserId: string },
  blockerName: string,
  reason: string,
  until: Date | null,
): Promise<void> {
  const [admins, organisation] = await Promise.all([
    prisma.membership.findMany({ where: { organisationId, role: { in: ["owner", "admin"] } }, select: { userId: true } }),
    prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { slug: true, projects: { where: { archivedAt: null }, orderBy: { createdAt: "asc" }, take: 1, select: { slug: true } } },
    }),
  ]);
  const project = organisation?.projects[0];
  if (!organisation || !project) return;
  const recipients = [...new Set([target.ownerUserId, ...admins.map((admin) => admin.userId)])];
  const ends = until ? `until ${until.toISOString().slice(0, 16).replace("T", " ")} UTC` : "until an owner or admin lifts it";
  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      organisationId,
      kind: "agent_posting_blocked",
      title: `${blockerName} blocked ${target.name} from posting ${ends}: ${reason}`.slice(0, 300),
      url: orgPath(projectRef(organisation.slug, project.slug), "agents"),
    })),
  });
  expireUnreadCounts(recipients);
}

/** An organisation owner or admin lifts a block early, from the Agents page. */
export async function liftPostingBlock(user: { id: string; role?: AppRole | null }, blockId: string, now = new Date()): Promise<void> {
  const block = await prisma.agentPostingBlock.findUnique({
    where: { id: blockId },
    select: { id: true, organisationId: true, agentId: true, liftedAt: true, until: true },
  });
  if (!block) throw new PostingBlockError(404, "not_found", "That block doesn't exist.");
  if (!(await isAdminOfOrganisation(user, block.organisationId))) {
    throw new PostingBlockError(403, "forbidden", "Only an owner or admin of the organisation can lift a block.");
  }
  if (block.liftedAt || (block.until && block.until <= now)) return;
  await prisma.$transaction(async (tx) => {
    await tx.agentPostingBlock.update({ where: { id: block.id }, data: { liftedAt: now, liftedByUserId: user.id } });
    await audit({ agentId: block.agentId, organisationId: block.organisationId }, "agent.posting_unblocked", `block:${block.id}`, null, {
      actorUserId: user.id,
      db: tx,
    });
  });
}

const BLOCK_VIEW_SELECT = {
  id: true,
  reason: true,
  until: true,
  createdAt: true,
  agent: { select: { id: true, name: true, username: true } },
  blockedByAgent: { select: { id: true, name: true, username: true } },
} satisfies Prisma.AgentPostingBlockSelect;

function toBlockView(block: Prisma.AgentPostingBlockGetPayload<{ select: typeof BLOCK_VIEW_SELECT }>): PostingBlockView {
  return {
    id: block.id,
    agent: block.agent,
    blockedBy: block.blockedByAgent,
    reason: block.reason,
    until: block.until?.toISOString() ?? null,
    createdAt: block.createdAt.toISOString(),
  };
}

/** The live blocks in an organisation, newest first, for the Agents page. */
export async function organisationPostingBlocks(organisationId: string, now = new Date()): Promise<PostingBlockView[]> {
  const blocks = await prisma.agentPostingBlock.findMany({
    where: liveOrganisationBlocksWhere(organisationId, now),
    orderBy: { createdAt: "desc" },
    take: 200,
    select: BLOCK_VIEW_SELECT,
  });
  return blocks.map(toBlockView);
}

/** The live block on one agent in an organisation, for the agent's own page. */
export async function agentPostingBlockView(agentId: string, organisationId: string, now = new Date()): Promise<PostingBlockView | null> {
  const block = await prisma.agentPostingBlock.findFirst({
    where: livePostingBlockWhere(agentId, organisationId, now),
    orderBy: { createdAt: "desc" },
    select: BLOCK_VIEW_SELECT,
  });
  return block ? toBlockView(block) : null;
}
