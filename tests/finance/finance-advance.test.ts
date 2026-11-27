import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { advanceEnrichedCandidate, advanceScreenedCandidate, sweepEarlyStages } from "@/lib/finance/advance";
import { enrichmentReadyToAdvance } from "@/lib/finance/pipeline";
import { DEFAULT_PIPELINE_SETTINGS } from "@/lib/finance/pipeline-settings";

const now = new Date("2026-11-27T12:00:00.000Z");
const complete = [
  { section: "business" as const, tier: 1 },
  { section: "numbers" as const, tier: 2 },
  { section: "filings" as const, tier: 1 },
  { section: "news" as const, tier: 2 },
  { section: "market_context" as const, tier: 2 },
];

describe("enrichment ends on a complete dossier or the time limit (PRD §4.3)", () => {
  it("moves on as soon as every required section has a tier 1–2 item", () => {
    expect(enrichmentReadyToAdvance({ items: complete, enrichOpenedAt: now, timeLimitMinutes: 20, now })).toBe(true);
  });
  it("waits while the dossier is incomplete and the limit hasn't passed", () => {
    const opened = new Date(now.getTime() - 10 * 60_000);
    expect(enrichmentReadyToAdvance({ items: complete.slice(0, 2), enrichOpenedAt: opened, timeLimitMinutes: 20, now })).toBe(false);
  });
  it("moves on at the time limit with at least one item", () => {
    const opened = new Date(now.getTime() - 20 * 60_000);
    expect(enrichmentReadyToAdvance({ items: complete.slice(0, 1), enrichOpenedAt: opened, timeLimitMinutes: 20, now })).toBe(true);
  });
  it("never moves an empty dossier on by time: evaluators must cite something", () => {
    const opened = new Date(now.getTime() - 999 * 60_000);
    expect(enrichmentReadyToAdvance({ items: [], enrichOpenedAt: opened, timeLimitMinutes: 20, now })).toBe(false);
  });
});

type Candidate = {
  id: string;
  stage: string;
  screenStage: string;
  tickerId: string | null;
  tickerSymbol: string | null;
  companyName: string | null;
  evidence: { section: string; tier: number }[];
};
type Job = { candidateId: string; kind: string; status: string; createdAt: Date; leaseUntil: Date | null };

/** Just enough of Prisma for the hand-offs, held in memory. */
function fakeDb(candidates: Candidate[], jobs: Job[] = []) {
  const tickers: { id: string; symbol: string; name: string }[] = [];
  const matches = (job: Job, where: { candidateId?: string; kind?: string; status?: { in: string[] } }) =>
    (!where.candidateId || job.candidateId === where.candidateId) &&
    (!where.kind || job.kind === where.kind) &&
    (!where.status || where.status.in.includes(job.status));
  const tx = {
    $executeRaw: async () => 0,
    // No saved row: the defaults apply.
    financeSettings: { findUnique: async () => null },
    financeCandidate: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const c = candidates.find((x) => x.id === where.id);
        if (!c) return null;
        const enrichJobs = jobs.filter((j) => j.candidateId === c.id && j.kind === "enrich").sort((a, b) => +a.createdAt - +b.createdAt);
        return { ...c, jobs: enrichJobs.slice(0, 1) };
      },
      findMany: async ({ where }: { where: { stage: string; screenStage?: string } }) =>
        candidates.filter((c) => c.stage === where.stage && (!where.screenStage || c.screenStage === where.screenStage)),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Candidate> }) => {
        const c = candidates.find((x) => x.id === where.id)!;
        Object.assign(c, data);
        return c;
      },
    },
    financeTicker: {
      upsert: async ({ where, create }: { where: { symbol: string }; create: { symbol: string; name: string } }) => {
        let t = tickers.find((x) => x.symbol === where.symbol);
        if (!t) tickers.push((t = { id: `t-${create.symbol}`, ...create }));
        return t;
      },
    },
    financePipelineJob: {
      count: async ({ where }: { where: Parameters<typeof matches>[1] }) => jobs.filter((j) => matches(j, where)).length,
      createMany: async ({ data }: { data: { candidateId: string; kind: string }[] }) => {
        for (const d of data) jobs.push({ ...d, status: "queued", createdAt: now, leaseUntil: null });
        return { count: data.length };
      },
      updateMany: async ({ where, data }: { where: Parameters<typeof matches>[1]; data: Partial<Job> }) => {
        const hit = jobs.filter((j) => matches(j, where));
        for (const j of hit) Object.assign(j, data);
        return { count: hit.length };
      },
    },
  };
  const db = { ...tx, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } as unknown as PrismaClient;
  return { db, candidates, jobs, tickers };
}

const screened = (over: Partial<Candidate> = {}): Candidate => ({
  id: "c1",
  stage: "screen",
  screenStage: "issue",
  tickerId: null,
  tickerSymbol: "AAPL",
  companyName: "Apple Inc.",
  evidence: [],
  ...over,
});

describe("Screen → Enrich hand-off", () => {
  it("moves a confirmed match into Enrich, links its ticker and opens the enrichment slots", async () => {
    const f = fakeDb([screened()]);
    expect(await advanceScreenedCandidate(f.db, "c1", DEFAULT_PIPELINE_SETTINGS, now)).toBe(true);
    expect(f.candidates[0]).toMatchObject({ stage: "enrich", tickerId: "t-AAPL" });
    expect(f.tickers).toEqual([{ id: "t-AAPL", symbol: "AAPL", name: "Apple Inc." }]);
    expect(f.jobs.filter((j) => j.kind === "enrich")).toHaveLength(DEFAULT_PIPELINE_SETTINGS.researchersEnrich);
  });
  it("leaves a stock that hasn't met the screening rule, or was dropped, where it is", async () => {
    const f = fakeDb([screened({ screenStage: "proposed" }), screened({ id: "c2", screenStage: "dropped" })]);
    expect(await advanceScreenedCandidate(f.db, "c1", DEFAULT_PIPELINE_SETTINGS, now)).toBe(false);
    expect(await advanceScreenedCandidate(f.db, "c2", DEFAULT_PIPELINE_SETTINGS, now)).toBe(false);
    expect(f.jobs).toHaveLength(0);
  });
  it("is idempotent: a second call opens no more slots", async () => {
    const f = fakeDb([screened()]);
    await advanceScreenedCandidate(f.db, "c1", DEFAULT_PIPELINE_SETTINGS, now);
    expect(await advanceScreenedCandidate(f.db, "c1", DEFAULT_PIPELINE_SETTINGS, now)).toBe(false);
    expect(f.jobs).toHaveLength(DEFAULT_PIPELINE_SETTINGS.researchersEnrich);
  });
});

describe("Enrich → Evaluate hand-off", () => {
  it("closes enrichment and opens the evaluation slots once the dossier is complete", async () => {
    const f = fakeDb(
      [screened({ stage: "enrich", tickerId: "t-AAPL", evidence: complete })],
      [{ candidateId: "c1", kind: "enrich", status: "running", createdAt: now, leaseUntil: now }],
    );
    expect(await advanceEnrichedCandidate(f.db, "c1", DEFAULT_PIPELINE_SETTINGS, now)).toBe(true);
    expect(f.candidates[0].stage).toBe("evaluate");
    expect(f.jobs.find((j) => j.kind === "enrich")).toMatchObject({ status: "done", leaseUntil: null });
    expect(f.jobs.filter((j) => j.kind === "evaluate")).toHaveLength(DEFAULT_PIPELINE_SETTINGS.researchersEvaluate);
  });
  it("keeps an incomplete dossier in Enrich", async () => {
    const f = fakeDb(
      [screened({ stage: "enrich", evidence: complete.slice(0, 1) })],
      [{ candidateId: "c1", kind: "enrich", status: "queued", createdAt: now, leaseUntil: null }],
    );
    expect(await advanceEnrichedCandidate(f.db, "c1", DEFAULT_PIPELINE_SETTINGS, now)).toBe(false);
    expect(f.candidates[0].stage).toBe("enrich");
  });
});

describe("the sweep retries missed hand-offs", () => {
  it("carries a stranded confirmed match through Screen and, when complete, on to Evaluate", async () => {
    const f = fakeDb([screened(), screened({ id: "c2", tickerSymbol: "MSFT", stage: "enrich", evidence: complete })]);
    expect(await sweepEarlyStages(f.db, now)).toEqual({ toEnrich: 1, toEvaluate: 1 });
    expect(f.candidates.map((c) => c.stage)).toEqual(["enrich", "evaluate"]);
  });
});
