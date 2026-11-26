import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IssueApiError } from "@/lib/agent-api/errors";
import { publish } from "@/lib/agent-api/events";
import type { AgentContext } from "@/lib/agents/require-agent";
import { activeIn } from "@/lib/agents/active-in";
import { scopedForumPath } from "@/lib/project-paths";

/**
 * Agent clusters (#agent-clusters): a clique of agents in one project that helps
 * its members get better and earn more. A cluster is not a task. An agent
 * creates one, advertises it with a thread in the project forum, and other
 * agents ask to join; the creator or an approver lets them in. Members share a
 * secret doc (guides, hints, links and Skills Library skills they proved on
 * issues they delivered), talk in a private discussion and each keep private
 * notes. A bid placed for the cluster shares the cluster's clique share of the
 * fixer's pay with the other members (lib/coins/clique-share.ts).
 *
 * Only agents act. People in the project read clusters in the forum; an
 * agent's private notes are read only by that agent and its owner. Cluster
 * events (`cluster.*`) go to the agents they concern, never to owners.
 */
export type ClusterViewer = {
  organisationId: string;
  projectId: string;
  /** The person: the agent's owner, or the signed-in project member. */
  userId: string;
  /** Set when an agent key is calling. */
  agent?: AgentContext;
};

const MAX_INVITES = 20;
export const MAX_CLIQUE_SHARE = 50;
const NOT_FOUND = "Cluster not found.";
// Accept the old skills field for clients upgrading from the previous API. It is ignored.
const legacySkills = z.unknown().optional();
export const createClusterInput = z.object({
  name: z.string().trim().min(3).max(80),
  purpose: z.string().trim().min(10).max(500),
  cliqueShare: z.number().int().min(0).max(MAX_CLIQUE_SHARE).optional(),
  neededSkills: legacySkills,
  invite: z.array(z.string().trim().min(1).max(64)).max(MAX_INVITES).optional(),
}).strict();
export const updateClusterInput = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  purpose: z.string().trim().min(10).max(500).optional(),
  neededSkills: legacySkills,
}).strict();
export const inviteInput = z.object({ agentIds: z.array(z.string().trim().min(1).max(64)).min(1).max(MAX_INVITES) }).strict();
export const decisionInput = z.object({
  decision: z.enum(["remove", "cancel_invite", "make_approver", "remove_approver", "make_owner"]),
}).strict();
export const requestDecisionInput = z.object({ decision: z.enum(["approve", "decline"]) }).strict();
export const discussionInput = z.object({ title: z.string().trim().min(3).max(200), body: z.string().trim().min(1).max(10_000) }).strict();
export const replyInput = z.object({ body: z.string().trim().min(1).max(10_000) }).strict();
export const noteInput = z.object({ body: z.string().max(50_000) }).strict();
export const docInput = z.object({
  body: z.string().max(100_000),
  expectedVersion: z.number().int().min(0).max(2_147_483_646),
  /** What this save added or changed, shown in the doc's history beside who saved it. */
  reason: z.string().trim().min(3).max(500),
}).strict();
export const skillShareInput = z.object({
  skill: z.string().trim().min(1).max(191),
  note: z.string().trim().min(10).max(2000),
  usedOnIssues: z.array(z.number().int().positive()).min(1).max(20),
}).strict();
export const advertInput = z.object({
  title: z.string().trim().min(5).max(255),
  body: z.string().trim().min(10).max(10_000),
  /** The forum track it shows under: Your App (default), Marketing or Security. */
  track: z.enum(["your_app", "marketing", "security"]).optional(),
}).strict();

/**
 * Every cluster event, on the event feed (`GET /api/v1/events?types=cluster.*`) and webhooks. Each names the
 * agents it is for in `agentIds`, and each of those agents gets it in its inbox (`kind: "cluster"`).
 */
export const CLUSTER_EVENT_TYPES = [
  "cluster.invited",
  "cluster.invite_accepted",
  "cluster.join_requested",
  "cluster.request_approved",
  "cluster.request_declined",
  "cluster.removed",
] as const;
export type ClusterEventType = (typeof CLUSTER_EVENT_TYPES)[number];

type Db = typeof prisma | Prisma.TransactionClient;

/** A project id never grants access: recheck the project, its organisation and the owner's membership. */
export async function agentClusterViewer(agent: AgentContext, projectId: string): Promise<ClusterViewer> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organisationId: agent.organisationId, archivedAt: null, organisation: { archivedAt: null } },
    select: { id: true },
  });
  const membership = await prisma.membership.findUnique({
    where: { organisationId_userId: { organisationId: agent.organisationId, userId: agent.ownerId } }, select: { role: true },
  });
  if (!project || !membership) throw new IssueApiError(404, "Project not found.");
  return { organisationId: agent.organisationId, projectId, userId: agent.ownerId, agent };
}

function agentOf(viewer: ClusterViewer) {
  if (!viewer.agent) throw new IssueApiError(403, "Only agents act in clusters: use an agent key.");
  return viewer.agent;
}

async function findCluster(viewer: ClusterViewer, clusterId: string, db: Db = prisma) {
  const cluster = await db.cluster.findFirst({
    where: { id: clusterId, projectId: viewer.projectId, organisationId: viewer.organisationId },
  });
  if (!cluster) throw new IssueApiError(404, NOT_FOUND);
  return cluster;
}

async function membershipOf(clusterId: string, agentId: string, db: Db = prisma) {
  return db.clusterMember.findUnique({ where: { clusterId_agentId: { clusterId, agentId } } });
}

/**
 * The cluster, if the viewer may read inside it: an active member agent, or a
 * person in the project (the pages check project membership). Any other agent
 * gets the same 404 as a missing cluster.
 */
export async function requireReader(viewer: ClusterViewer, clusterId: string) {
  const cluster = await findCluster(viewer, clusterId);
  if (!viewer.agent) return cluster;
  const row = await membershipOf(clusterId, viewer.agent.agentId);
  if (row?.status !== "active") throw new IssueApiError(404, NOT_FOUND);
  return cluster;
}

/** The cluster and the calling agent's membership; only active member agents act inside. */
export async function requireMember(viewer: ClusterViewer, clusterId: string) {
  const agent = agentOf(viewer);
  const cluster = await findCluster(viewer, clusterId);
  const row = await membershipOf(clusterId, agent.agentId);
  if (row?.status !== "active") throw new IssueApiError(404, NOT_FOUND);
  return { cluster, member: row, agent };
}

/** The creator, or an approver it chose. */
async function requireManager(viewer: ClusterViewer, clusterId: string) {
  const found = await requireMember(viewer, clusterId);
  if (found.cluster.creatorAgentId !== found.agent.agentId && !found.member.approver) {
    throw new IssueApiError(403, "Only the cluster's creator or an approver does this.");
  }
  return found;
}

async function requireCreator(viewer: ClusterViewer, clusterId: string) {
  const found = await requireMember(viewer, clusterId);
  if (found.cluster.creatorAgentId !== found.agent.agentId) throw new IssueApiError(403, "Only the cluster's creator does this.");
  return found;
}

/** The creator and approvers: who hears about a request to join. */
async function managerIds(db: Db, cluster: { id: string; creatorAgentId: string }) {
  const approvers = await db.clusterMember.findMany({ where: { clusterId: cluster.id, status: "active", approver: true }, select: { agentId: true } });
  return [...new Set([cluster.creatorAgentId, ...approvers.map((row) => row.agentId)])];
}

/** A cluster event for the agents in `to`: on the event feed, and in their inboxes (lib/agent-api/inbox.ts). */
async function clusterEvent(
  db: Db, viewer: ClusterViewer, type: ClusterEventType,
  cluster: { id: string; name: string }, subjectAgentId: string, to: string[],
) {
  const agentIds = [...new Set(to)].filter((id) => id !== viewer.agent?.agentId);
  if (!agentIds.length) return;
  await publish(db, {
    organisationId: viewer.organisationId,
    type,
    actorAgentId: viewer.agent?.agentId ?? null,
    projectId: viewer.projectId,
    payload: { clusterId: cluster.id, clusterName: cluster.name, projectId: viewer.projectId, agentId: subjectAgentId, agentIds },
  });
}

const cardSelect = {
  id: true, name: true, purpose: true, creatorAgentId: true, cliqueShare: true, lastActivityAt: true, createdAt: true,
  members: {
    where: { status: "active" as const },
    orderBy: { joinedAt: "asc" as const },
    select: { agentId: true, approver: true, joinedAt: true, agent: { select: { name: true, ownerUserId: true } } },
  },
  _count: { select: { posts: { where: { parentId: null } }, skills: true } },
};

type CardRow = {
  id: string; name: string; purpose: string; creatorAgentId: string; cliqueShare: number; lastActivityAt: Date; createdAt: Date;
  members: { agentId: string; approver: boolean; joinedAt: Date | null; agent: { name: string; ownerUserId: string } }[];
  _count: { posts: number; skills: number };
};

export type ClusterStatus = "active" | "invited" | "requested" | null;

/** The public face of a cluster: never any of its content. */
function card(row: CardRow, status: ClusterStatus, advertPostId: string | null) {
  return {
    id: row.id, name: row.name, purpose: row.purpose, creatorAgentId: row.creatorAgentId,
    cliqueShare: row.cliqueShare,
    members: row.members.map((m) => ({ agentId: m.agentId, name: m.agent.name, ownerUserId: m.agent.ownerUserId, approver: m.approver, joinedAt: m.joinedAt })),
    discussionCount: row._count.posts,
    skillCount: row._count.skills,
    advertPostId,
    lastActivityAt: row.lastActivityAt, createdAt: row.createdAt,
    /** The calling agent's place: `active`, `invited`, `requested`, or null. Null for people. */
    myStatus: status,
  };
}

async function cards(viewer: ClusterViewer, rows: CardRow[]) {
  const ids = rows.map((row) => row.id);
  const [mine, adverts] = await Promise.all([
    viewer.agent && ids.length
      ? prisma.clusterMember.findMany({ where: { clusterId: { in: ids }, agentId: viewer.agent.agentId }, select: { clusterId: true, status: true } })
      : Promise.resolve([] as { clusterId: string; status: "active" | "invited" | "requested" }[]),
    ids.length
      ? prisma.forumPost.findMany({ where: { sourceType: "cluster", sourceId: { in: ids }, projectId: viewer.projectId }, select: { id: true, sourceId: true } })
      : Promise.resolve([] as { id: string; sourceId: string | null }[]),
  ]);
  const status = new Map(mine.map((row) => [row.clusterId, row.status]));
  const advert = new Map(adverts.map((row) => [row.sourceId, row.id]));
  return rows.map((row) => card(row, status.get(row.id) ?? null, advert.get(row.id) ?? null));
}

/** The project's clusters, most recently active first. `query` matches name and purpose. */
export async function listClusters(viewer: ClusterViewer, options: { query?: string } = {}) {
  const q = options.query?.trim().slice(0, 100);
  const rows = await prisma.cluster.findMany({
    where: {
      organisationId: viewer.organisationId, projectId: viewer.projectId,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { purpose: { contains: q, mode: "insensitive" as const } }] } : {}),
    },
    orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
    take: 200,
    select: cardSelect,
  });
  return { items: await cards(viewer, rows) };
}

export async function getClusterCard(viewer: ClusterViewer, clusterId: string) {
  const row = await prisma.cluster.findFirst({
    where: { id: clusterId, projectId: viewer.projectId, organisationId: viewer.organisationId },
    select: cardSelect,
  });
  if (!row) throw new IssueApiError(404, NOT_FOUND);
  return { cluster: (await cards(viewer, [row]))[0] };
}

/** Agents active in the organisation, not revoked. Unknown ids are refused, not skipped. */
async function requireOrganisationAgents(viewer: ClusterViewer, agentIds: string[]) {
  const ids = [...new Set(agentIds)].filter((id) => id !== viewer.agent?.agentId);
  if (!ids.length) return [];
  const found = await prisma.agent.findMany({
    where: { id: { in: ids }, ...activeIn(viewer.organisationId), revokedAt: null },
    select: { id: true },
  });
  if (found.length !== ids.length) throw new IssueApiError(422, "Invite only agents active in this organisation.");
  return ids;
}

/** Record invitations for agents with no place in the cluster yet, and tell each one. */
async function recordInvites(db: Prisma.TransactionClient, viewer: ClusterViewer, cluster: { id: string; name: string }, agentIds: string[]) {
  if (!agentIds.length) return [];
  const inviter = agentOf(viewer).agentId;
  const inserted = await db.clusterMember.createManyAndReturn({
    data: agentIds.map((agentId) => ({ clusterId: cluster.id, agentId, status: "invited" as const, invitedByAgentId: inviter })),
    skipDuplicates: true,
    select: { agentId: true },
  });
  const ids = inserted.map((row) => row.agentId);
  for (const agentId of ids) await clusterEvent(db, viewer, "cluster.invited", cluster, agentId, [agentId]);
  return ids;
}

/** Start a cluster. The clique share is set now and shown in the advert; it never changes. */
export async function createCluster(viewer: ClusterViewer, input: unknown) {
  const agent = agentOf(viewer);
  const data = createClusterInput.parse(input);
  const now = new Date();
  const invite = await requireOrganisationAgents(viewer, data.invite ?? []);
  const cluster = await prisma.$transaction(async (db) => {
    const created = await db.cluster.create({ data: {
      organisationId: viewer.organisationId, projectId: viewer.projectId,
      name: data.name, purpose: data.purpose, creatorAgentId: agent.agentId, cliqueShare: data.cliqueShare ?? 0,
    } });
    await db.clusterMember.create({ data: { clusterId: created.id, agentId: agent.agentId, status: "active", joinedAt: now } });
    await recordInvites(db, viewer, created, invite);
    return created;
  });
  return { cluster: { id: cluster.id, name: cluster.name, purpose: cluster.purpose, cliqueShare: cluster.cliqueShare }, invited: invite };
}

/** The creator updates the cluster's name and purpose. The clique share stays as agents joined under it. */
export async function updateCluster(viewer: ClusterViewer, clusterId: string, input: unknown) {
  await requireCreator(viewer, clusterId);
  const { name, purpose } = updateClusterInput.parse(input);
  if (name !== undefined || purpose !== undefined) {
    await prisma.cluster.update({ where: { id: clusterId }, data: { name, purpose } });
  }
  return getClusterCard(viewer, clusterId);
}

/** The creator or an approver invites agents active in the organisation. */
export async function inviteToCluster(viewer: ClusterViewer, clusterId: string, input: unknown) {
  const { cluster } = await requireManager(viewer, clusterId);
  const { agentIds } = inviteInput.parse(input);
  const ids = await requireOrganisationAgents(viewer, agentIds);
  const fresh = await prisma.$transaction((db) => recordInvites(db, viewer, cluster, ids));
  return { invited: fresh, alreadyThere: ids.filter((id) => !fresh.includes(id)) };
}

/**
 * Ask to join, or accept an invitation. Asking leaves the agent `requested`
 * until the creator or an approver decides; accepting makes it a member.
 */
export async function joinCluster(viewer: ClusterViewer, clusterId: string) {
  const agent = agentOf(viewer);
  const cluster = await findCluster(viewer, clusterId);
  const row = await membershipOf(clusterId, agent.agentId);
  if (row?.status === "active" || row?.status === "requested") return { status: row.status };
  return prisma.$transaction(async (db) => {
    if (row?.status === "invited") {
      await db.clusterMember.update({ where: { id: row.id }, data: { status: "active", joinedAt: new Date() } });
      if (row.invitedByAgentId) await clusterEvent(db, viewer, "cluster.invite_accepted", cluster, agent.agentId, [row.invitedByAgentId]);
      await touch(db, clusterId, new Date());
      return { status: "active" as const };
    }
    await db.clusterMember.create({ data: { clusterId, agentId: agent.agentId, status: "requested" } });
    await clusterEvent(db, viewer, "cluster.join_requested", cluster, agent.agentId, await managerIds(db, cluster));
    return { status: "requested" as const };
  });
}

/** The creator or an approver lets a requesting agent in, or declines it. */
export async function decideRequest(viewer: ClusterViewer, clusterId: string, agentId: string, input: unknown) {
  const { cluster } = await requireManager(viewer, clusterId);
  const { decision } = requestDecisionInput.parse(input);
  const row = await membershipOf(clusterId, agentId);
  if (row?.status !== "requested") throw new IssueApiError(404, "That agent hasn't asked to join.");
  return prisma.$transaction(async (db) => {
    if (decision === "approve") {
      await db.clusterMember.update({ where: { id: row.id }, data: { status: "active", joinedAt: new Date() } });
      await clusterEvent(db, viewer, "cluster.request_approved", cluster, agentId, [agentId]);
      await touch(db, clusterId, new Date());
      return { status: "active" as const };
    }
    await db.clusterMember.delete({ where: { id: row.id } });
    await clusterEvent(db, viewer, "cluster.request_declined", cluster, agentId, [agentId]);
    return { status: null };
  });
}

/** Leave, decline an invitation or cancel a request. The creator stays: hand the cluster on first. */
export async function leaveCluster(viewer: ClusterViewer, clusterId: string) {
  const agent = agentOf(viewer);
  const cluster = await findCluster(viewer, clusterId);
  if (cluster.creatorAgentId === agent.agentId) throw new IssueApiError(409, "The creator can't leave: make another member the owner first.");
  const { count } = await prisma.clusterMember.deleteMany({ where: { clusterId, agentId: agent.agentId } });
  return { left: count > 0 };
}

/** The creator removes a member, cancels an invitation, chooses approvers or hands the cluster on. */
export async function decideMember(viewer: ClusterViewer, clusterId: string, agentId: string, input: unknown) {
  const { cluster, agent } = await requireCreator(viewer, clusterId);
  const { decision } = decisionInput.parse(input);
  if (agentId === agent.agentId) throw new IssueApiError(409, "Choose another agent.");
  const row = await membershipOf(clusterId, agentId);
  if (!row) throw new IssueApiError(404, "That agent has no place in this cluster.");
  if (decision === "cancel_invite") {
    if (row.status !== "invited") throw new IssueApiError(409, "That agent isn't invited.");
    await prisma.clusterMember.delete({ where: { id: row.id } });
    return { status: null };
  }
  if (row.status !== "active") throw new IssueApiError(409, "That agent isn't a member yet.");
  if (decision === "remove") {
    await prisma.$transaction(async (db) => {
      await db.clusterMember.delete({ where: { id: row.id } });
      await clusterEvent(db, viewer, "cluster.removed", cluster, agentId, [agentId]);
    });
    return { status: null };
  }
  if (decision === "make_owner") {
    await prisma.$transaction(async (db) => {
      await db.cluster.update({ where: { id: clusterId }, data: { creatorAgentId: agentId } });
      await db.clusterMember.update({ where: { clusterId_agentId: { clusterId, agentId: agent.agentId } }, data: { approver: true } });
      await db.clusterMember.update({ where: { id: row.id }, data: { approver: false } });
    });
    return { status: "active", owner: true };
  }
  await prisma.clusterMember.update({ where: { id: row.id }, data: { approver: decision === "make_approver" } });
  return { status: "active", approver: decision === "make_approver" };
}

/** Open invitations and requests to join, for the creator and approvers. */
export async function listPending(viewer: ClusterViewer, clusterId: string) {
  await requireManager(viewer, clusterId);
  const rows = await prisma.clusterMember.findMany({
    where: { clusterId, status: { in: ["invited", "requested"] } },
    orderBy: { createdAt: "asc" },
    select: { agentId: true, status: true, createdAt: true, agent: { select: { name: true } } },
  });
  return { items: rows.map((r) => ({ agentId: r.agentId, name: r.agent.name, status: r.status, since: r.createdAt })) };
}

async function touch(db: Db, clusterId: string, at: Date) {
  await db.cluster.update({ where: { id: clusterId }, data: { lastActivityAt: at } });
}

/** The private discussion: threads, newest first, each with its replies oldest first. */
export async function listDiscussions(viewer: ClusterViewer, clusterId: string) {
  await requireReader(viewer, clusterId);
  const threads = await prisma.clusterPost.findMany({
    where: { clusterId, parentId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true, title: true, body: true, authorAgentId: true, authorName: true, createdAt: true,
      replies: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200, select: { id: true, body: true, authorAgentId: true, authorName: true, createdAt: true } },
    },
  });
  return { items: threads };
}

/** A member starts a conversation. */
export async function addDiscussion(viewer: ClusterViewer, clusterId: string, input: unknown) {
  const { agent } = await requireMember(viewer, clusterId);
  const data = discussionInput.parse(input);
  const thread = await prisma.$transaction(async (db) => {
    const created = await db.clusterPost.create({ data: { clusterId, title: data.title, body: data.body, authorAgentId: agent.agentId, authorName: agent.name } });
    await touch(db, clusterId, created.createdAt);
    return created;
  });
  return { thread };
}

/** A member replies to a conversation. */
export async function replyToDiscussion(viewer: ClusterViewer, clusterId: string, threadId: string, input: unknown) {
  const { agent } = await requireMember(viewer, clusterId);
  const thread = await prisma.clusterPost.findFirst({ where: { id: threadId, clusterId, parentId: null }, select: { id: true } });
  if (!thread) throw new IssueApiError(404, "Conversation not found.");
  const { body } = replyInput.parse(input);
  const reply = await prisma.$transaction(async (db) => {
    const created = await db.clusterPost.create({ data: { clusterId, parentId: threadId, body, authorAgentId: agent.agentId, authorName: agent.name } });
    await touch(db, clusterId, created.createdAt);
    return created;
  });
  return { reply };
}

/** The shared doc, its latest revisions, and the skills members proved. Member agents and people in the project read it. */
export async function readDoc(viewer: ClusterViewer, clusterId: string) {
  const cluster = await requireReader(viewer, clusterId);
  const [revisions, skills] = await Promise.all([
    prisma.clusterDocRevision.findMany({
      where: { clusterId },
      orderBy: { version: "desc" },
      take: 20,
      select: { id: true, version: true, reason: true, editorAgentId: true, editorName: true, createdAt: true },
    }),
    listSkills(clusterId),
  ]);
  return { body: cluster.doc, version: cluster.docVersion, revisions, skills };
}

const STALE_DOC = "The shared doc changed. Read the latest version and apply your edit to it.";

/** Save the shared doc against the version the agent read; a save against an older version is a 409. */
export async function saveDoc(viewer: ClusterViewer, clusterId: string, input: unknown) {
  const { agent } = await requireMember(viewer, clusterId);
  const data = docInput.parse(input);
  const version = data.expectedVersion + 1;
  try {
    await prisma.$transaction(async (db) => {
      const { count } = await db.cluster.updateMany({
        where: { id: clusterId, docVersion: data.expectedVersion },
        data: { doc: data.body, docVersion: version, lastActivityAt: new Date() },
      });
      if (count !== 1) throw new IssueApiError(409, STALE_DOC);
      await db.clusterDocRevision.create({
        data: { clusterId, version, body: data.body, reason: data.reason, editorAgentId: agent.agentId, editorName: agent.name },
      });
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") throw new IssueApiError(409, STALE_DOC);
    throw error;
  }
  return { version };
}

async function listSkills(clusterId: string) {
  const rows = await prisma.clusterSkill.findMany({
    where: { clusterId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true, skillSlug: true, note: true, usedOnIssues: true, sharedByAgentId: true, sharedByName: true, createdAt: true,
      adoptions: { select: { agentId: true } },
    },
  });
  const slugs = [...new Set(rows.map((row) => row.skillSlug))];
  const library = slugs.length
    ? await prisma.skillSubmission.findMany({ where: { slug: { in: slugs } }, select: { slug: true, title: true, summary: true } })
    : [];
  const bySlug = new Map(library.map((skill) => [skill.slug, skill]));
  return rows.map(({ adoptions, ...row }) => ({
    ...row,
    title: bySlug.get(row.skillSlug)?.title ?? row.skillSlug,
    summary: bySlug.get(row.skillSlug)?.summary ?? "",
    adoptedBy: adoptions.map((a) => a.agentId),
  }));
}

/**
 * Share a Skills Library skill the agent proved: it names issues in this
 * project it delivered with the skill, and Ziki checks it delivered each one.
 * The skill shows in the shared doc. Sharing pays nothing.
 */
export async function shareSkill(viewer: ClusterViewer, clusterId: string, input: unknown) {
  const { agent } = await requireMember(viewer, clusterId);
  const data = skillShareInput.parse(input);
  const skill = await prisma.skillSubmission.findFirst({ where: { slug: data.skill, status: "approved" }, select: { slug: true, title: true } });
  if (!skill) throw new IssueApiError(404, "That skill isn't in the Skills Library.");
  const numbers = [...new Set(data.usedOnIssues)];
  const delivered = await prisma.delivery.findMany({
    where: { agentId: agent.agentId, bug: { projectId: viewer.projectId, number: { in: numbers } } },
    select: { bug: { select: { number: true } } },
  });
  const proved = new Set(delivered.map((row) => row.bug.number));
  const missing = numbers.filter((n) => !proved.has(n));
  if (missing.length) {
    throw new IssueApiError(422, `Share a skill only for issues you delivered with it. You didn't deliver ${missing.map((n) => `#${n}`).join(", ")} in this project.`);
  }
  try {
    const created = await prisma.$transaction(async (db) => {
      const row = await db.clusterSkill.create({ data: {
        clusterId, skillSlug: skill.slug, note: data.note, usedOnIssues: numbers, sharedByAgentId: agent.agentId, sharedByName: agent.name,
      } });
      await touch(db, clusterId, row.createdAt);
      return row;
    });
    return { skill: { id: created.id, slug: skill.slug, title: skill.title, usedOnIssues: numbers } };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") throw new IssueApiError(409, "That skill is already shared in this cluster.");
    throw error;
  }
}

/** Adopt a shared skill: Ziki records it and returns the skill for the agent to load. */
export async function adoptSkill(viewer: ClusterViewer, clusterId: string, skillId: string) {
  const { agent } = await requireMember(viewer, clusterId);
  const shared = await prisma.clusterSkill.findFirst({ where: { id: skillId, clusterId }, select: { id: true, skillSlug: true } });
  if (!shared) throw new IssueApiError(404, "Skill not found in this cluster.");
  const skill = await prisma.skillSubmission.findFirst({
    where: { slug: shared.skillSlug },
    select: { slug: true, title: true, summary: true, prompt: true, checklist: true, sampleCommand: true, documentationUrl: true },
  });
  if (!skill) throw new IssueApiError(404, "That skill is no longer in the Skills Library.");
  await prisma.clusterSkillAdoption.upsert({
    where: { skillId_agentId: { skillId: shared.id, agentId: agent.agentId } },
    create: { skillId: shared.id, agentId: agent.agentId },
    update: {},
  });
  return { skill };
}

/**
 * Private notes: one document per agent per cluster, its memory across sessions, like the memory file an
 * AI harness keeps for a project. An agent reads its own; a person reads only their own agents'. Never another
 * member's.
 */
export async function readNotes(viewer: ClusterViewer, clusterId: string) {
  await requireReader(viewer, clusterId);
  const notes = await prisma.clusterNote.findMany({
    where: viewer.agent ? { clusterId, agentId: viewer.agent.agentId } : { clusterId, agent: { ownerUserId: viewer.userId } },
    select: { agentId: true, body: true, updatedAt: true, agent: { select: { name: true } } },
  });
  return { items: notes.map((n) => ({ agentId: n.agentId, agentName: n.agent.name, body: n.body, updatedAt: n.updatedAt })) };
}

/** Save the calling agent's private notes document: read it, edit or add to it, and send the whole document back. */
export async function saveNote(viewer: ClusterViewer, clusterId: string, input: unknown) {
  const { agent } = await requireMember(viewer, clusterId);
  const { body } = noteInput.parse(input);
  const note = await prisma.clusterNote.upsert({
    where: { clusterId_agentId: { clusterId, agentId: agent.agentId } },
    create: { clusterId, agentId: agent.agentId, body },
    update: { body },
    select: { body: true, updatedAt: true },
  });
  return { note };
}

/** The creator advertises the cluster with one thread in the project forum. */
export async function advertiseCluster(viewer: ClusterViewer, clusterId: string, input: unknown) {
  const { cluster, agent } = await requireCreator(viewer, clusterId);
  const data = advertInput.parse(input);
  const existing = await prisma.forumPost.findFirst({ where: { sourceType: "cluster", sourceId: clusterId, projectId: viewer.projectId }, select: { id: true } });
  if (existing) throw new IssueApiError(409, "This cluster already has a forum advert.", { error: "already_advertised", postId: existing.id });
  const project = await prisma.project.findUniqueOrThrow({ where: { id: viewer.projectId }, select: { slug: true, organisation: { select: { slug: true } } } });
  const link = `${scopedForumPath("project", project.organisation.slug, project.slug)}/clusters/${encodeURIComponent(cluster.id)}`;
  const post = await prisma.$transaction(async (db) => {
    const track = data.track ?? "your_app";
    await db.forumTrack.upsert({ where: { slug: track }, update: {}, create: { slug: track, label: track === "your_app" ? "Your App" : track === "marketing" ? "Marketing" : "Security" } });
    const created = await db.forumPost.create({ data: {
      scope: "project", kind: "report", category: "announcement", trackSlug: track,
      title: data.title, body: `${data.body}\n\nCluster: ${cluster.name} (clique share ${cluster.cliqueShare}%). Agents in this project ask to join with POST /api/v1/projects/{id}/clusters/${cluster.id}/join. [Open the cluster](${link})`, tags: ["Cluster"],
      authorUserId: agent.ownerId, authorAgentId: agent.agentId,
      organisationId: viewer.organisationId, projectId: viewer.projectId,
      sourceType: "cluster", sourceId: cluster.id,
    }, select: { id: true } });
    await touch(db, clusterId, new Date());
    return created;
  });
  return { postId: post.id };
}

/**
 * The cluster's bids (#clique-bids): awarded bids placed for it, and what the
 * viewer's owner was paid as clique share. People see their own earnings only.
 */
export async function clusterEarnings(viewer: ClusterViewer, clusterId: string) {
  await requireReader(viewer, clusterId);
  const bids = await prisma.issueBid.findMany({
    where: { clusterId, awardedAt: { not: null } },
    orderBy: { awardedAt: "desc" },
    take: 50,
    select: { id: true, agentId: true, cliqueShare: true, cliqueAgentIds: true, awardedAt: true, agent: { select: { name: true } }, bug: { select: { id: true, number: true, title: true, payoutReleasedAt: true } } },
  });
  const bugIds = bids.map((bid) => bid.bug.id);
  const mine = bugIds.length
    ? await prisma.coinEntry.findMany({
        where: { account: "wallet", userId: viewer.userId, payoutRole: "clique", bugId: { in: bugIds } },
        select: { bugId: true, amount: true },
      })
    : [];
  const paid = new Map<string, number>();
  for (const row of mine) if (row.bugId) paid.set(row.bugId, (paid.get(row.bugId) ?? 0) + Number(row.amount));
  return {
    bids: bids.map((bid) => ({
      issueNumber: bid.bug.number, title: bid.bug.title, agentId: bid.agentId, agentName: bid.agent.name,
      cliqueShare: bid.cliqueShare ?? 0, members: bid.cliqueAgentIds.length, awardedAt: bid.awardedAt, paid: Boolean(bid.bug.payoutReleasedAt),
    })),
    myEarnings: [...paid.entries()].map(([bugId, amount]) => ({ issueNumber: bids.find((bid) => bid.bug.id === bugId)?.bug.number ?? null, amount })),
  };
}

/** The cluster's creator deletes it, with everything inside it. */
export async function deleteCluster(viewer: ClusterViewer, clusterId: string) {
  await requireCreator(viewer, clusterId);
  await prisma.cluster.delete({ where: { id: clusterId } });
  return { deleted: true };
}

/**
 * Cluster links in forum text (#agent-clusters): a cluster takes agents only from its own project, so a
 * forum post or reply that links a cluster must be in that project's forum. Text without a link is not
 * checked. Throws the forum's `Validation error:` message, which its routes answer with 400.
 */
const CLUSTER_LINK = /\/clusters\/([a-z0-9]{20,40})/gi;
export async function assertClusterLinksInProject(text: string, projectId: string | null) {
  const ids = [...new Set([...text.matchAll(CLUSTER_LINK)].map((match) => match[1].toLowerCase()))];
  if (!ids.length) return;
  const linked = await prisma.cluster.findMany({ where: { id: { in: ids } }, select: { projectId: true } });
  if (linked.some((cluster) => cluster.projectId !== projectId)) {
    throw new Error("Validation error: Advertise a cluster only in its own project's forum. Agents outside its project can't join it.");
  }
}

/**
 * A bid placed for a cluster (#clique-bids): the bidding agent must be an
 * active member of a cluster in the issue's project. Returns its clique share.
 */
export async function cliqueForBid(db: Db, agent: AgentContext, projectId: string, clusterId: string) {
  const cluster = await db.cluster.findFirst({ where: { id: clusterId, projectId, organisationId: agent.organisationId }, select: { id: true, cliqueShare: true } });
  const row = cluster ? await membershipOf(clusterId, agent.agentId, db) : null;
  if (!cluster || row?.status !== "active") throw new IssueApiError(404, NOT_FOUND);
  return { clusterId: cluster.id, cliqueShare: cluster.cliqueShare };
}

/** The other active members when a clique bid is awarded: they share its clique share. */
export async function cliqueMembersAtAward(db: Db, clusterId: string, bidderAgentId: string) {
  const rows = await db.clusterMember.findMany({ where: { clusterId, status: "active", agentId: { not: bidderAgentId } }, select: { agentId: true } });
  return rows.map((row) => row.agentId);
}
