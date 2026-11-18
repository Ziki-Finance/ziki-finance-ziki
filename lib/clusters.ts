import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IssueApiError } from "@/lib/agent-api/errors";
import type { AgentContext } from "@/lib/agents/require-agent";
import { projectPath, refOf } from "@/lib/project-paths";
import { activeIn } from "@/lib/agents/active-in";

/**
 * Persistent project groups with member-only discussions and shared documents.
 * Agents choose groups by purpose and invite collaborators. Each member's
 * private notes are visible only to that agent and its owner.
 */
export type ClusterViewer = {
  organisationId: string;
  projectId: string;
  /** The person: the agent's owner, or the signed-in member. */
  userId: string;
  /** Set when an agent key is calling. */
  agent?: AgentContext;
};

const MAX_INVITES = 20;
const NOT_FOUND = "Cluster not found.";
// Accept the old skills field for clients upgrading from the previous API.
// It is ignored, including on clusters that already stored skill requirements.
const legacySkills = z.unknown().optional();
export const createClusterInput = z.object({
  name: z.string().trim().min(3).max(80),
  purpose: z.string().trim().min(10).max(500),
  neededSkills: legacySkills,
  invite: z.array(z.string().trim().min(1).max(64)).max(MAX_INVITES).optional(),
}).strict();
export const updateClusterInput = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  purpose: z.string().trim().min(10).max(500).optional(),
  neededSkills: legacySkills,
}).strict();
export const inviteInput = z.object({ agentIds: z.array(z.string().trim().min(1).max(64)).min(1).max(MAX_INVITES) }).strict();
export const decisionInput = z.object({ decision: z.enum(["remove", "cancel_invite"]) }).strict();
const blockerText = z.string().trim().min(3).max(1000);
export const taskInput = z.object({
  title: z.string().trim().min(3).max(200),
  tryingToAchieve: z.string().trim().min(3).max(10_000),
  blockers: z.array(blockerText).max(20).optional(),
  issueNumber: z.number().int().positive().optional(),
}).strict();
export const shareInput = z.object({
  body: z.string().trim().min(1).max(10_000),
  blockerId: z.string().trim().min(1).max(64).optional(),
}).strict();
export const blockerInput = z.object({ text: blockerText }).strict();
export const solveInput = z.object({ solved: z.boolean() }).strict();
export const noteInput = z.object({ body: z.string().max(20_000) }).strict();

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
  if (!viewer.agent) throw new IssueApiError(403, "Only agents work inside clusters: use an agent key.");
  return viewer.agent;
}

/** The viewer's agents that are active members of the cluster: the calling agent, or all of a person's agents. */
function memberWhere(viewer: ClusterViewer, clusterId: string) {
  return viewer.agent
    ? { clusterId, status: "active" as const, agentId: viewer.agent.agentId }
    : { clusterId, status: "active" as const, agent: { ownerUserId: viewer.userId } };
}

async function findCluster(viewer: ClusterViewer, clusterId: string) {
  const cluster = await prisma.cluster.findFirst({
    where: { id: clusterId, projectId: viewer.projectId, organisationId: viewer.organisationId },
  });
  if (!cluster) throw new IssueApiError(404, NOT_FOUND);
  return cluster;
}

/** The cluster, if the viewer may see inside it. Anyone else gets the same 404 as a missing cluster. */
export async function requireMember(viewer: ClusterViewer, clusterId: string) {
  const cluster = await findCluster(viewer, clusterId);
  const member = await prisma.clusterMember.findFirst({ where: memberWhere(viewer, clusterId), select: { agentId: true } });
  if (!member) throw new IssueApiError(404, NOT_FOUND);
  return cluster;
}

const cardSelect = {
  id: true, name: true, purpose: true, creatorAgentId: true, lastActivityAt: true, createdAt: true,
  members: {
    where: { status: "active" as const },
    orderBy: { joinedAt: "asc" as const },
    select: { agentId: true, joinedAt: true, agent: { select: { name: true, ownerUserId: true } } },
  },
  _count: { select: { posts: { where: { parentId: null } }, blockers: { where: { solvedAt: null } } } },
  project: { select: { name: true, slug: true, organisation: { select: { slug: true } } } },
  posts: { where: { parentId: null }, orderBy: { createdAt: "desc" as const }, take: 1, select: { title: true, authorName: true } },
};

type CardRow = {
  id: string; name: string; purpose: string; creatorAgentId: string; lastActivityAt: Date; createdAt: Date;
  members: { agentId: string; joinedAt: Date | null; agent: { name: string; ownerUserId: string } }[];
  _count: { posts: number; blockers: number };
  project: { name: string; slug: string; organisation: { slug: string } };
  posts: { title: string | null; authorName: string }[];
};

/** The public face of a cluster: never any of its content. */
function card(row: CardRow, viewer: ClusterViewer, invited: Set<string>) {
  const isMember = row.members.some((m) => (viewer.agent ? m.agentId === viewer.agent.agentId : m.agent.ownerUserId === viewer.userId));
  return {
    id: row.id, name: row.name, purpose: row.purpose, creatorAgentId: row.creatorAgentId,
    project: { name: row.project.name, path: `/${encodeURIComponent(row.project.organisation.slug)}/${encodeURIComponent(row.project.slug)}` },
    lastTask: isMember && row.posts[0] ? { title: row.posts[0].title ?? "", authorName: row.posts[0].authorName } : null,
    members: row.members.map((m) => ({ agentId: m.agentId, name: m.agent.name, joinedAt: m.joinedAt })),
    taskCount: row._count.posts,
    openBlockers: row._count.blockers,
    archived: false,
    lastActivityAt: row.lastActivityAt, createdAt: row.createdAt,
    /** `active` (member), `invited`, or null. */
    myStatus: isMember ? "active" : invited.has(row.id) ? "invited" : null,
  };
}

async function myInvites(viewer: ClusterViewer, clusterIds: string[]) {
  if (!clusterIds.length) return new Set<string>();
  const rows = await prisma.clusterMember.findMany({
    where: {
      clusterId: { in: clusterIds }, status: "invited",
      ...(viewer.agent ? { agentId: viewer.agent.agentId } : { agent: { ownerUserId: viewer.userId } }),
    },
    select: { clusterId: true },
  });
  return new Set(rows.map((r) => r.clusterId));
}

async function cards(viewer: ClusterViewer, rows: CardRow[]) {
  const invited = await myInvites(viewer, rows.map((row) => row.id));
  return rows.map((row) => card(row, viewer, invited));
}

/** Project groups remain discoverable across tasks and inactivity. */
export async function listClusters(viewer: ClusterViewer, options: { includeArchived?: boolean; wholeOrganisation?: boolean; query?: string } = {}) {
  const q = options.query?.trim().slice(0, 100);
  const rows = await prisma.cluster.findMany({
    where: {
      organisationId: viewer.organisationId,
      ...(options.wholeOrganisation ? { project: { archivedAt: null } } : { projectId: viewer.projectId }),
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

/** Persist the invitation and its owner's inbox item together, once per new membership. */
async function recordInvites(db: Prisma.TransactionClient, viewer: ClusterViewer, cluster: { id: string; name: string }, agentIds: string[]) {
  if (!agentIds.length) return [];
  const inserted = await db.clusterMember.createManyAndReturn({
    data: agentIds.map(agentId => ({ clusterId: cluster.id, agentId, status: "invited" as const, invitedByAgentId: agentOf(viewer).agentId })),
    skipDuplicates: true,
    select: { agentId: true },
  });
  const ids = inserted.map(row => row.agentId);
  if (!ids.length) return ids;
  const project = await db.project.findUniqueOrThrow({
    where: { id: viewer.projectId }, select: { slug: true, organisation: { select: { slug: true } } },
  });
  const recipients = await db.agent.findMany({
    where: { id: { in: ids } }, select: { id: true, name: true, ownerUserId: true },
  });
  await db.notification.createMany({ data: recipients.map(agent => ({
    userId: agent.ownerUserId, organisationId: viewer.organisationId, kind: "cluster_invitation",
    title: `Your agent ${agent.name} was invited to ${cluster.name}`,
    url: projectPath(refOf(project), `/clusters/${encodeURIComponent(cluster.id)}?info=1#cluster-invitations`),
  })) });
  return ids;
}

/** Start a persistent group and invite collaborators. */
export async function createCluster(viewer: ClusterViewer, input: unknown) {
  const agent = agentOf(viewer);
  const data = createClusterInput.parse(input);
  const now = new Date();
  const invite = await requireOrganisationAgents(viewer, data.invite ?? []);
  const cluster = await prisma.$transaction(async (db) => {
    const created = await db.cluster.create({ data: {
      organisationId: viewer.organisationId, projectId: viewer.projectId,
      name: data.name, purpose: data.purpose, creatorAgentId: agent.agentId,
    } });
    await db.clusterMember.create({ data: { clusterId: created.id, agentId: agent.agentId, status: "active", joinedAt: now } });
    await recordInvites(db, viewer, created, invite);
    return created;
  });
  return { cluster: { id: cluster.id, name: cluster.name, purpose: cluster.purpose }, invited: invite };
}

/** The creator updates the group's name and purpose. */
export async function updateCluster(viewer: ClusterViewer, clusterId: string, input: unknown) {
  const agent = agentOf(viewer);
  const cluster = await requireMember(viewer, clusterId);
  if (cluster.creatorAgentId !== agent.agentId) throw new IssueApiError(403, "Only the cluster's creator changes its name or purpose.");
  const { name, purpose } = updateClusterInput.parse(input);
  if (name !== undefined || purpose !== undefined) {
    await prisma.cluster.update({ where: { id: clusterId }, data: { name, purpose } });
  }
  return getClusterCard(viewer, clusterId);
}

/** Members invite other active agents in their organisation. */
export async function inviteToCluster(viewer: ClusterViewer, clusterId: string, input: unknown) {
  const agent = agentOf(viewer);
  const cluster = await requireMember(viewer, clusterId);
  const { agentIds } = inviteInput.parse(input);
  const ids = await requireOrganisationAgents(viewer, agentIds);
  const fresh = await prisma.$transaction(db => recordInvites(db, viewer, cluster, ids));
  const known = new Set(ids.filter(id => !fresh.includes(id)));
  return { invited: fresh, alreadyThere: ids.filter((id) => known.has(id)) };
}

/** Active organisation agents outside the group, ordered by name. */
export async function suggestInvites(viewer: ClusterViewer, clusterId: string) {
  await requireMember(viewer, clusterId);
  const taken = await prisma.clusterMember.findMany({ where: { clusterId }, select: { agentId: true } });
  const items = await prisma.agent.findMany({
    where: { ...activeIn(viewer.organisationId), revokedAt: null, id: { notIn: taken.map((row) => row.agentId) } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 20,
    select: { id: true, name: true },
  });
  return { items: items.map((agent) => ({ agentId: agent.id, name: agent.name })) };
}

/** Join a discoverable project group or accept an invitation. Rejoining is idempotent. */
export async function joinCluster(viewer: ClusterViewer, clusterId: string) {
  const agent = agentOf(viewer);
  await findCluster(viewer, clusterId);
  const row = await prisma.clusterMember.findUnique({ where: { clusterId_agentId: { clusterId, agentId: agent.agentId } } });
  if (row?.status === "active") return { status: "active" };
  const joinedAt = new Date();
  if (row) await prisma.clusterMember.update({ where: { id: row.id }, data: { status: "active", joinedAt } });
  else await prisma.clusterMember.create({ data: { clusterId, agentId: agent.agentId, status: "active", joinedAt } });
  return { status: "active" };
}

/** Leave, or decline an invite. The creator stays: a cluster always has its creator. */
export async function leaveCluster(viewer: ClusterViewer, clusterId: string) {
  const agent = agentOf(viewer);
  const cluster = await findCluster(viewer, clusterId);
  if (cluster.creatorAgentId === agent.agentId) throw new IssueApiError(409, "The creator can't leave the cluster.");
  const { count } = await prisma.clusterMember.deleteMany({ where: { clusterId, agentId: agent.agentId } });
  return { left: count > 0 };
}

/** The creator removes a member or cancels an invite. */
export async function decideMember(viewer: ClusterViewer, clusterId: string, agentId: string, input: unknown) {
  const agent = agentOf(viewer);
  const cluster = await requireMember(viewer, clusterId);
  if (cluster.creatorAgentId !== agent.agentId) throw new IssueApiError(403, "Only the cluster's creator decides on members.");
  const { decision } = decisionInput.parse(input);
  if (agentId === cluster.creatorAgentId) throw new IssueApiError(409, "The creator can't be removed.");
  const row = await prisma.clusterMember.findUnique({ where: { clusterId_agentId: { clusterId, agentId } } });
  if (!row) throw new IssueApiError(404, "That agent has no place in this cluster.");
  if (decision === "remove" && row.status !== "active") throw new IssueApiError(409, "That agent isn't a member yet: cancel the invite instead.");
  if (decision === "cancel_invite" && row.status !== "invited") throw new IssueApiError(409, "That agent is a member: remove it instead.");
  await prisma.clusterMember.delete({ where: { id: row.id } });
  return { status: null };
}

/** Compatibility for older clients: groups no longer expire through inactivity. */
export async function reopenCluster(viewer: ClusterViewer, clusterId: string) {
  agentOf(viewer);
  await requireMember(viewer, clusterId);
  return { archived: false };
}

/**
 * Tasks, newest first. Each carries what it is trying to achieve (`body`), its
 * blockers (open first) and the information members shared on it, oldest first,
 * each saying which blocker it answers. `issueNumber` picks one issue's tasks.
 */
export async function listTasks(viewer: ClusterViewer, clusterId: string, options: { issueNumber?: number } = {}) {
  await requireMember(viewer, clusterId);
  const tasks = await prisma.clusterPost.findMany({
    where: { clusterId, parentId: null, ...(options.issueNumber ? { issueNumber: options.issueNumber } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    include: {
      blockers: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      replies: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200 },
    },
  });
  return {
    items: tasks.map(({ replies, blockers, ...task }) => ({
      ...task,
      blockers: [...blockers].sort((a, b) => Number(a.solvedAt !== null) - Number(b.solvedAt !== null)),
      openBlockers: blockers.filter((blocker) => blocker.solvedAt === null).length,
      shared: replies,
    })),
  };
}

async function touch(db: Prisma.TransactionClient, clusterId: string, at: Date) {
  await db.cluster.update({ where: { id: clusterId }, data: { lastActivityAt: at } });
}

/** Post a task: what it is trying to achieve, and what blocks it. */
export async function addTask(viewer: ClusterViewer, clusterId: string, input: unknown) {
  const agent = agentOf(viewer);
  await requireMember(viewer, clusterId);
  const data = taskInput.parse(input);
  if (data.issueNumber) {
    const issue = await prisma.bug.findFirst({ where: { projectId: viewer.projectId, number: data.issueNumber, deletedAt: null }, select: { id: true } });
    if (!issue) throw new IssueApiError(404, `Issue #${data.issueNumber} not found in this project.`);
  }
  const task = await prisma.$transaction(async (db) => {
    const created = await db.clusterPost.create({ data: {
      clusterId, title: data.title, body: data.tryingToAchieve, issueNumber: data.issueNumber ?? null,
      authorAgentId: agent.agentId, authorName: agent.name,
    } });
    if (data.blockers?.length) {
      await db.clusterBlocker.createMany({ data: data.blockers.map((text) => ({ clusterId, taskId: created.id, text, raisedByAgentId: agent.agentId })) });
    }
    await touch(db, clusterId, created.createdAt);
    return created;
  });
  return { task };
}

async function findTask(clusterId: string, taskId: string) {
  const task = await prisma.clusterPost.findFirst({ where: { id: taskId, clusterId, parentId: null }, select: { id: true, authorAgentId: true } });
  if (!task) throw new IssueApiError(404, "Task not found.");
  return task;
}

/** Share information on a task, optionally answering one of its blockers. */
export async function shareInformation(viewer: ClusterViewer, clusterId: string, taskId: string, input: unknown) {
  const agent = agentOf(viewer);
  await requireMember(viewer, clusterId);
  await findTask(clusterId, taskId);
  const data = shareInput.parse(input);
  if (data.blockerId) {
    const blocker = await prisma.clusterBlocker.findFirst({ where: { id: data.blockerId, taskId }, select: { id: true } });
    if (!blocker) throw new IssueApiError(404, "That blocker isn't on this task.");
  }
  const shared = await prisma.$transaction(async (db) => {
    const created = await db.clusterPost.create({ data: {
      clusterId, parentId: taskId, body: data.body, blockerId: data.blockerId ?? null,
      authorAgentId: agent.agentId, authorName: agent.name,
    } });
    await touch(db, clusterId, created.createdAt);
    return created;
  });
  return { shared };
}

/** Add a blocker to a task. Any member may raise one. */
export async function addBlocker(viewer: ClusterViewer, clusterId: string, taskId: string, input: unknown) {
  const agent = agentOf(viewer);
  await requireMember(viewer, clusterId);
  await findTask(clusterId, taskId);
  const { text } = blockerInput.parse(input);
  const blocker = await prisma.$transaction(async (db) => {
    const created = await db.clusterBlocker.create({ data: { clusterId, taskId, text, raisedByAgentId: agent.agentId } });
    await touch(db, clusterId, created.createdAt);
    return created;
  });
  return { blocker };
}

/** The task's author marks a blocker solved (or open again) once it has what it needs. */
export async function setBlockerSolved(viewer: ClusterViewer, clusterId: string, blockerId: string, input: unknown) {
  const agent = agentOf(viewer);
  await requireMember(viewer, clusterId);
  const { solved } = solveInput.parse(input);
  const blocker = await prisma.clusterBlocker.findFirst({ where: { id: blockerId, clusterId }, select: { id: true, task: { select: { authorAgentId: true } } } });
  if (!blocker) throw new IssueApiError(404, "Blocker not found.");
  if (blocker.task.authorAgentId !== agent.agentId) throw new IssueApiError(403, "Only the agent that posted the task marks its blockers solved.");
  const now = new Date();
  const updated = await prisma.$transaction(async (db) => {
    const row = await db.clusterBlocker.update({
      where: { id: blockerId },
      data: solved ? { solvedAt: now, solvedByAgentId: agent.agentId } : { solvedAt: null, solvedByAgentId: null },
    });
    await touch(db, clusterId, now);
    return row;
  });
  return { blocker: updated };
}

export const docInput = z.object({
  body: z.string().max(100_000),
  expectedVersion: z.number().int().min(0).max(2_147_483_646),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

/** The shared doc every member reads and edits, with its latest revisions. Members only. */
export async function readDoc(viewer: ClusterViewer, clusterId: string) {
  const cluster = await requireMember(viewer, clusterId);
  const revisions = await prisma.clusterDocRevision.findMany({
    where: { clusterId },
    orderBy: { version: "desc" },
    take: 20,
    select: { id: true, version: true, reason: true, editorAgentId: true, editorName: true, createdAt: true },
  });
  return { body: cluster.doc, version: cluster.docVersion, revisions };
}

const STALE_DOC = "The shared doc changed. Read the latest version and apply your edit to it.";

/** Save the shared doc against the version the agent read; a save against an older version is a 409. */
export async function saveDoc(viewer: ClusterViewer, clusterId: string, input: unknown) {
  const agent = agentOf(viewer);
  await requireMember(viewer, clusterId);
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
        data: { clusterId, version, body: data.body, reason: data.reason ?? null, editorAgentId: agent.agentId, editorName: agent.name },
      });
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") throw new IssueApiError(409, STALE_DOC);
    throw error;
  }
  return { version };
}

/** Private notes: an agent reads its own; a person reads their own agents'. Never another member's. */
export async function readNotes(viewer: ClusterViewer, clusterId: string) {
  await requireMember(viewer, clusterId);
  const notes = await prisma.clusterNote.findMany({
    where: viewer.agent ? { clusterId, agentId: viewer.agent.agentId } : { clusterId, agent: { ownerUserId: viewer.userId } },
    select: { agentId: true, body: true, updatedAt: true, agent: { select: { name: true } } },
  });
  return { items: notes.map((n) => ({ agentId: n.agentId, agentName: n.agent.name, body: n.body, updatedAt: n.updatedAt })) };
}

export async function saveNote(viewer: ClusterViewer, clusterId: string, input: unknown) {
  const agent = agentOf(viewer);
  await requireMember(viewer, clusterId);
  const { body } = noteInput.parse(input);
  const note = await prisma.clusterNote.upsert({
    where: { clusterId_agentId: { clusterId, agentId: agent.agentId } },
    create: { clusterId, agentId: agent.agentId, body },
    update: { body },
    select: { body: true, updatedAt: true },
  });
  return { note };
}

/** Open invites, for members. The creator cancels one on the members route. */
export async function listPending(viewer: ClusterViewer, clusterId: string) {
  await requireMember(viewer, clusterId);
  const rows = await prisma.clusterMember.findMany({
    where: { clusterId, status: "invited" },
    orderBy: { createdAt: "asc" },
    select: { agentId: true, status: true, createdAt: true, agent: { select: { name: true } } },
  });
  return { items: rows.map((r) => ({ agentId: r.agentId, name: r.agent.name, status: r.status, since: r.createdAt })) };
}


/** The cluster's creator deletes it, with everything inside it. */
export async function deleteCluster(viewer: ClusterViewer, clusterId: string) {
  const agent = agentOf(viewer);
  const cluster = await requireMember(viewer, clusterId);
  if (cluster.creatorAgentId !== agent.agentId) throw new IssueApiError(403, "Only the cluster's creator deletes it.");
  await prisma.cluster.delete({ where: { id: clusterId } });
  return { deleted: true };
}

/** A person's agents available to act in clusters from the app. */
export async function ownAgentsIn(userId: string, organisationId: string) {
  const agents = await prisma.agent.findMany({
    where: { ownerUserId: userId, ...activeIn(organisationId), revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  return agents;
}

/**
 * The context a person's agent acts with when its owner works a cluster from the
 * app: the same rules as its key, since every rule here reads the agent.
 */
export async function ownerActingAgent(userId: string, organisationId: string, agentId: string): Promise<AgentContext> {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, ownerUserId: userId, ...activeIn(organisationId), revokedAt: null },
    select: { id: true, name: true },
  });
  if (!agent) throw new IssueApiError(403, "Choose one of your own agents in this organisation.");
  return { agentId: agent.id, name: agent.name, ownerId: userId, organisationId, level: "working", keyId: "app", burst: false };
}
