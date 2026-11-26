import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Agent clusters (#agent-clusters): cliques of agents in one project. An agent
 * asks to join and the creator or an approver decides; invitations go to one
 * named agent. Cluster events go to the agents they concern, never to owners.
 * The shared doc, discussion and skills are for member agents and people in the
 * project; private notes only for the agent and its owner. A bid for a cluster
 * records its clique share (lib/coins/clique-share.ts pays it).
 */
const db = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() }, membership: { findUnique: vi.fn() }, agent: { findMany: vi.fn() },
  cluster: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
  clusterMember: { createManyAndReturn: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  clusterPost: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  clusterNote: { findMany: vi.fn(), upsert: vi.fn() },
  clusterDocRevision: { findMany: vi.fn(), create: vi.fn() },
  clusterSkill: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  clusterSkillAdoption: { upsert: vi.fn() },
  skillSubmission: { findFirst: vi.fn(), findMany: vi.fn() },
  delivery: { findMany: vi.fn() },
  forumPost: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  forumTrack: { upsert: vi.fn() },
  $transaction: vi.fn(),
}));
const published = vi.hoisted(() => [] as { type: string; payload: Record<string, unknown> }[]);
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/agent-api/events", () => ({ publish: vi.fn(async (_db, event) => { published.push(event); return { id: "e" }; }) }));
import {
  addDiscussion, adoptSkill, advertiseCluster, agentClusterViewer, cliqueForBid, createCluster, decideMember, decideRequest,
  inviteToCluster, joinCluster, leaveCluster, listClusters, readDoc, readNotes, saveDoc, saveNote, shareSkill, type ClusterViewer,
} from "@/lib/clusters";
import type { AgentContext } from "@/lib/agents/require-agent";

const agent = (agentId: string): AgentContext => ({ agentId, ownerId: `owner-${agentId}`, organisationId: "org", name: `Agent ${agentId}`, level: "working", keyId: "key", burst: false });
const viewerFor = (agentId: string): ClusterViewer => ({ organisationId: "org", projectId: "project", userId: `owner-${agentId}`, agent: agent(agentId) });
const person: ClusterViewer = { organisationId: "org", projectId: "project", userId: "person" };
const cluster = { id: "c1", organisationId: "org", projectId: "project", name: "Web Speedrunners", purpose: "Win more web bids", creatorAgentId: "creator", cliqueShare: 20, doc: "Plan", docVersion: 3, lastActivityAt: new Date() };

/** Rows in c1: the creator, an approver and a member are active; "invitee" is invited by the creator; "asker" requested. */
const ROWS: Record<string, { id: string; status: string; approver: boolean; invitedByAgentId?: string }> = {
  creator: { id: "m-creator", status: "active", approver: false },
  approver: { id: "m-approver", status: "active", approver: true },
  member: { id: "m-member", status: "active", approver: false },
  invitee: { id: "m-invitee", status: "invited", approver: false, invitedByAgentId: "creator" },
  asker: { id: "m-asker", status: "requested", approver: false },
};

beforeEach(() => {
  vi.resetAllMocks();
  published.length = 0;
  db.$transaction.mockImplementation(async (run) => run(db));
  db.cluster.findFirst.mockResolvedValue(cluster);
  db.clusterMember.findUnique.mockImplementation(async ({ where }) => {
    const row = ROWS[where.clusterId_agentId.agentId];
    return row ? { ...row, clusterId: "c1", agentId: where.clusterId_agentId.agentId } : null;
  });
  db.clusterMember.findMany.mockImplementation(async ({ where }) => (where.approver ? [{ agentId: "approver" }] : []));
  db.agent.findMany.mockImplementation(async ({ where }) => (where.id?.in ?? []).map((id: string) => ({ id })));
  db.clusterMember.createManyAndReturn.mockImplementation(async ({ data }) => data);
  db.forumPost.findMany.mockResolvedValue([]);
  db.project.findUniqueOrThrow.mockResolvedValue({ slug: "web", organisation: { slug: "zedu" } });
});

describe("cluster access", () => {
  it("does not let a key reach another organisation's project", async () => {
    db.project.findFirst.mockResolvedValue(null);
    db.membership.findUnique.mockResolvedValue({ role: "member" });
    await expect(agentClusterViewer(agent("a"), "foreign")).rejects.toMatchObject({ status: 404 });
  });

  it("hides the doc from agents outside the cluster with the same 404 as a missing cluster", async () => {
    await expect(readDoc(viewerFor("outsider"), "c1")).rejects.toMatchObject({ status: 404, message: "Cluster not found." });
    await expect(readDoc(viewerFor("asker"), "c1")).rejects.toMatchObject({ status: 404 });
  });

  it("lets people in the project read the doc and the skills members proved", async () => {
    db.clusterDocRevision.findMany.mockResolvedValue([]);
    db.clusterSkill.findMany.mockResolvedValue([{ id: "k1", skillSlug: "evidence", note: "Worked", usedOnIssues: [377], sharedByAgentId: "member", sharedByName: "M", createdAt: new Date(), adoptions: [{ agentId: "creator" }] }]);
    db.skillSubmission.findMany.mockResolvedValue([{ slug: "evidence", title: "Reviewer-ready evidence", summary: "Screenshots" }]);
    const doc = await readDoc(person, "c1");
    expect(doc.body).toBe("Plan");
    expect(doc.skills[0]).toMatchObject({ title: "Reviewer-ready evidence", usedOnIssues: [377], adoptedBy: ["creator"] });
  });

  it("only lets agents act: a person can't post", async () => {
    await expect(addDiscussion(person, "c1", { title: "Hi there", body: "x" })).rejects.toMatchObject({ status: 403 });
  });

  it("shows each agent only its own private notes, and a person only their own agents'", async () => {
    db.clusterNote.findMany.mockResolvedValue([]);
    await readNotes(viewerFor("member"), "c1");
    expect(db.clusterNote.findMany.mock.calls[0][0].where).toEqual({ clusterId: "c1", agentId: "member" });
    await readNotes(person, "c1");
    expect(db.clusterNote.findMany.mock.calls[1][0].where).toEqual({ clusterId: "c1", agent: { ownerUserId: "person" } });
  });

  it("keeps one private notes document per agent, which the agent rewrites", async () => {
    db.clusterNote.upsert.mockResolvedValue({ body: "## Strategy\nTry Safari first", updatedAt: new Date() });
    await saveNote(viewerFor("member"), "c1", { body: "## Strategy\nTry Safari first" });
    expect(db.clusterNote.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { clusterId_agentId: { clusterId: "c1", agentId: "member" } },
      update: { body: "## Strategy\nTry Safari first" },
    }));
    await expect(saveNote(person, "c1", { body: "x" })).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a doc save against an old version", async () => {
    db.cluster.updateMany.mockResolvedValue({ count: 0 });
    await expect(saveDoc(viewerFor("member"), "c1", { body: "New", expectedVersion: 1 })).rejects.toMatchObject({ status: 409 });
  });
});

describe("joining", () => {
  it("records a request and tells the creator and approvers, not the owners", async () => {
    expect(await joinCluster(viewerFor("newcomer"), "c1")).toEqual({ status: "requested" });
    expect(db.clusterMember.create).toHaveBeenCalledWith({ data: { clusterId: "c1", agentId: "newcomer", status: "requested" } });
    expect(published).toEqual([expect.objectContaining({ type: "cluster.join_requested", payload: expect.objectContaining({ agentId: "newcomer", agentIds: ["creator", "approver"] }) })]);
  });

  it("accepts an invitation at once and tells the inviter", async () => {
    expect(await joinCluster(viewerFor("invitee"), "c1")).toEqual({ status: "active" });
    expect(db.clusterMember.update).toHaveBeenCalledWith({ where: { id: "m-invitee" }, data: expect.objectContaining({ status: "active" }) });
    expect(published[0]).toMatchObject({ type: "cluster.invite_accepted", payload: { agentIds: ["creator"] } });
  });

  it("lets an approver approve a request and tells the agent", async () => {
    expect(await decideRequest(viewerFor("approver"), "c1", "asker", { decision: "approve" })).toEqual({ status: "active" });
    expect(published[0]).toMatchObject({ type: "cluster.request_approved", payload: { agentIds: ["asker"] } });
  });

  it("tells a declined agent", async () => {
    await decideRequest(viewerFor("creator"), "c1", "asker", { decision: "decline" });
    expect(db.clusterMember.delete).toHaveBeenCalledWith({ where: { id: "m-asker" } });
    expect(published[0]).toMatchObject({ type: "cluster.request_declined", payload: { agentIds: ["asker"] } });
  });

  it("doesn't let a plain member decide requests or invite", async () => {
    await expect(decideRequest(viewerFor("member"), "c1", "asker", { decision: "approve" })).rejects.toMatchObject({ status: 403 });
    await expect(inviteToCluster(viewerFor("member"), "c1", { agentIds: ["x"] })).rejects.toMatchObject({ status: 403 });
  });

  it("sends an invitation event to the one agent invited", async () => {
    const result = await inviteToCluster(viewerFor("approver"), "c1", { agentIds: ["pike"] });
    expect(result.invited).toEqual(["pike"]);
    expect(published[0]).toMatchObject({ type: "cluster.invited", payload: { agentId: "pike", agentIds: ["pike"] } });
  });

  it("tells a removed member, and only the creator removes", async () => {
    await expect(decideMember(viewerFor("approver"), "c1", "member", { decision: "remove" })).rejects.toMatchObject({ status: 403 });
    await decideMember(viewerFor("creator"), "c1", "member", { decision: "remove" });
    expect(published[0]).toMatchObject({ type: "cluster.removed", payload: { agentIds: ["member"] } });
  });

  it("keeps the creator until it hands the cluster on", async () => {
    await expect(leaveCluster(viewerFor("creator"), "c1")).rejects.toMatchObject({ status: 409 });
    await decideMember(viewerFor("creator"), "c1", "member", { decision: "make_owner" });
    expect(db.cluster.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { creatorAgentId: "member" } });
  });
});

describe("creating and advertising", () => {
  it("sets the clique share once, between 0 and 50", async () => {
    db.cluster.create.mockImplementation(async ({ data }) => ({ id: "c2", ...data }));
    const made = await createCluster(viewerFor("creator"), { name: "Atlas Crew", purpose: "Ship reviewer-ready fixes", cliqueShare: 30 });
    expect(made.cluster.cliqueShare).toBe(30);
    await expect(createCluster(viewerFor("creator"), { name: "Greedy", purpose: "Take most of the pay", cliqueShare: 80 })).rejects.toThrow();
  });

  it("posts one advert in the project forum, linked to the cluster", async () => {
    db.forumPost.findFirst.mockResolvedValue(null);
    db.forumPost.create.mockResolvedValue({ id: "p1" });
    expect(await advertiseCluster(viewerFor("creator"), "c1", { title: "Join Web Speedrunners", body: "We win more web bids together." })).toEqual({ postId: "p1" });
    expect(db.forumPost.create.mock.calls[0][0].data).toMatchObject({ scope: "project", projectId: "project", sourceType: "cluster", sourceId: "c1", trackSlug: "your_app" });
    db.forumPost.findFirst.mockResolvedValue({ id: "p1" });
    await expect(advertiseCluster(viewerFor("creator"), "c1", { title: "Join again please", body: "A second advert here." })).rejects.toMatchObject({ status: 409 });
  });

  it("only the creator advertises", async () => {
    await expect(advertiseCluster(viewerFor("member"), "c1", { title: "Join Web Speedrunners", body: "We win more web bids together." })).rejects.toMatchObject({ status: 403 });
  });

  it("lists cards with the caller's status", async () => {
    db.cluster.findMany.mockResolvedValue([{ id: "c1", name: "W", purpose: "p", creatorAgentId: "creator", cliqueShare: 20, lastActivityAt: new Date(), createdAt: new Date(), members: [], _count: { posts: 0, skills: 0 } }]);
    db.clusterMember.findMany.mockResolvedValue([{ clusterId: "c1", status: "requested" }]);
    const { items } = await listClusters(viewerFor("asker"));
    expect(items[0].myStatus).toBe("requested");
  });
});

describe("skills", () => {
  it("shares only a Skills Library skill used on issues the agent delivered", async () => {
    db.skillSubmission.findFirst.mockResolvedValue({ slug: "evidence", title: "Reviewer-ready evidence" });
    db.delivery.findMany.mockResolvedValue([{ bug: { number: 377 } }]);
    await expect(shareSkill(viewerFor("member"), "c1", { skill: "evidence", note: "Accepted first time", usedOnIssues: [377, 391] }))
      .rejects.toMatchObject({ status: 422 });
    db.clusterSkill.create.mockResolvedValue({ id: "k1", createdAt: new Date() });
    const shared = await shareSkill(viewerFor("member"), "c1", { skill: "evidence", note: "Accepted first time", usedOnIssues: [377] });
    expect(shared.skill).toMatchObject({ id: "k1", usedOnIssues: [377] });
  });

  it("refuses a skill that isn't in the library", async () => {
    db.skillSubmission.findFirst.mockResolvedValue(null);
    await expect(shareSkill(viewerFor("member"), "c1", { skill: "made-up", note: "Trust me on this", usedOnIssues: [1] })).rejects.toMatchObject({ status: 404 });
  });

  it("records an adoption and returns the skill to load", async () => {
    db.clusterSkill.findFirst.mockResolvedValue({ id: "k1", skillSlug: "evidence" });
    db.skillSubmission.findFirst.mockResolvedValue({ slug: "evidence", title: "T", summary: "S", prompt: "Do this", checklist: [], sampleCommand: null, documentationUrl: null });
    const { skill } = await adoptSkill(viewerFor("creator"), "c1", "k1");
    expect(skill.prompt).toBe("Do this");
    expect(db.clusterSkillAdoption.upsert).toHaveBeenCalled();
  });
});

describe("clique bids", () => {
  it("returns the cluster's share for a member's bid", async () => {
    expect(await cliqueForBid(db as never, agent("member"), "project", "c1")).toEqual({ clusterId: "c1", cliqueShare: 20 });
  });

  it("refuses a bid for a cluster the agent isn't in", async () => {
    await expect(cliqueForBid(db as never, agent("asker"), "project", "c1")).rejects.toMatchObject({ status: 404 });
  });
});
