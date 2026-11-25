import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const findActivation = vi.hoisted(() => vi.fn());
const registryDb = vi.hoisted(() => ({
  agent: { findUnique: vi.fn(), findFirst: vi.fn() },
  membership: { findUnique: vi.fn(), findMany: vi.fn() },
  organisation: { findUnique: vi.fn() },
  notification: { createMany: vi.fn() },
  // #agent-posting-block
  agentPostingBlock: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  agentAuditEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/cache-tags", () => ({ expireUnreadCounts: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { agentApiKey: { findUnique, update }, agentActivation: { findUnique: findActivation }, ...registryDb },
}));

import { generateApiKey, hashSecret } from "@/lib/agents/keys";
import { AgentLevelError } from "@/lib/agents/levels";
import { AgentAuthError, agentErrorResponse, requireAgent } from "@/lib/agents/require-agent";
import { activateAgent } from "@/lib/agents/registry";
import { agentCapSummary } from "@/lib/agents/registry-limits";

const KEY = "ziki_valid-key-for-tests";
const request = (authorization?: string) => ({
  headers: { get: (name: string) => (name === "authorization" ? (authorization ?? null) : null) },
});

function keyRow(overrides: {
  revokedAt?: Date | null;
  lastUsedAt?: Date | null;
  agent?: Record<string, unknown>;
} = {}) {
  return {
    id: "key1",
    lastUsedAt: overrides.lastUsedAt ?? null,
    revokedAt: overrides.revokedAt ?? null,
    // #user-agents: the organisation the key works in, every project there.
    organisationId: "organisation_zedu",
    agent: {
      id: "agent1",
      name: "Ada's Claude",
      ownerUserId: "ada",
      revokedAt: null,
      // A set-up profile, so the work gate lets the key through.
      username: "adas-claude",
      tagline: "Patient bug hunter",
      about: "I reproduce first.",
      _count: { skills: 1 },
      owner: { role: "user", memberships: [{ organisationId: "organisation_zedu" }] },
      ...overrides.agent,
    },
  };
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as AgentAuthError;
  }
  throw new Error("expected requireAgent to reject");
}

/** The agent switched on in the key's organisation, with its class there. */
const activeHere = { level: "working", burst: false, burstUntil: null, deactivatedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
  findActivation.mockResolvedValue(activeHere);
});

/** Agent keys (#427): a valid key resolves its agent; missing, malformed, wrong, revoked and foreign keys are refused. */
describe("requireAgent (#427)", () => {
  it("rejects a request with no key without touching the database", async () => {
    expect((await failure(requireAgent(request()))).code).toBe("missing_key");
    expect((await failure(requireAgent(request("Bearer")))).code).toBe("missing_key");
    expect((await failure(requireAgent(request("   ")))).code).toBe("missing_key");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("calls a sent-but-unusable header a bad key, not a missing one (#467)", async () => {
    // Each of these *did* send a key; only its shape is wrong.
    for (const header of ["Basic abc", "Bearer bad", "Bearer a b", 'Bearer "ziki_abc"', "Bearer sk-other"]) {
      expect((await failure(requireAgent(request(header)))).code).toBe("invalid_key");
    }
    // A malformed header never reaches the database.
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a key that matches nothing", async () => {
    findUnique.mockResolvedValue(null);
    expect((await failure(requireAgent(request("Bearer ziki_wrong")))).code).toBe("invalid_key");
    expect(findUnique.mock.calls[0][0].where).toEqual({ keyHash: hashSecret("ziki_wrong") });
  });

  it("resolves a valid key to the agent, its owner, organisation and level", async () => {
    findUnique.mockResolvedValue(keyRow());
    await expect(requireAgent(request(`Bearer ${KEY}`))).resolves.toEqual({
      agentId: "agent1",
      name: "Ada's Claude",
      ownerId: "ada",
      organisationId: "organisation_zedu",
      level: "working",
      ownerRole: "user",
      burst: false,
      burstUntil: null,
      pausedAt: null,
      keyId: "key1",
    });
    // Looked up by hash only; the raw key never reaches the query.
    expect(JSON.stringify(findUnique.mock.calls[0][0])).not.toContain(KEY);
  });

  it("rejects a revoked key, and every key of a revoked agent", async () => {
    findUnique.mockResolvedValue(keyRow({ revokedAt: new Date() }));
    expect((await failure(requireAgent(request(`Bearer ${KEY}`)))).code).toBe("revoked");
    findUnique.mockResolvedValue(keyRow({ agent: { revokedAt: new Date() } }));
    expect((await failure(requireAgent(request(`Bearer ${KEY}`)))).code).toBe("revoked");
  });

  it("runs as the agent's activation in the key's organisation: its class there (#user-agents)", async () => {
    findUnique.mockResolvedValue(keyRow());
    findActivation.mockResolvedValue({ ...activeHere, level: "manager" });
    await expect(requireAgent(request(`Bearer ${KEY}`))).resolves.toMatchObject({ organisationId: "organisation_zedu", level: "manager" });
    expect(findActivation.mock.calls[0][0].where).toEqual({ agentId_organisationId: { agentId: "agent1", organisationId: "organisation_zedu" } });
  });

  it("stops a key once its agent is taken out of that organisation, or was never brought in", async () => {
    findUnique.mockResolvedValue(keyRow());
    findActivation.mockResolvedValue({ ...activeHere, deactivatedAt: new Date() });
    expect((await failure(requireAgent(request(`Bearer ${KEY}`)))).code).toBe("revoked");
    findActivation.mockResolvedValue(null);
    expect((await failure(requireAgent(request(`Bearer ${KEY}`)))).code).toBe("revoked");
  });

  it("rejects an agent whose owner has left its organisation", async () => {
    findUnique.mockResolvedValue(keyRow({ agent: { owner: { memberships: [{ organisationId: "other" }] } } }));
    expect((await failure(requireAgent(request(`Bearer ${KEY}`)))).code).toBe("invalid_key");
  });

  it("keeps only a key's hash, never the raw key", () => {
    const key = generateApiKey();
    expect(key.hash).toBe(hashSecret(key.raw));
    expect(key.hash).not.toContain(key.raw);
    expect(generateApiKey().raw).not.toBe(key.raw);
  });
});

describe("agentErrorResponse", () => {
  it("is 401 for key problems and 403 for a low level", async () => {
    const unauthorized = agentErrorResponse(new AgentAuthError("missing_key"));
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("WWW-Authenticate")).toContain("Bearer");
    const forbidden = agentErrorResponse(new AgentLevelError("manager"));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ error: "insufficient_level", required: "manager" });
  });
});

describe("the work gate (#agent-work-gate)", () => {
  const ready = { tagline: "Patient bug hunter", about: "I reproduce first.", skillCount: 1 };

  it("lets an agent with a set-up profile work, and names what an unfinished one lacks", async () => {
    const { missingProfileFields } = await import("@/lib/agents/work-gate");
    expect(missingProfileFields(ready)).toEqual([]);
    expect(missingProfileFields({ tagline: null, about: "  ", skillCount: 0 })).toEqual(["tagline", "about", "skills"]);
  });

  it("refuses every route to an unfinished profile except setting the profile up", async () => {
    const { assertAgentMayWork, AgentWorkBlockedError } = await import("@/lib/agents/work-gate");
    const agent = { username: "ada-claude", tagline: null, about: null, skillCount: 0 };
    const at = (method: string, path: string) => ({ method, url: `http://localhost${path}` });
    for (const [method, path] of [
      ["GET", "/api/v1/agents/me"],
      ["PATCH", "/api/v1/agents/me"],
      ["PUT", "/api/v1/agents/me/skills"],
      ["PUT", "/api/v1/agents/me/skills/postgres"],
      ["PUT", "/api/v1/agents/me/picture"],
      // #terminal-work-mode: the person's work mode is saved before the profile.
      ["POST", "/api/v1/agents/me/work-mode"],
      ["GET", "/api/v1/skill-tags"],
      ["GET", "/api/v1/agents/someone"],
    ]) {
      expect(() => assertAgentMayWork(agent, at(method, path)), `${method} ${path}`).not.toThrow();
    }
    for (const [method, path] of [
      ["GET", "/zedu/demo/work"],
      ["POST", "/api/v1/ideas"],
      ["POST", "/api/v1/issues/abc/bid"],
      ["GET", "/api/v1/projects"],
      ["POST", "/api/v1/agents/me/skills"],
      ["GET", "/api/v1/agents/me/history"],
    ]) {
      expect(() => assertAgentMayWork(agent, at(method, path)), `${method} ${path}`).toThrow(AgentWorkBlockedError);
    }
    expect(() => assertAgentMayWork({ ...ready, username: "ada-claude" }, at("POST", "/api/v1/ideas"))).not.toThrow();
  });
});

/** #user-agents: a person brings their agent into an organisation only where they belong; the key it gets works there. */
describe("activateAgent", () => {
  const owner = { id: "ada", role: "user" as const };
  const agent = { id: "agent1", name: "Ada's Claude", ownerUserId: "ada", revokedAt: null, activations: [] };

  it("refuses an organisation its owner isn't a member of, and someone else's agent", async () => {
    registryDb.agent.findUnique.mockResolvedValue(agent);
    registryDb.membership.findUnique.mockResolvedValue(null);
    await expect(activateAgent(owner, "agent1", "organisation_other")).resolves.toMatchObject({ ok: false });
    registryDb.agent.findUnique.mockResolvedValue({ ...agent, ownerUserId: "bob" });
    await expect(activateAgent(owner, "agent1", "organisation_zedu")).resolves.toMatchObject({ ok: false });
    expect(registryDb.$transaction).not.toHaveBeenCalled();
  });

  it("switches it on where they belong, keeping the class that organisation gave it, with one live key there", async () => {
    registryDb.agent.findUnique.mockResolvedValue(agent);
    registryDb.membership.findUnique.mockResolvedValue({ userId: "ada" });
    // The key is sealed so its owner can copy it again.
    vi.stubEnv("AUTH_SECRET", "a-test-secret-of-enough-length");
    const tx = {
      agentActivation: { upsert: vi.fn().mockResolvedValue({ level: "manager" }) },
      agentApiKey: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn().mockResolvedValue({}) },
      agentAuditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    registryDb.$transaction.mockImplementation((run: (db: typeof tx) => unknown) => run(tx));
    const result = await activateAgent(owner, "agent1", "organisation_zedu");
    expect(result).toMatchObject({ ok: true, key: { agentId: "agent1", level: "manager" } });
    expect(tx.agentActivation.upsert.mock.calls[0][0]).toMatchObject({
      where: { agentId_organisationId: { agentId: "agent1", organisationId: "organisation_zedu" } },
      update: { deactivatedAt: null },
    });
    expect(tx.agentApiKey.updateMany.mock.calls[0][0].where).toMatchObject({ agentId: "agent1", organisationId: "organisation_zedu", revokedAt: null });
    expect(tx.agentApiKey.create.mock.calls[0][0].data).toMatchObject({ agentId: "agent1", organisationId: "organisation_zedu" });
  });
});

/** The agents page counts live agents, paused ones included, because the cap does (#860, #511). */
const agent = (paused: boolean, revoked = false) => ({ pausedAt: paused ? "2026-11-07T00:00:00Z" : null, revokedAt: revoked ? "2026-11-07T00:00:00Z" : null });

describe("agentCapSummary", () => {
  it("counts live agents, paused included, and leaves revoked ones out", () => {
    const summary = agentCapSummary([agent(false), agent(true), agent(true, true)], 5);
    expect(summary).toMatchObject({ live: 2, paused: 1, running: 1, over: 0, max: 5, note: null });
  });
  it("says pausing doesn't free a slot at the limit", () => {
    const summary = agentCapSummary(Array.from({ length: 5 }, (_, i) => agent(i % 2 === 0)), 5);
    expect(summary.note).toContain("at the limit");
    expect(summary.note).toContain("Pausing doesn't free a slot");
  });
  it("names how far over the limit an owner is", () => {
    const over = agentCapSummary(Array.from({ length: 10 }, (_, i) => agent(i >= 6)), 5);
    expect(over).toMatchObject({ live: 10, paused: 4, running: 6, over: 5 });
    expect(over.note).toContain("5 over the limit");
  });
});

/**
 * #agent-posting-block: a manager agent stops a spamming agent from writing in its organisation, for a while or until
 * a person lifts it. The blocked agent still reads; only an owner or admin of the organisation lifts a block early.
 */
describe("the posting block (#agent-posting-block)", () => {
  const at = (method: string, path: string) => ({ method, url: `http://localhost${path}` });
  const manager = { agentId: "mgr", organisationId: "organisation_zedu", level: "manager" as const };
  const spammer = { id: "spam1", name: "Spammy", username: "spammy", ownerUserId: "bob", activations: [{ level: "working" }] };

  beforeEach(() => {
    registryDb.agentPostingBlock.findFirst.mockResolvedValue(null);
    registryDb.$transaction.mockImplementation(async (run: (tx: typeof registryDb) => unknown) => run(registryDb));
    registryDb.membership.findMany.mockResolvedValue([{ userId: "owner1" }]);
    registryDb.organisation.findUnique.mockResolvedValue({ slug: "zedu", projects: [{ slug: "web" }] });
  });

  it("lets a blocked agent read and rotate its key, and refuses every write with the reason and end", async () => {
    const { assertAgentMayPost, AgentPostingBlockedError } = await import("@/lib/agents/posting-block");
    const until = new Date("2026-11-25T18:00:00Z");
    registryDb.agentPostingBlock.findFirst.mockResolvedValue({ id: "b1", reason: "40 duplicate ideas", until, createdAt: new Date() });

    for (const [method, path] of [["GET", "/api/v1/ideas"], ["HEAD", "/api/v1/agents/me"], ["POST", "/api/v1/agents/me/key"]]) {
      await expect(assertAgentMayPost("spam1", "organisation_zedu", at(method, path)), `${method} ${path}`).resolves.toBeUndefined();
    }
    for (const [method, path] of [["POST", "/api/v1/ideas"], ["POST", "/api/v1/issues/abc/comments"], ["PATCH", "/api/v1/agents/me"], ["DELETE", "/api/v1/agents/me/skills/x"]]) {
      await expect(assertAgentMayPost("spam1", "organisation_zedu", at(method, path)), `${method} ${path}`).rejects.toBeInstanceOf(AgentPostingBlockedError);
    }

    const response = agentErrorResponse(new AgentPostingBlockedError("40 duplicate ideas", until));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "posting_blocked", reason: "40 duplicate ideas", until: until.toISOString() });
  });

  it("lets an agent with no live block write", async () => {
    const { assertAgentMayPost } = await import("@/lib/agents/posting-block");
    await expect(assertAgentMayPost("spam1", "organisation_zedu", at("POST", "/api/v1/ideas"))).resolves.toBeUndefined();
  });

  it("refuses a working agent, itself, a manager and an admin's agent, and blocks nothing", async () => {
    const { blockAgentPosting, PostingBlockError } = await import("@/lib/agents/posting-block");
    const refused = async (caller: Parameters<typeof blockAgentPosting>[0], code: string) => {
      const error = await blockAgentPosting(caller, "spammy", { reason: "spam spam spam" }).catch((caught) => caught);
      expect(error, code).toBeInstanceOf(PostingBlockError);
      expect(error.code).toBe(code);
    };

    await refused({ ...manager, level: "working" }, "insufficient_level");
    await refused({ ...manager, guest: true }, "insufficient_level");

    registryDb.agent.findFirst.mockResolvedValue(null);
    await refused(manager, "not_found");

    registryDb.agent.findFirst.mockResolvedValue({ ...spammer, id: "mgr" });
    await refused(manager, "cannot_block_self");

    registryDb.agent.findFirst.mockResolvedValue({ ...spammer, activations: [{ level: "merger" }] });
    await refused(manager, "cannot_block_manager");

    registryDb.agent.findFirst.mockResolvedValue(spammer);
    registryDb.membership.findUnique.mockResolvedValue({ role: "admin" });
    await refused(manager, "cannot_block_admin_agent");

    expect(registryDb.agentPostingBlock.create).not.toHaveBeenCalled();
  });

  it("blocks a member's agent for the minutes given, or until a person lifts it, replacing the live block", async () => {
    const { blockAgentPosting } = await import("@/lib/agents/posting-block");
    const now = new Date("2026-11-25T12:00:00Z");
    registryDb.agent.findFirst.mockResolvedValue(spammer);
    registryDb.membership.findUnique.mockResolvedValue({ role: "member" });
    registryDb.agentPostingBlock.create.mockImplementation(async ({ data }: { data: { reason: string; until: Date | null } }) => ({
      id: "b2", reason: data.reason, until: data.until, createdAt: now, blockedByAgent: { id: "mgr", name: "Manager", username: "manager" },
    }));

    const timed = await blockAgentPosting(manager, "spammy", { reason: "40 duplicate ideas", minutes: 120 }, now);
    expect(timed.until).toBe("2026-11-25T14:00:00.000Z");
    expect(timed.agent.username).toBe("spammy");
    // The live block it replaces is lifted first, in the same transaction.
    expect(registryDb.agentPostingBlock.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { liftedAt: now } }));
    // Its owner and the organisation's admins hear about it.
    const told = registryDb.notification.createMany.mock.calls.at(-1)![0].data.map((row: { userId: string }) => row.userId);
    expect(told.sort()).toEqual(["bob", "owner1"]);

    const forever = await blockAgentPosting(manager, "spammy", { reason: "Still spamming" }, now);
    expect(forever.until).toBeNull();
  });

  it("is lifted early only by an owner or admin of the organisation", async () => {
    const { liftPostingBlock, PostingBlockError } = await import("@/lib/agents/posting-block");
    registryDb.agentPostingBlock.findUnique.mockResolvedValue({ id: "b1", organisationId: "organisation_zedu", agentId: "spam1", liftedAt: null, until: null });

    registryDb.membership.findUnique.mockResolvedValue({ role: "member" });
    await expect(liftPostingBlock({ id: "member1", role: "user" }, "b1")).rejects.toBeInstanceOf(PostingBlockError);
    expect(registryDb.agentPostingBlock.update).not.toHaveBeenCalled();

    registryDb.membership.findUnique.mockResolvedValue({ role: "owner" });
    await liftPostingBlock({ id: "owner1", role: "user" }, "b1");
    expect(registryDb.agentPostingBlock.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ liftedByUserId: "owner1" }) }));
  });
});
