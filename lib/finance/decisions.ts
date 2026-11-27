import type { PrismaClient } from "@prisma/client";
import { FinancePipelineError, type PipelineAgent } from "./pipeline";
import { readPipelineSettings } from "./pipeline-settings";
import { assertDeciderVerdict, decisionBodySchema, reviewBodySchema, reviewOutcome } from "./decision-rules";
import { financeLock, logChange, type FinanceTx } from "./portfolio";

export async function agentActor(tx: FinanceTx, agentId: string) {
  const agent = await tx.agent.findUnique({ where: { id: agentId }, select: { name: true } });
  return { id: agentId, label: agent?.name ?? `Agent ${agentId}` };
}
export async function requireHeldStage(tx: FinanceTx, agentId: string, candidateId: string, kind: "review" | "decide", now: Date) {
  const job = await tx.financePipelineJob.findFirst({ where: { candidateId, kind, status: "running", claimedByAgentId: agentId, leaseUntil: { gt: now } } });
  if (!job) throw new FinancePipelineError(409, "not_holder", "Claim a live job for this stage before submitting.");
  return job;
}

/** Reconciliation is also called by cron: a failed HTTP response cannot strand a stock. */
export async function advanceCandidateReviews(db: PrismaClient, candidateId: string) {
  const settings = await readPipelineSettings(db);
  return db.$transaction(async tx => {
    await financeLock(tx, `finance:candidate:${candidateId}`);
    const candidate = await tx.financeCandidate.findUnique({ where: { id: candidateId }, include: { evaluations: true } });
    if (!candidate || candidate.stage !== "evaluate" || candidate.evaluations.length < settings.researchersEvaluate
      || !candidate.evaluations.some(e => e.against)) return false;
    await tx.financeCandidate.update({ where: { id: candidateId }, data: { stage: "review", reviewSlots: settings.reviewersPerStock, reviewGoRequired: settings.reviewersWhoMustAgree } });
    await tx.financePipelineJob.updateMany({ where: { candidateId, kind: "evaluate", status: { in: ["running", "queued"] } }, data: { status: "done", leaseUntil: null } });
    await tx.financePipelineJob.createMany({ data: Array.from({ length: settings.reviewersPerStock }, () => ({ candidateId, kind: "review" as const })) });
    return true;
  });
}

async function assertIndependent(tx: FinanceTx, candidateId: string, agentId: string) {
  const [evidence, evaluations] = await Promise.all([
    tx.financeEvidence.count({ where: { candidateId, agentId } }), tx.financeEvaluation.count({ where: { candidateId, agentId } }),
  ]);
  if (evidence || evaluations) throw new FinancePipelineError(403, "role_conflict", "An agent cannot do two roles on the same stock and run.");
}

export async function submitReview(db: PrismaClient, agent: PipelineAgent, candidateId: string, raw: unknown, now = new Date()) {
  if (agent.level !== "manager" && agent.level !== "merger") throw new FinancePipelineError(403, "manager_required", "Review needs a manager-class agent.");
  const input = reviewBodySchema.parse(raw);
  return db.$transaction(async tx => {
    await financeLock(tx, `finance:agent:${agent.agentId}`);
    await financeLock(tx, `finance:candidate:${candidateId}`);
    const candidate = await tx.financeCandidate.findUnique({ where: { id: candidateId }, include: { reviews: true } });
    if (!candidate || !candidate.tickerId || candidate.stage !== "review" || !candidate.reviewSlots || !candidate.reviewGoRequired) throw new FinancePipelineError(409, "not_reviewing", "This stock is not accepting reviews.");
    await assertIndependent(tx, candidateId, agent.agentId);
    if (candidate.reviews.some(r => r.agentId === agent.agentId)) throw new FinancePipelineError(409, "already_reviewed", "You already reviewed this stock.");
    const job = await requireHeldStage(tx, agent.agentId, candidateId, "review", now);
    const actor = await agentActor(tx, agent.agentId);
    const review = await tx.financeReview.create({ data: { candidateId, agentId: agent.agentId, actorLabel: actor.label, ...input } });
    await tx.financePipelineJob.update({ where: { id: job.id }, data: { status: "done", leaseUntil: null } });
    const votes = [...candidate.reviews, review];
    const outcome = reviewOutcome(votes, candidate.reviewSlots, candidate.reviewGoRequired);
    if (outcome.complete) {
      await tx.financeCandidate.update({ where: { id: candidateId }, data: { stage: outcome.passed ? "decide" : "done" } });
      if (outcome.passed) await tx.financePipelineJob.create({ data: { candidateId, kind: "decide" } });
      else {
        const decision = await tx.financeDecision.create({ data: {
          candidateId, tickerId: candidate.tickerId, call: "no_go", origin: "review", actorLabel: "Reviewer quorum",
          sentence: `No-go: ${outcome.go} of ${outcome.total} reviewers support this stock; ${candidate.reviewGoRequired} are required.`,
          reasons: votes.map(v => v.summary), answerAgainst: votes.map(v => v.answerAgainst).join("\n"), changeMind: "A new research run with new evidence and a passing review.",
          reviewGo: outcome.go, reviewTotal: outcome.total,
        } });
        await logChange(tx, { tickerId: candidate.tickerId, kind: "decision", actor, detail: { decisionId: decision.id, candidateId, call: "no_go", source: "review", go: outcome.go, total: outcome.total } });
      }
    }
    return review;
  });
}

export async function submitDecision(db: PrismaClient, agent: PipelineAgent, candidateId: string, raw: unknown, now = new Date()) {
  if (agent.level !== "merger") throw new FinancePipelineError(403, "merger_required", "The Decider must be a merger-class agent.");
  const input = decisionBodySchema.parse(raw);
  return db.$transaction(async tx => {
    await financeLock(tx, `finance:agent:${agent.agentId}`);
    await financeLock(tx, `finance:candidate:${candidateId}`);
    const candidate = await tx.financeCandidate.findUnique({ where: { id: candidateId }, include: { reviews: true, ticker: true } });
    if (!candidate || !candidate.tickerId || !candidate.ticker || candidate.stage !== "decide" || !candidate.reviewSlots || !candidate.reviewGoRequired) throw new FinancePipelineError(409, "not_deciding", "This stock has not passed review.");
    await assertIndependent(tx, candidateId, agent.agentId);
    if (candidate.reviews.some(r => r.agentId === agent.agentId)) throw new FinancePipelineError(403, "role_conflict", "The Decider cannot have reviewed this stock.");
    let outcome;
    try { outcome = assertDeciderVerdict(input, candidate.reviews, candidate.reviewSlots, candidate.reviewGoRequired); }
    catch (error) { throw new FinancePipelineError(400, "invalid_decision", (error as Error).message); }
    const job = await requireHeldStage(tx, agent.agentId, candidateId, "decide", now);
    const actor = await agentActor(tx, agent.agentId);
    const decision = await tx.financeDecision.create({ data: { candidateId, tickerId: candidate.tickerId, agentId: agent.agentId,
      actorLabel: actor.label, origin: "decider", reviewGo: outcome.go, reviewTotal: outcome.total, ...input } });
    await tx.financeCandidate.update({ where: { id: candidateId }, data: { stage: "done" } });
    await tx.financePipelineJob.update({ where: { id: job.id }, data: { status: "done", leaseUntil: null } });
    await logChange(tx, { tickerId: candidate.tickerId, kind: "decision", actor, detail: { decisionId: decision.id, candidateId, call: input.call, go: outcome.go, total: outcome.total } });
    if (input.call === "go") {
      const symbol = candidate.ticker.symbol;
      const owners = await tx.user.findMany({ where: { role: "super_admin" }, select: { id: true } });
      await tx.notification.createMany({ data: owners.map(owner => ({ userId: owner.id, kind: "finance_decision", title: `${symbol}: ${input.sentence}`, url: `/finance/${encodeURIComponent(symbol)}` })) });
    }
    return decision;
  });
}

export async function decisionsForOwner(db: PrismaClient, userId: string) {
  const decisions = await db.financeDecision.findMany({ where: { OR: [{ candidateId: { not: null } }, { check: { holding: { userId } } }] }, orderBy: { createdAt: "desc" }, take: 100,
    include: { ticker: true, candidate: { select: { runId: true } }, actions: { where: { userId }, orderBy: { createdAt: "desc" }, take: 1 } } });
  const seen = new Set<string>();
  const latest = decisions.filter(d => { if (seen.has(d.tickerId)) return false; seen.add(d.tickerId); return true; });
  return {
    needsYou: latest.filter(d => ["go", "keep", "trim", "sell"].includes(d.call) && d.actions.length === 0),
    notNow: latest.filter(d => d.call === "no_go" || d.actions.length > 0),
  };
}

export async function listDecisionJobs(db: PrismaClient, agent: PipelineAgent, kind: "review" | "decide", now = new Date()) {
  if ((kind === "decide" && agent.level !== "merger") || (kind === "review" && agent.level !== "manager" && agent.level !== "merger")) return [];
  const jobs = await db.financePipelineJob.findMany({ where: { kind, candidate: { stage: kind }, OR: [
    { status: "queued", nextRunAt: { lte: now } }, { status: "running", leaseUntil: { lte: now } },
  ] }, orderBy: { createdAt: "asc" }, take: 50,
    select: { id: true, kind: true, attempts: true, maxAttempts: true, candidate: { select: { id: true,
      ticker: { select: { symbol: true, name: true } },
      evidence: { where: { agentId: agent.agentId }, select: { id: true } },
      evaluations: { where: { agentId: agent.agentId }, select: { id: true } },
      reviews: { where: { agentId: agent.agentId }, select: { id: true } },
    } } } });
  return jobs.filter(j => j.attempts < j.maxAttempts && !j.candidate.evidence.length && !j.candidate.evaluations.length && !j.candidate.reviews.length)
    .map(j => ({ id: j.id, kind: j.kind, candidate: { id: j.candidate.id, ticker: j.candidate.ticker } }));
}

export async function decisionContext(db: PrismaClient, agent: PipelineAgent, candidateId: string, now = new Date()) {
  const claim = await db.financePipelineJob.findFirst({ where: { candidateId, kind: { in: ["review", "decide"] }, status: "running", claimedByAgentId: agent.agentId, leaseUntil: { gt: now } } });
  if (!claim) throw new FinancePipelineError(403, "claim_required", "Claim a review or decision job to read its context.");
  return db.financeCandidate.findUnique({ where: { id: candidateId }, select: { id: true, reviewSlots: true, reviewGoRequired: true,
    run: { select: { criteriaLabel: true, criteriaVersion: true } }, ticker: { select: { symbol: true, name: true } },
    evidence: { select: { id: true, summary: true, section: true, url: true, tier: true, codeChecked: true } },
    evaluations: { select: { call: true, against: true, reasons: true, risks: true, changeMind: true, citedEvidenceIds: true, confidence: true } },
    reviews: claim.kind === "decide" ? { select: { call: true, summary: true, answerAgainst: true, actorLabel: true } } : false,
  } });
}
