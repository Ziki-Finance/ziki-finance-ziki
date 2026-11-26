import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Human control over every step (#owner-control). The organisation's owner
 * moves an issue by hand only to the steps listed for where it is, with a
 * reason to close it; nobody else can. A person acting through their agent
 * gets the agent's own refusals, never a silent success.
 */

const bugFindUnique = vi.hoisted(() => vi.fn());
const bugFindUniqueOrThrow = vi.hoisted(() => vi.fn());
const bugFindFirst = vi.hoisted(() => vi.fn());
const bugFindMany = vi.hoisted(() => vi.fn());
const bugCount = vi.hoisted(() => vi.fn());
const bugUpdate = vi.hoisted(() => vi.fn());
const bugUpdateMany = vi.hoisted(() => vi.fn(async () => ({ count: 1 })));
const auditEvent = vi.hoisted(() => vi.fn());
const claimFindMany = vi.hoisted(() => vi.fn());
const claimUpdateMany = vi.hoisted(() => vi.fn());
const activityCreateMany = vi.hoisted(() => vi.fn());
const ideaFindFirst = vi.hoisted(() => vi.fn());
const organisationAccessFor = vi.hoisted(() => vi.fn());
const submitTestVerdict = vi.hoisted(() => vi.fn());
const webAgentFor = vi.hoisted(() => vi.fn());
const checkPostForSecrets = vi.hoisted(() => vi.fn());
const heldByMyAgent = vi.hoisted(() => vi.fn());
const deliverWork = vi.hoisted(() => vi.fn());
const membershipFindFirst = vi.hoisted(() => vi.fn());
const projectFindFirst = vi.hoisted(() => vi.fn());

const tx = {
  $queryRaw: vi.fn(),
  bug: { findUniqueOrThrow: bugFindUniqueOrThrow, update: bugUpdate, updateMany: bugUpdateMany },
  issueClaim: { findMany: claimFindMany, updateMany: claimUpdateMany },
  bugActivity: { createMany: activityCreateMany },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bug: { findUnique: bugFindUnique, findFirst: bugFindFirst, findMany: bugFindMany, count: bugCount, update: bugUpdate, updateMany: bugUpdateMany },
    idea: { findFirst: ideaFindFirst },
    membership: { findFirst: membershipFindFirst },
    project: { findFirst: projectFindFirst },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: vi.fn(async () => ({ id: "user-1", name: "Babs", role: "user" })) }));
vi.mock("@/lib/organisation-access", () => ({ organisationAccessFor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/revalidate-issue", () => ({ revalidateIssue: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyLater: vi.fn() }));
vi.mock("@/lib/agent-api/events", () => ({ publish: vi.fn() }));
vi.mock("@/lib/agents/audit", () => ({ audit: auditEvent }));
vi.mock("@/lib/agent-api/web-events", () => ({ publishWebEvent: vi.fn(), issueChangePayload: vi.fn(() => ({})) }));
vi.mock("@/lib/coins/issue-payout", () => ({ releasePayoutIfLive: vi.fn(async () => false) }));
vi.mock("@/lib/agent-api/test-verdict", () => ({ submitTestVerdict }));
vi.mock("@/lib/web-agent", () => ({ webAgentFor, heldByMyAgent }));
vi.mock("@/lib/agent-api/delivery", () => ({ deliverWork }));
vi.mock("@/lib/security/secret-guard", () => ({ checkPostForSecrets }));

import { ownerMove } from "@/lib/owner-moves";
import { ownerAcceptIdeaAction, ownerConfirmAllAction, ownerMoveIssueAction } from "@/app/actions/owner-moves";
import { confirmLiveWorkAction, deliverForMyAgentAction, giveTestVerdictAction } from "@/app/actions/human-steps";
import { agentConfirmLiveWork } from "@/lib/agent-api/live-confirmation";
import { agentMoveIssueToProject } from "@/lib/agent-api/move-project";

const inProgress = {
  id: "bug-1",
  title: "Search is slow",
  status: "in_progress",
  substatus: "in_progress",
  isDeleted: false,
  organisationId: "org-1",
  assigneeId: "worker-1",
  reporterId: "reporter-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  bugFindUnique.mockResolvedValue(inProgress);
  bugFindUniqueOrThrow.mockResolvedValue({ substatus: "in_progress" });
  claimFindMany.mockResolvedValue([{ id: "claim-1", agentId: "agent-9", beneficiaryUserId: "worker-1" }]);
  organisationAccessFor.mockResolvedValue({ admin: true });
});

describe("owner moves (#owner-control)", () => {
  it("offers only the moves listed for the current step", () => {
    expect(ownerMove("in_progress", "open")).not.toBeNull();
    expect(ownerMove("on_dev", "on_prod")).not.toBeNull();
    // Nothing jumps an issue from Live back into review, or from Open straight to Live.
    expect(ownerMove("on_prod", "requires_review")).toBeNull();
    expect(ownerMove("open", "on_dev")).toBeNull();
    // Force-merged work: the owner can judge it working or broken without waiting for agents.
    expect(ownerMove("force_merged", "on_dev")).not.toBeNull();
    expect(ownerMove("force_merged", "merged_broken")).not.toBeNull();
    expect(ownerMove("merged_broken", "on_dev")).not.toBeNull();
  });

  it("refuses someone who isn't an owner or admin, and changes nothing", async () => {
    organisationAccessFor.mockResolvedValue({ admin: false });
    const result = await ownerMoveIssueAction("bug-1", "closed", "Not planned");
    expect(result).toEqual({ error: expect.stringContaining("owner or admin") });
    expect(bugUpdate).not.toHaveBeenCalled();
  });

  it("won't close without a reason", async () => {
    const result = await ownerMoveIssueAction("bug-1", "closed", "  ");
    expect("error" in result).toBe(true);
    expect(bugUpdate).not.toHaveBeenCalled();
  });

  it("taking it off the agent reopens it, releases the claim and records the owner", async () => {
    const result = await ownerMoveIssueAction("bug-1", "open", "");
    expect(result).toEqual({ ok: true });
    expect(bugUpdate).toHaveBeenCalledWith({
      where: { id: "bug-1" },
      data: expect.objectContaining({ status: "open", substatus: "open", assigneeId: null }),
    });
    expect(claimUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["claim-1"] } },
      data: expect.objectContaining({ status: "released", releaseReason: "owner" }),
    });
    const [[{ data }]] = activityCreateMany.mock.calls;
    expect(data[0].summary).toMatch(/as the owner$/);
  });

  it("refuses a move when someone else moved the issue first", async () => {
    bugFindUniqueOrThrow.mockResolvedValue({ substatus: "requires_review" });
    const result = await ownerMoveIssueAction("bug-1", "open", "");
    expect("error" in result).toBe(true);
    expect(bugUpdate).not.toHaveBeenCalled();
  });

  it("only an owner or admin accepts an idea by hand", async () => {
    ideaFindFirst.mockResolvedValue({ id: "idea-1", organisationId: "org-1", projectId: "project-1" });
    organisationAccessFor.mockResolvedValue({ admin: false });
    const result = await ownerAcceptIdeaAction("idea-1");
    expect("error" in result).toBe(true);
  });
});

describe("Confirm all (#bulk-confirm)", () => {
  it("refuses someone who isn't an owner or admin, and opens nothing", async () => {
    organisationAccessFor.mockResolvedValue({ admin: false });
    expect(await ownerConfirmAllAction("org-1", null)).toEqual({ error: expect.stringContaining("owner or admin") });
    expect(bugFindMany).not.toHaveBeenCalled();
    expect(bugUpdate).not.toHaveBeenCalled();
  });

  it("opens each issue still at Requires confirmation for bids, as the owner, and skips one moved since", async () => {
    bugFindMany.mockResolvedValue([{ id: "bug-a" }, { id: "bug-b" }]);
    bugFindUniqueOrThrow.mockResolvedValueOnce({ substatus: "requires_confirmation" }).mockResolvedValueOnce({ substatus: "open" });
    bugCount.mockResolvedValue(0);

    expect(await ownerConfirmAllAction("org-1", null)).toEqual({ opened: 1, remaining: 0 });
    expect(bugUpdate).toHaveBeenCalledTimes(1);
    expect(bugUpdate).toHaveBeenCalledWith({ where: { id: "bug-a" }, data: { status: "open", substatus: "open" } });
    expect(activityCreateMany.mock.calls[0][0].data[0]).toMatchObject({ bugId: "bug-a", actorId: "user-1", metadata: { from: "requires_confirmation", to: "open" } });
    // It stops nobody: no claim is touched.
    expect(claimUpdateMany).not.toHaveBeenCalled();
  });
});

describe("acting through your agent (#owner-control)", () => {
  it("shows the agent's refusal instead of reporting success", async () => {
    bugFindFirst.mockResolvedValue({ id: "bug-1", organisationId: "org-1", projectId: "project-1" });
    webAgentFor.mockResolvedValue({ agentId: "agent-1", name: "Builder", ownerId: "user-1", organisationId: "org-1", level: "working", burst: false, keyId: "web" });
    checkPostForSecrets.mockResolvedValue({ ok: true });
    submitTestVerdict.mockResolvedValue({ status: 403, error: "fixer_cannot_verdict", message: "The agent that delivered can't judge its own work." });
    const result = await giveTestVerdictAction("bug-1", { goodToMerge: true, summary: "Works.", description: "Tried it.", files: "app/page.tsx" });
    expect(result).toEqual({ error: "The agent that delivered can't judge its own work." });
  });

  it("needs an agent: a person without one can't judge", async () => {
    bugFindFirst.mockResolvedValue({ id: "bug-1", organisationId: "org-1", projectId: "project-1" });
    webAgentFor.mockResolvedValue(null);
    const result = await giveTestVerdictAction("bug-1", { goodToMerge: true, summary: "Works.", description: "Tried it.", files: "" });
    expect("error" in result).toBe(true);
    expect(submitTestVerdict).not.toHaveBeenCalled();
  });

  it("delivers only while my agent holds the work, with the agent's own checks", async () => {
    const work = { pullRequestUrl: "https://github.com/emerjent/ziki/pull/1", summary: "Done.", description: "Changed it.", proof: "Tests pass.", before: "https://example.com/before.png", after: "https://example.com/after.png" };
    heldByMyAgent.mockResolvedValue(null);
    expect("error" in (await deliverForMyAgentAction("bug-1", work))).toBe(true);
    expect(deliverWork).not.toHaveBeenCalled();

    const agent = { agentId: "agent-1", name: "Builder" };
    heldByMyAgent.mockResolvedValue({ claimId: "claim-1", status: "active", projectId: "project-1", agent });
    bugFindFirst.mockResolvedValue({ id: "bug-1", organisationId: "org-1", projectId: "project-1" });
    checkPostForSecrets.mockResolvedValue({ ok: true });
    deliverWork.mockResolvedValue({ status: 400, error: "invalid_request", message: "That is not a GitHub pull request URL." });
    expect(await deliverForMyAgentAction("bug-1", work)).toEqual({ error: "That is not a GitHub pull request URL." });
    expect(deliverWork).toHaveBeenCalledWith(agent, "bug-1", expect.objectContaining({ pullRequestUrl: work.pullRequestUrl, testResults: "Tests pass.", beforeScreenshots: [work.before], screenshots: [work.after] }));
  });
});

describe("Live · Confirmed (#live-confirmed)", () => {
  beforeEach(() => vi.clearAllMocks());
  const live = { id: "bug-1", organisationId: "org-1", status: "resolved", substatus: "on_prod", liveConfirmedAt: null };

  it("lets only a member of the organisation confirm live work, and records who and when", async () => {
    bugFindFirst.mockResolvedValue(live);
    membershipFindFirst.mockResolvedValue(null);
    expect("error" in (await confirmLiveWorkAction("bug-1"))).toBe(true);
    expect(bugUpdateMany).not.toHaveBeenCalled();

    membershipFindFirst.mockResolvedValue({ id: "m-1" });
    expect(await confirmLiveWorkAction("bug-1")).toEqual({ ok: true });
    expect(bugUpdateMany).toHaveBeenCalledWith({ where: { id: "bug-1", liveConfirmedAt: null }, data: { liveConfirmedAt: expect.any(Date), liveConfirmedById: "user-1" } });
  });

  it("refuses work that isn't live, or is live but broken", async () => {
    membershipFindFirst.mockResolvedValue({ id: "m-1" });
    bugFindFirst.mockResolvedValue({ ...live, status: "merge", substatus: "ready_to_merge" });
    expect("error" in (await confirmLiveWorkAction("bug-1"))).toBe(true);
    bugFindFirst.mockResolvedValue({ ...live, substatus: "merged_broken" });
    expect("error" in (await confirmLiveWorkAction("bug-1"))).toBe(true);
    expect(bugUpdateMany).not.toHaveBeenCalled();
  });

  it("a manager agent approves live work for its owner; a working agent can't", async () => {
    const scope = { organisationId: "org-1", projectId: "project-1" };
    const manager = { agentId: "agent-m", ownerId: "owner-1", organisationId: "org-1", level: "manager" as const };
    bugFindFirst.mockResolvedValue(live);

    await expect(agentConfirmLiveWork({ ...manager, level: "working" }, scope, "bug-1")).rejects.toMatchObject({ status: 403 });
    expect(bugUpdateMany).not.toHaveBeenCalled();

    expect(await agentConfirmLiveWork(manager, scope, "bug-1")).toMatchObject({ issueId: "bug-1", alreadyConfirmed: false });
    expect(bugUpdateMany).toHaveBeenCalledWith({ where: { id: "bug-1", liveConfirmedAt: null }, data: { liveConfirmedAt: expect.any(Date), liveConfirmedById: "owner-1" } });
    expect(auditEvent).toHaveBeenCalledWith({ agentId: "agent-m", organisationId: "org-1" }, "issue.live_confirmed", "bug:bug-1", { issueId: "bug-1" }, { bugId: "bug-1" });

    bugFindFirst.mockResolvedValue({ ...live, substatus: "merged_broken" });
    await expect(agentConfirmLiveWork(manager, scope, "bug-1")).rejects.toMatchObject({ status: 409 });
  });

  it("lets any agent move an issue to another project, but not one whose price is locked (#move-project)", async () => {
    const scope = { organisationId: "org-1", projectId: "web" };
    const worker = { agentId: "agent-w", ownerId: "owner-1", organisationId: "org-1", level: "working" as const };
    const issue = { id: "bug-1", number: 7, projectId: "web", lockedPriceZik: null, project: { name: "Web" } };
    const body = { toProjectId: "desktop", reason: "It is the desktop app's sign-in." };
    bugFindFirst.mockResolvedValue(issue);
    projectFindFirst.mockResolvedValue({ id: "desktop", name: "Desktop" });

    expect(await agentMoveIssueToProject(worker, scope, "bug-1", body)).toEqual({ issueId: "bug-1", number: 7, fromProjectId: "web", projectId: "desktop" });
    expect(bugUpdateMany).toHaveBeenCalledWith({ where: { id: "bug-1", projectId: "web", lockedPriceZik: null }, data: { projectId: "desktop", areaId: null } });
    expect(activityCreateMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ actorId: "owner-1", metadata: expect.objectContaining({ field: "project", from: "Web", to: "Desktop" }) })] });

    // A locked price was reserved from this project's budget and is paid out against it, so the issue stays.
    bugUpdateMany.mockClear();
    bugFindFirst.mockResolvedValue({ ...issue, lockedPriceZik: 500 });
    await expect(agentMoveIssueToProject(worker, scope, "bug-1", body)).rejects.toMatchObject({ status: 409, body: { error: "price_locked" } });
    projectFindFirst.mockResolvedValue({ id: "web", name: "Web" });
    bugFindFirst.mockResolvedValue(issue);
    await expect(agentMoveIssueToProject(worker, scope, "bug-1", { ...body, toProjectId: "web" })).rejects.toMatchObject({ status: 409, body: { error: "same_project" } });
    expect(bugUpdateMany).not.toHaveBeenCalled();
  });
});
