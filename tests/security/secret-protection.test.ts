import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  secretAlert: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  agentApiKey: { findUnique: vi.fn(), updateMany: vi.fn() },
  agentAuditEvent: { create: vi.fn() },
  notification: { create: vi.fn() },
  bug: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  idea: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  comment: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  bugRevision: { findMany: vi.fn(), update: vi.fn() },
  bugActivity: { updateMany: vi.fn() },
  securityFinding: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/cache-tags", () => ({ expireUnreadCounts: vi.fn() }));

const agent = vi.hoisted(() => ({
  agentId: "agent-bob",
  name: "Bob's Claude",
  ownerId: "bob",
  organisationId: "org-1",
  level: "working",
  burst: false,
  keyId: "key-bob",
}));
vi.mock("@/lib/agents/require-agent", async (original) => ({
  ...(await original<typeof import("@/lib/agents/require-agent")>()),
  requireAgent: vi.fn(async () => agent),
}));
vi.mock("@/lib/agents/rate-budget", async (original) => ({
  ...(await original<typeof import("@/lib/agents/rate-budget")>()),
  consumeAgentBudget: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0, kind: "write", limit: 600, remaining: 599, resetSeconds: 60, windowSeconds: 60 })),
}));

import { findSecrets, fingerprintSecret, redactSecrets, secretBlockedMessage, findSecretsInFields } from "@/lib/security/secrets";
import { checkPostForSecrets } from "@/lib/security/secret-guard";
import { agentIssueRequest } from "@/lib/agent-api/issues";

/**
 * Secret protection (#secret-protection): a post with a working credential in
 * it is refused before it is saved, a placeholder never is, a leaked Ziki
 * agent key is turned off, and what was already up can be found and removed.
 *
 * Every credential here is built while the test runs, so this file never
 * holds one (GitHub's own push protection reads it).
 */
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomish(length: number, seed: string, alphabet = ALNUM): string {
  let out = "";
  for (let i = 0; out.length < length; i++) {
    for (const byte of createHash("sha256").update(`${seed}:${i}`).digest()) {
      out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}
const join = (...parts: string[]) => parts.join("");

const githubToken = join("gh", "p_") + randomish(36, "github");
const zikiKey = join("zi", "ki_") + randomish(43, "ziki", `${ALNUM}-_`);
const awsKey = join("AK", "IA") + randomish(16, "aws", "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567");
const stripeKey = join("sk", "_li", "ve_") + randomish(24, "stripe");
const anthropicKey = join("sk-", "ant-", "api03-") + randomish(40, "anthropic", `${ALNUM}-_`);
const databasePassword = randomish(18, "db-password");
const privateKey = [
  join("-----BEGIN ", "RSA PRIVATE KEY-----"),
  ...Array.from({ length: 6 }, (_, i) => randomish(64, `pem-${i}`, `${ALNUM}+/`)),
  join("-----END ", "RSA PRIVATE KEY-----"),
].join("\n");

beforeEach(() => {
  vi.clearAllMocks();
  db.secretAlert.findFirst.mockResolvedValue(null);
  db.secretAlert.create.mockResolvedValue({});
  db.agentApiKey.findUnique.mockResolvedValue(null);
  db.agentApiKey.updateMany.mockResolvedValue({ count: 1 });
  db.notification.create.mockResolvedValue({});
  db.agentAuditEvent.create.mockResolvedValue({});
  db.bug.findUnique.mockResolvedValue(null);
  db.$transaction.mockImplementation(async (run: (tx: typeof db) => unknown) => run(db));
});

describe("finding secrets", () => {
  it("finds a working credential of each kind, with its line, and never shows it whole", () => {
    const text = [
      "Steps to reproduce:",
      `export GITHUB_TOKEN=${githubToken}`,
      `aws configure set aws_access_key_id ${awsKey}`,
      `const stripe = new Stripe("${stripeKey}");`,
      `ANTHROPIC_API_KEY=${anthropicKey}`,
      `DATABASE_URL=postgresql://app:${databasePassword}@db.acme-prod.com:5432/app`,
      privateKey,
    ].join("\n");
    const found = findSecrets(text);
    expect(found.map((m) => [m.kind, m.line])).toEqual([
      ["github_token", 2],
      ["aws_access_key", 3],
      ["stripe_key", 4],
      ["anthropic_key", 5],
      ["database_url", 6],
      ["private_key", 7],
    ]);
    for (const secret of [githubToken, awsKey, stripeKey, anthropicKey, databasePassword]) {
      expect(found.some((m) => m.preview.includes(secret))).toBe(false);
    }
    expect(found.find((m) => m.kind === "database_url")?.preview).toBe("postgresql://app:••••@db.acme-prod.com");
  });

  it("finds a setting named as a secret with a generated value, but not one that is a reference or prose", () => {
    const value = randomish(32, "auth-secret", `${ALNUM}+/`);
    expect(findSecrets(`AUTH_SECRET="${value}"`).map((m) => m.kind)).toEqual(["env_secret"]);
    expect(findSecrets("AUTH_SECRET=${{ secrets.AUTH_SECRET }}")).toEqual([]);
    expect(findSecrets("const apiKey = process.env.OPENAI_API_KEY;")).toEqual([]);
    expect(findSecrets("The token: expires after an hour, then the session refreshes itself.")).toEqual([]);
  });

  it("leaves placeholders, vendors' documented examples and local development addresses alone", () => {
    const placeholders = [
      join("gh", "p_") + "x".repeat(36),
      `GITHUB_TOKEN=your-token-here-${"1".repeat(8)}`,
      join("AKIA", "IOSFODNN7", "EXAMPLE"),
      join("sk", "_live_") + "your_stripe_secret_key_here",
      "DATABASE_URL=postgresql://bugtracker:bugtracker@localhost:5433/bugtracker",
      "postgres://postgres:postgres@db:5432/app",
      join("zi", "ki_") + "Ab3dE6",
    ];
    for (const text of placeholders) expect(findSecrets(text), text).toEqual([]);
  });

  it("removes only the secrets asked for, and says what was there", () => {
    const text = `old ${githubToken} and ${stripeKey}`;
    const [github] = findSecrets(githubToken);
    const { text: clean, removed } = redactSecrets(text, new Set([github.fingerprint]));
    expect(removed).toBe(1);
    expect(clean).toBe(`old [removed: GitHub token] and ${stripeKey}`);
  });

  it("tells the sender what and where, never the secret", () => {
    const message = secretBlockedMessage(findSecretsInFields({ title: "Login fails", description: `line one\n${githubToken}` }), "this comment");
    expect(message).toContain("GitHub token");
    expect(message).toContain("line 2");
    expect(message).toContain("nothing was posted");
    expect(message).not.toContain(githubToken);
  });
});

describe("push protection", () => {
  it("stops a person's post with a credential and files one alert, however often it is retried", async () => {
    const post = { organisationId: "org-1", actor: { kind: "user" as const, userId: "ada" }, source: "comment", url: null, fields: { body: `try ${githubToken}` } };
    const first = await checkPostForSecrets(post);
    expect(first.ok).toBe(false);
    expect(db.secretAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "github_token", state: "blocked", actorUserId: "ada", fingerprint: fingerprintSecret(githubToken) }),
    });
    expect(JSON.stringify(db.secretAlert.create.mock.calls)).not.toContain(githubToken);

    db.secretAlert.findFirst.mockResolvedValue({ id: "alert-1" });
    expect((await checkPostForSecrets(post)).ok).toBe(false);
    expect(db.secretAlert.create).toHaveBeenCalledTimes(1);
    expect(db.secretAlert.update).toHaveBeenCalledWith({ where: { id: "alert-1" }, data: { attempts: { increment: 1 }, lastSeenAt: expect.any(Date) } });
  });

  it("lets a post with no secret in it through without touching the database", async () => {
    const check = await checkPostForSecrets({ organisationId: "org-1", actor: { kind: "user", userId: "ada" }, source: "comment", url: null, fields: { body: "Clicking Save does nothing on Safari." } });
    expect(check).toEqual({ ok: true });
    expect(db.secretAlert.create).not.toHaveBeenCalled();
  });

  it("answers an agent's write that carries a credential with 422, and never runs the route", async () => {
    const run = vi.fn(async () => new Response("{}", { status: 201 }));
    const request = new NextRequest("http://localhost:3001/api/v1/issues/12/comments", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test" },
      body: JSON.stringify({ body: "The build log:", summary: "Build fails.", receipt: { verified: `env: ${githubToken}` } }),
    });
    const response = await agentIssueRequest(request, "comments.create", "working", null, run);
    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json).toMatchObject({ code: "secret_detected", secrets: [{ field: "receipt.verified", line: 1, kind: "github_token" }] });
    expect(JSON.stringify(json)).not.toContain(githubToken);
    expect(run).not.toHaveBeenCalled();
    // The agent's owner hears about it.
    expect(db.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "bob", kind: "secret_blocked" }) });
  });

  it("passes an agent's write with only a placeholder on to the route", async () => {
    const run = vi.fn(async () => new Response("{}", { status: 201 }));
    const request = new NextRequest("http://localhost:3001/api/v1/issues/12/comments", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test" },
      body: JSON.stringify({ body: `Set GITHUB_TOKEN=${join("gh", "p_")}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx first.` }),
    });
    const response = await agentIssueRequest(request, "comments.create", "working", null, run);
    expect(response.status).toBe(201);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

/** A working key of Ada's agent, as the key lookup returns it. */
function adasKey() {
  return {
    id: "key-ada",
    organisationId: "org-1",
    prefix: zikiKey.slice(0, 11),
    revokedAt: null,
    agent: { id: "agent-ada", name: "Ada's Claude", username: "adas-claude", ownerUserId: "ada", revokedAt: null },
  };
}

describe("leaked Ziki agent keys", () => {
  it("turns off someone else's working key the moment they try to post it, and tells its owner", async () => {
    db.agentApiKey.findUnique.mockResolvedValue(adasKey());
    const check = await checkPostForSecrets({ organisationId: "org-1", actor: { kind: "user", userId: "mallory" }, source: "comment", url: null, fields: { body: `found this: ${zikiKey}` } });
    expect(check.ok).toBe(false);
    expect(db.agentApiKey.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { keyHash: createHash("sha256").update(zikiKey).digest("hex") } }));
    expect(db.agentApiKey.updateMany).toHaveBeenCalledWith({ where: { id: "key-ada", revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(db.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "ada", kind: "agent_key_revoked" }) });
  });

  it("only stops the owner's own key: it never went up, so nothing is turned off", async () => {
    db.agentApiKey.findUnique.mockResolvedValue(adasKey());
    const check = await checkPostForSecrets({ organisationId: "org-1", actor: { kind: "user", userId: "ada" }, source: "comment", url: null, fields: { body: zikiKey } });
    expect(check.ok).toBe(false);
    expect(db.agentApiKey.updateMany).not.toHaveBeenCalled();
  });
});
