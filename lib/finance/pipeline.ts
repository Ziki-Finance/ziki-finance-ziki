import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { marketData } from "./market-data";
import {
  REQUIRED_SECTIONS,
  type FinanceDossierCaps,
  type FinanceEvidenceSectionName,
  type PipelineSettingsValues,
} from "./pipeline-settings";

/**
 * Ziki Finance v3 Stream B: the dossier, the evaluations and the retryable
 * jobs that drive them (PRD §4.3–4.4, §6, §7). Nothing here reads a person's
 * holdings; agents only ever see a ticker and a candidate.
 */

type Db = PrismaClient;

export class FinancePipelineError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type PipelineAgent = { agentId: string; ownerId: string };

export const SOURCE_TIER_LABEL: Record<number, string> = {
  1: "Filings & official",
  2: "Major financial news",
  3: "Other news & analysis",
  4: "Social",
};

/** "Buy", "Hold", "Don't buy". */
export const EVAL_CALL_LABEL: Record<"buy" | "hold" | "dont_buy", string> = {
  buy: "Buy",
  hold: "Hold",
  dont_buy: "Don't buy",
};

// ---------------------------------------------------------------------------
// Pure rules (kept free of the database so they can be unit-tested)
// ---------------------------------------------------------------------------

/** Exponential backoff: 2, 4, 8, … minutes, capped at 60 (PRD job 6). */
export function backoffMinutes(attempts: number): number {
  const exp = Math.max(1, Math.min(attempts, 6));
  return Math.min(60, 2 ** exp);
}

export function nextRetryAt(now: Date, attempts: number): Date {
  return new Date(now.getTime() + backoffMinutes(attempts) * 60_000);
}

/** A section is full once its non-duplicate item count reaches the staff cap. */
export function sectionIsCapped(section: FinanceEvidenceSectionName, count: number, caps: FinanceDossierCaps): boolean {
  const cap = caps[section];
  return typeof cap === "number" && count >= cap;
}

/** Enrichment is done when every required section has a tier 1–2 item. */
export function isEnrichmentComplete(items: readonly { section: FinanceEvidenceSectionName; tier: number }[]): boolean {
  return REQUIRED_SECTIONS.every((section) => items.some((item) => item.section === section && item.tier <= 2));
}

export type SectionStatus = {
  section: FinanceEvidenceSectionName;
  items: number;
  tierOneOrTwo: number;
  done: boolean;
};

export function sectionStatuses(items: readonly { section: FinanceEvidenceSectionName; tier: number }[]): SectionStatus[] {
  const sections: FinanceEvidenceSectionName[] = ["business", "numbers", "filings", "news", "social", "market_context"];
  return sections.map((section) => {
    const inSection = items.filter((item) => item.section === section);
    const tierOneOrTwo = inSection.filter((item) => item.tier <= 2).length;
    return {
      section,
      items: inSection.length,
      tierOneOrTwo,
      done: !REQUIRED_SECTIONS.includes(section) || tierOneOrTwo > 0,
    };
  });
}

export type ScoreBreakdown = {
  total: number;
  buy: number;
  hold: number;
  dontBuy: number;
  against: number;
  /** Mean confidence, rounded; null with no evaluations. Confidence is shown, never used to decide. */
  averageConfidence: number | null;
};

export function scoreBreakdown(
  evaluations: readonly { call: "buy" | "hold" | "dont_buy"; confidence: number; against: boolean }[],
): ScoreBreakdown {
  const buy = evaluations.filter((e) => e.call === "buy").length;
  const hold = evaluations.filter((e) => e.call === "hold").length;
  const dontBuy = evaluations.filter((e) => e.call === "dont_buy").length;
  const against = evaluations.filter((e) => e.against).length;
  const averageConfidence =
    evaluations.length === 0 ? null : Math.round(evaluations.reduce((sum, e) => sum + e.confidence, 0) / evaluations.length);
  return { total: evaluations.length, buy, hold, dontBuy, against, averageConfidence };
}

/** The single verdict line for the UI: Buy when most say Buy, Don't buy when
 * most say no, else Hold. A tie reads Hold. Confidence never votes. */
export function overallVerdict(breakdown: ScoreBreakdown): "buy" | "hold" | "dont_buy" {
  if (breakdown.total === 0) return "hold";
  if (breakdown.buy > breakdown.hold && breakdown.buy > breakdown.dontBuy) return "buy";
  if (breakdown.dontBuy > breakdown.buy && breakdown.dontBuy > breakdown.hold) return "dont_buy";
  return "hold";
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Sources must be http(s) links.");

export const evidenceBodySchema = z.object({
  section: z.enum(["business", "numbers", "filings", "news", "social", "market_context"]),
  summary: z.string().trim().min(10).max(600),
  url: httpUrl,
  /** ISO timestamp of when the agent read it; defaults to now. */
  readAt: z.string().datetime().optional(),
  tier: z.number().int().min(1).max(4),
  /** A figure Finnhub also publishes, compared automatically (PRD §4.3). */
  figure: z
    .object({
      kind: z.enum(["price"]),
      value: z.number().finite().positive(),
    })
    .optional(),
});

export type EvidenceInput = z.infer<typeof evidenceBodySchema>;

export const evaluationBodySchema = z.object({
  call: z.enum(["buy", "hold", "dont_buy"]),
  confidence: z.number().int().min(0).max(100),
  reasons: z.array(z.string().trim().min(5).max(300)).min(1).max(5),
  risks: z.array(z.string().trim().min(5).max(300)).max(5).default([]),
  changeMind: z.string().trim().min(10).max(1000),
  buyRangeLow: z.number().finite().nonnegative().optional(),
  buyRangeHigh: z.number().finite().nonnegative().optional(),
  reviewIfBelow: z.number().finite().nonnegative().optional(),
  holdDuration: z.string().trim().min(1).max(100),
  /** No citations means refused (PRD §4.4). */
  citedEvidenceIds: z.array(z.string().trim().min(1)).min(1).max(50),
  against: z.boolean().default(false),
});

export type EvaluationInput = z.infer<typeof evaluationBodySchema>;

// ---------------------------------------------------------------------------
// Enrichment: dossier items
// ---------------------------------------------------------------------------

/** Compare a figure the agent read against Finnhub's free data. */
async function checkFigure(symbol: string, figure: EvidenceInput["figure"]): Promise<{ checked: boolean; note: string | null }> {
  if (!figure || figure.kind !== "price") return { checked: false, note: null };
  try {
    const bar = await marketData().latestBar(symbol);
    if (!bar || bar.close == null) return { checked: false, note: "Finnhub had no price to check against." };
    const difference = Math.abs(bar.close - figure.value) / bar.close;
    if (difference <= 0.01) return { checked: true, note: `Matches Finnhub's close within 1% ($${bar.close.toFixed(2)}).` };
    return { checked: false, note: `Does not match Finnhub's close ($${bar.close.toFixed(2)}).` };
  } catch {
    return { checked: false, note: "Finnhub check failed; the item was kept unverified." };
  }
}

/**
 * Add a dossier item. A duplicate URL on the same candidate merges into the
 * existing item. A section at its staff cap refuses a new URL.
 */
export async function addEvidence(
  db: Db,
  agent: PipelineAgent,
  candidateId: string,
  input: EvidenceInput,
  settings: PipelineSettingsValues,
  now = new Date(),
): Promise<{ id: string; merged: boolean; codeChecked: boolean; codeCheckNote: string | null }> {
  const candidate = await db.financeCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, ticker: { select: { symbol: true } } },
  });
  if (!candidate) throw new FinancePipelineError(404, "not_found", "No such candidate.");

  const existing = await db.financeEvidence.findUnique({
    where: { candidateId_url: { candidateId, url: input.url } },
    select: { id: true },
  });

  if (!existing) {
    const count = await db.financeEvidence.count({ where: { candidateId, section: input.section } });
    if (sectionIsCapped(input.section, count, settings.dossierCaps)) {
      throw new FinancePipelineError(409, "section_capped", "That section already has all the items it may hold.");
    }
  }

  const { checked, note } = await checkFigure(candidate.ticker.symbol, input.figure);
  const data = {
    section: input.section,
    summary: input.summary,
    readAt: input.readAt ? new Date(input.readAt) : now,
    tier: input.tier,
    codeChecked: checked,
    codeCheckNote: note,
    agentId: agent.agentId,
    ownerId: agent.ownerId,
  };

  if (existing) {
    await db.financeEvidence.update({ where: { id: existing.id }, data });
    return { id: existing.id, merged: true, codeChecked: checked, codeCheckNote: note };
  }
  const created = await db.financeEvidence.create({
    data: { candidateId, url: input.url, ...data },
    select: { id: true },
  });
  return { id: created.id, merged: false, codeChecked: checked, codeCheckNote: note };
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Record one evaluator's verdict. Refused when it cites no dossier item of the
 * candidate, when the same agent enriched it (one agent never does two roles on
 * the same stock, FIN-D-031), or when a second Against evaluation is attempted.
 */
export async function submitEvaluation(
  db: Db,
  agent: PipelineAgent,
  candidateId: string,
  input: EvaluationInput,
  now = new Date(),
) {
  const candidate = await db.financeCandidate.findUnique({ where: { id: candidateId }, select: { id: true } });
  if (!candidate) throw new FinancePipelineError(404, "not_found", "No such candidate.");

  const enriched = await db.financeEvidence.count({ where: { candidateId, agentId: agent.agentId } });
  if (enriched > 0) {
    throw new FinancePipelineError(403, "enriched_own", "An agent that enriched a stock can't evaluate it.");
  }

  const cited = await db.financeEvidence.findMany({
    where: { candidateId, id: { in: input.citedEvidenceIds } },
    select: { id: true },
  });
  if (cited.length === 0) {
    throw new FinancePipelineError(400, "no_citations", "An evaluation with no cited dossier items is refused.");
  }

  if (input.against) {
    const other = await db.financeEvaluation.count({ where: { candidateId, against: true } });
    if (other > 0) throw new FinancePipelineError(409, "against_taken", "This candidate already has an Against evaluator.");
  }

  try {
    return await db.financeEvaluation.create({
      data: {
        candidateId,
        agentId: agent.agentId,
        ownerId: agent.ownerId,
        against: input.against,
        call: input.call,
        confidence: input.confidence,
        reasons: input.reasons,
        risks: input.risks,
        changeMind: input.changeMind,
        buyRangeLow: input.buyRangeLow ?? null,
        buyRangeHigh: input.buyRangeHigh ?? null,
        reviewIfBelow: input.reviewIfBelow ?? null,
        holdDuration: input.holdDuration,
        citedEvidenceIds: cited.map((c) => c.id),
        createdAt: now,
      },
      select: { id: true, createdAt: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FinancePipelineError(409, "already_evaluated", "You already evaluated this candidate.");
    }
    throw error;
  }
}

/**
 * An evaluator can't see the other evaluations until it submits its own
 * (PRD §4.4). This returns only the agent's own evaluation, or all of them once
 * the agent has one in.
 */
export async function listEvaluationsForAgent(db: Db, agent: PipelineAgent, candidateId: string) {
  const own = await db.financeEvaluation.findFirst({ where: { candidateId, agentId: agent.agentId }, select: { id: true } });
  return db.financeEvaluation.findMany({
    where: own ? { candidateId } : { candidateId, agentId: agent.agentId },
    orderBy: { createdAt: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Pipeline jobs (enrich / evaluate), with retry and backoff
// ---------------------------------------------------------------------------

/** Create the stage's slots when none is pending yet, so a rerun doesn't double them. */
export async function queuePipelineJobs(
  db: Db,
  candidateId: string,
  kind: "enrich" | "evaluate",
  count: number,
  now = new Date(),
): Promise<number> {
  const pending = await db.financePipelineJob.count({
    where: { candidateId, kind, status: { in: ["queued", "running"] } },
  });
  if (pending > 0) return 0;
  const made = await db.financePipelineJob.createMany({
    data: Array.from({ length: Math.max(1, count) }, () => ({ candidateId, kind, nextRunAt: now })),
  });
  return made.count;
}

/** Jobs this agent may claim now: queued and due, or running with a lapsed lease. */
export async function listPipelineJobsForAgent(
  db: Db,
  agent: PipelineAgent,
  kind: "enrich" | "evaluate",
  now = new Date(),
  limit = 5,
) {
  const jobs = await db.financePipelineJob.findMany({
    where: {
      kind,
      OR: [
        { status: "queued", nextRunAt: { lte: now } },
        { status: "running", leaseUntil: { lt: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      attempts: true,
      maxAttempts: true,
      candidate: {
        select: {
          id: true,
          stage: true,
          ticker: { select: { symbol: true, name: true, type: true, exchange: true } },
          _count: { select: { evidence: true, evaluations: true } },
        },
      },
    },
  });
  if (kind !== "evaluate") return jobs.filter((job) => job.attempts < job.maxAttempts);
  // An agent that evaluated (or enriched) a candidate doesn't see its evaluate job again.
  const done = await db.financeEvaluation.findMany({
    where: { agentId: agent.agentId, candidateId: { in: jobs.map((j) => j.candidate.id) } },
    select: { candidateId: true },
  });
  const skip = new Set(done.map((d) => d.candidateId));
  return jobs.filter((job) => !skip.has(job.candidate.id) && job.attempts < job.maxAttempts);
}

/** Atomically claim a job for this agent. A lapsed lease lets another agent retry. */
export async function claimPipelineJob(db: Db, agent: PipelineAgent, jobId: string, leaseMinutes: number, now = new Date()) {
  const claimed = await db.financePipelineJob.updateMany({
    where: {
      id: jobId,
      OR: [
        { status: "queued", nextRunAt: { lte: now } },
        { status: "running", leaseUntil: { lt: now } },
      ],
    },
    data: {
      status: "running",
      claimedByAgentId: agent.agentId,
      leaseUntil: new Date(now.getTime() + Math.max(1, leaseMinutes) * 60_000),
      attempts: { increment: 1 },
    },
  });
  if (claimed.count === 0) throw new FinancePipelineError(409, "not_available", "This job is held by another agent or not due yet.");
  const job = await db.financePipelineJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.attempts > job.maxAttempts) {
    // The lease kept lapsing, so the job never reported a failure. Give up now.
    await db.financePipelineJob.update({
      where: { id: job.id },
      data: { status: "failed", lastError: job.lastError ?? "Gave up after the attempt limit.", leaseUntil: null },
    });
    throw new FinancePipelineError(409, "attempts_exhausted", "This job has reached its attempt limit.");
  }
  return job;
}

/** Mark a claimed job done. Only the agent holding it may. */
export async function completePipelineJob(db: Db, agent: PipelineAgent, jobId: string): Promise<void> {
  const done = await db.financePipelineJob.updateMany({
    where: { id: jobId, claimedByAgentId: agent.agentId, status: "running" },
    data: { status: "done", leaseUntil: null },
  });
  if (done.count === 0) throw new FinancePipelineError(409, "not_holder", "You don't hold this job.");
}

/** Record a failure: retry with backoff until maxAttempts, then fail. */
export async function failPipelineJob(
  db: Db,
  agent: PipelineAgent,
  jobId: string,
  error: string,
  now = new Date(),
): Promise<{ status: "queued" | "failed"; nextRunAt: Date | null }> {
  const job = await db.financePipelineJob.findUnique({
    where: { id: jobId },
    select: { id: true, attempts: true, maxAttempts: true, claimedByAgentId: true },
  });
  if (!job) throw new FinancePipelineError(404, "not_found", "No such job.");
  if (job.claimedByAgentId !== agent.agentId) throw new FinancePipelineError(409, "not_holder", "You don't hold this job.");

  if (job.attempts >= job.maxAttempts) {
    await db.financePipelineJob.update({ where: { id: job.id }, data: { status: "failed", lastError: error, leaseUntil: null } });
    return { status: "failed", nextRunAt: null };
  }
  const nextRunAt = nextRetryAt(now, job.attempts);
  await db.financePipelineJob.update({
    where: { id: job.id },
    data: { status: "queued", lastError: error, nextRunAt, claimedByAgentId: null, leaseUntil: null },
  });
  return { status: "queued", nextRunAt };
}

// ---------------------------------------------------------------------------
// What the UI reads
// ---------------------------------------------------------------------------

/** The latest candidate for a ticker, with its dossier and evaluations. */
export async function candidateForTicker(db: Db, symbol: string) {
  const ticker = await db.financeTicker.findUnique({ where: { symbol }, select: { id: true, symbol: true, name: true, exchange: true, type: true } });
  if (!ticker) return null;
  const candidate = await db.financeCandidate.findFirst({
    where: { tickerId: ticker.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      stage: true,
      proposedCount: true,
      codeCheck: true,
      createdAt: true,
      run: { select: { id: true, criteriaLabel: true, criteriaVersion: true } },
      evidence: { orderBy: [{ section: "asc" }, { tier: "asc" }, { readAt: "desc" }] },
      evaluations: { orderBy: { createdAt: "asc" } },
    },
  });
  return { ticker, candidate };
}

/** Every candidate in a run, for the Finance page's pipeline list. */
export async function runCandidates(db: Db, runId: string) {
  return db.financeCandidate.findMany({
    where: { runId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      stage: true,
      ticker: { select: { symbol: true, name: true } },
      evaluations: { select: { call: true, confidence: true, against: true } },
      _count: { select: { evidence: true } },
    },
  });
}
