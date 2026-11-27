import { readFileSync } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUser = vi.fn();
const listJobsForAgent = vi.fn();
const screenJobsForOwner = vi.fn();
const listPipelineJobsForAgent = vi.fn();
const listDecisionJobs = vi.fn();
const listMonitorJobs = vi.fn();
const triageQueue = vi.fn();
const parseTriageQuery = vi.fn();
const issueProject = vi.fn();
const requireLevel = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => findUser(...args) },
  },
}));

vi.mock("@/lib/finance/research", () => ({
  listJobsForAgent: (...args: unknown[]) => listJobsForAgent(...args),
}));
vi.mock("@/lib/finance/screen", () => ({
  screenJobsForOwner: (...args: unknown[]) => screenJobsForOwner(...args),
}));
vi.mock("@/lib/finance/pipeline", () => ({
  listPipelineJobsForAgent: (...args: unknown[]) => listPipelineJobsForAgent(...args),
}));
vi.mock("@/lib/finance/decisions", () => ({
  listDecisionJobs: (...args: unknown[]) => listDecisionJobs(...args),
}));
vi.mock("@/lib/finance/monitor", () => ({
  listMonitorJobs: (...args: unknown[]) => listMonitorJobs(...args),
}));

vi.mock("@/lib/agents/levels", () => ({
  requireLevel: (...args: unknown[]) => requireLevel(...args),
}));
vi.mock("@/lib/agent-api/issues", () => ({
  agentIssueRequest: async (
    _req: NextRequest,
    _action: string,
    _kind: string,
    _target: string | null,
    handler: (agent: { agentId: string; ownerId: string; level: "working" | "manager" | "merger" }) => Promise<NextResponse>,
  ) => handler({ agentId: "agent_1", ownerId: "owner_1", level: "manager" }),
  issueProject: (...args: unknown[]) => issueProject(...args),
}));
vi.mock("@/lib/agent-api/triage", () => ({
  parseTriageQuery: (...args: unknown[]) => parseTriageQuery(...args),
  triageQueue: (...args: unknown[]) => triageQueue(...args),
}));

import { financeTriageSummary } from "@/lib/finance/triage";
import { GET as getTriage } from "@/app/api/v1/triage/route";

describe("FIN-AGT-CR-001: Finance discovery in GET /api/v1/triage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseTriageQuery.mockReturnValue({ limit: 50, cursor: null });
    issueProject.mockResolvedValue({ organisationId: "org_1", projectId: "proj_1" });
    triageQueue.mockResolvedValue({ items: [], nextCursor: null });
    listJobsForAgent.mockResolvedValue([]);
    screenJobsForOwner.mockResolvedValue([{ jobId: "run_1" }]);
    listPipelineJobsForAgent.mockImplementation((_db, _agent, kind: string) =>
      Promise.resolve(kind === "enrich" ? [{ id: "job_e1" }, { id: "job_e2" }] : []),
    );
    listDecisionJobs.mockImplementation((_db, _agent, kind: string) =>
      Promise.resolve(kind === "review" ? [{ id: "job_r1" }] : []),
    );
    listMonitorJobs.mockResolvedValue([{ id: "chk_1" }]);
  });

  it("returns null from financeTriageSummary when owner is not finance-cleared", async () => {
    findUser.mockResolvedValue({ financeClearedAt: null });
    const summary = await financeTriageSummary({ agentId: "agent_1", ownerId: "owner_1", level: "manager" });
    expect(summary).toBeNull();
    expect(screenJobsForOwner).not.toHaveBeenCalled();
  });

  it("returns pending Finance pipeline counts when owner is finance-cleared", async () => {
    findUser.mockResolvedValue({ financeClearedAt: new Date("2026-11-20T00:00:00Z") });
    const summary = await financeTriageSummary({ agentId: "agent_1", ownerId: "owner_1", level: "manager" });
    expect(summary).toEqual({
      cleared: true,
      jobsUrl: "/api/v1/finance/jobs",
      totalPending: 5,
      counts: {
        screen: 1,
        enrich: 2,
        evaluate: 0,
        review: 1,
        decide: 0,
        check: 1,
        legacyReview: 0,
      },
    });
  });

  it("includes finance summary in GET /api/v1/triage for finance-cleared managers", async () => {
    findUser.mockResolvedValue({ financeClearedAt: new Date("2026-11-20T00:00:00Z") });
    const req = { nextUrl: new URL("https://ziki.dev/api/v1/triage?projectId=proj_1") } as NextRequest;
    const res = await getTriage(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.finance).toMatchObject({
      cleared: true,
      jobsUrl: "/api/v1/finance/jobs",
      totalPending: 5,
    });
  });

  it("omits finance summary from GET /api/v1/triage when owner is not finance-cleared", async () => {
    findUser.mockResolvedValue({ financeClearedAt: null });
    const req = { nextUrl: new URL("https://ziki.dev/api/v1/triage?projectId=proj_1") } as NextRequest;
    const res = await getTriage(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.finance).toBeUndefined();
  });
});

describe("FIN-AGT-CR-001: Finance v3 documentation in docs/ziki-for-agents.md and llms.txt", () => {
  const agentDocs = readFileSync("docs/ziki-for-agents.md", "utf8");
  const llmsTxt = readFileSync("llms.txt", "utf8");

  it("documents Finance v3 discovery, clearance, roles, against:true, and tiers in llms.txt", () => {
    for (const token of [
      "/api/v1/finance/jobs",
      "/api/v1/triage",
      "User.financeClearedAt",
      "working",
      "manager",
      "merger",
      "against: true",
      "Filings & official",
      "citedEvidenceIds",
    ]) {
      expect(llmsTxt).toContain(token);
    }
  });

  it("documents all Finance v3 endpoints, role rules, and rubric in docs/ziki-for-agents.md", () => {
    for (const token of [
      "## Finance v3 Research Pipeline",
      "GET /api/v1/finance/jobs",
      "POST /api/v1/finance/candidates",
      "GET /api/v1/finance/pipeline/jobs?kind=enrich|evaluate",
      "POST /api/v1/finance/pipeline/jobs/{id}/claim",
      "POST /api/v1/finance/pipeline/jobs/{id}/complete",
      "POST /api/v1/finance/pipeline/jobs/{id}/fail",
      "POST /api/v1/finance/candidates/{id}/evidence",
      "/api/v1/finance/candidates/{id}/evaluations",
      "/api/v1/finance/candidates/{id}/reviews",
      "POST /api/v1/finance/candidates/{id}/decision",
      "POST /api/v1/finance/checks/{id}",
      "against: true",
      "403 enriched_own",
      "403 role_conflict",
      "citedEvidenceIds",
      "answerAgainst",
      "reasonPoints",
      "Filings & official",
    ]) {
      expect(agentDocs).toContain(token);
    }
  });
});
