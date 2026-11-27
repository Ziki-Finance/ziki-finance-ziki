import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ default: () => ({ auth: (handler: unknown) => handler }) }));
vi.mock("@/auth.config", () => ({ default: {} }));

const ORG = { id: "org-a", name: "Acme" };
const rows = [
  { tag: "basics", title: "Basics", summary: "", body: "Shared basics.", position: 10, organisationId: null },
  { tag: "core-rules", title: "Core Rules", summary: "", body: "Shared rules.", position: 20, organisationId: null },
  { tag: "core-rules", title: "Acme Core Rules", summary: "", body: "Acme rules replace the shared ones.", position: 20, organisationId: "org-a" },
  { tag: "deploys", title: "Acme deploys", summary: "", body: "Acme deploys on Fridays.", position: 5, organisationId: "org-a" },
  { tag: "secret", title: "Other org", summary: "", body: "Another organisation's note.", position: 30, organisationId: "org-b" },
];
const session = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, agentOrg: null as string | null }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organisation: { findFirst: vi.fn(async ({ where }: { where: { slug: string } }) => (where.slug === "acme" ? ORG : null)) },
    membership: { findFirst: vi.fn(async ({ where }: { where: { userId: string } }) => (where.userId === "member" ? { id: "m1" } : null)) },
    instruction: {
      findMany: vi.fn(async ({ where }: { where: { OR?: { organisationId: string | null }[]; organisationId?: null } }) => {
        const orgIds = where.OR ? where.OR.map((clause) => clause.organisationId) : [null];
        return rows.filter((row) => orgIds.includes(row.organisationId)).sort((a, b) => a.position - b.position);
      }),
    },
  },
}));
vi.mock("@/lib/agents/require-agent", () => ({
  requireAgent: vi.fn(async () => {
    if (!session.agentOrg) throw new Error("bad key");
    return { organisationId: session.agentOrg };
  }),
}));
vi.mock("@/lib/auth-helpers", () => ({ optionalUser: vi.fn(async () => session.user) }));

import { GET as getLlms } from "@/app/llms.txt/route";
import { GET as getAgents } from "@/app/[org]/agents.txt/route";
import { isPublicPath } from "@/middleware";

const agentsTxt = (org: string, headers?: Record<string, string>) =>
  getAgents(new Request(`https://ziki.dev/${org}/agents.txt`, { headers }), { params: Promise.resolve({ org }) });

describe("agent instructions (#instructions)", () => {
  beforeEach(() => {
    session.user = null;
    session.agentOrg = null;
  });

  it("serves /llms.txt as a short public start page that sends connected agents to their organisation's agents.txt", async () => {
    expect(isPublicPath("/llms.txt")).toBe(true);
    const body = await (await getLlms(new Request("https://ziki.dev/llms.txt"))).text();
    expect(body).toContain("/<your-org>/agents.txt");
    expect(Buffer.byteLength(body, "utf8")).toBeLessThan(4_000);
  });

  it("serves an organisation's agents.txt as one file: shared sections, its own replacing the same tag, the rest added", async () => {
    session.agentOrg = "org-a";
    const res = await agentsTxt("acme", { authorization: "Bearer key" });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<instruction tag="basics">\n## Basics');
    expect(body).toContain("Acme rules replace the shared ones.");
    expect(body).not.toContain("Shared rules.");
    expect(body).toContain('<instruction tag="deploys">');
    expect(body.indexOf('tag="core-rules"')).toBeLessThan(body.indexOf('tag="deploys"'));
    expect(body).not.toContain("Another organisation's note.");
    const cached = await agentsTxt("acme", { authorization: "Bearer key", "if-none-match": res.headers.get("etag")! });
    expect(cached.status).toBe(304);
  });

  it("refuses another organisation's key, a bad key, a signed-out reader and a non-member", async () => {
    session.agentOrg = "org-b";
    expect((await agentsTxt("acme", { authorization: "Bearer key" })).status).toBe(404);
    session.agentOrg = null;
    expect((await agentsTxt("acme", { authorization: "Bearer bad" })).status).toBe(404);
    expect((await agentsTxt("acme")).status).toBe(404);
    session.user = { id: "stranger", role: "user" };
    expect((await agentsTxt("acme")).status).toBe(404);
    session.user = { id: "member", role: "user" };
    expect((await agentsTxt("acme")).status).toBe(200);
    expect((await agentsTxt("nowhere")).status).toBe(404);
  });
});
