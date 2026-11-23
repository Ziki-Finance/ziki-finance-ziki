/** Run only against a separately migrated local database whose name ends in _smoke. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { recordTrade, portfolioForOwner } from "../../lib/finance/portfolio";
import { advanceCandidateReviews, decisionsForOwner, submitDecision, submitReview } from "../../lib/finance/decisions";
import { claimPipelineJob, type PipelineAgent } from "../../lib/finance/pipeline";
import { claimMonitorCheck, submitMonitorCheck } from "../../lib/finance/monitor";

async function main() {
const url = new URL(process.env.DATABASE_URL!);
if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_smoke")) throw new Error("Use a dedicated local *_smoke database, never an existing application database.");
const db = new PrismaClient();
const now = new Date();
const stamp = randomUUID().slice(0, 8);
const actor = { id: "", label: "Stream C smoke owner" };
try {
  const owner = await db.user.create({ data: { name: actor.label, email: `fnc-${stamp}@fixtures.local`, role: "super_admin" } });
  actor.id = owner.id;
  const ticker = await db.financeTicker.upsert({ where: { symbol: "AAPL" }, create: { symbol: "AAPL", name: "Apple", industry: "Technology" }, update: {} });
  const agents: PipelineAgent[] = [];
  for (let i = 0; i < 7; i++) {
    const agent = await db.agent.create({ data: { ownerUserId: owner.id, name: `FNC smoke ${stamp} agent ${i}` } });
    agents.push({ agentId: agent.id, ownerId: owner.id, level: i === 3 || i === 6 ? "merger" : "manager" });
  }
  const run = await db.financeRun.create({ data: { criteriaLabel: `Smoke test ${stamp} (not investment research)`, criteriaVersion: 1 } });
  const candidate = await db.financeCandidate.create({ data: { runId: run.id, tickerId: ticker.id, stage: "evaluate" } });
  for (let i = 0; i < 5; i++) await db.financeEvaluation.create({ data: { candidateId: candidate.id, ownerId: owner.id, agentId: `test-evaluator-${stamp}-${i}`, against: i === 0,
    call: "buy", confidence: 50, reasons: ["Synthetic smoke-test evidence only."], risks: [], changeMind: "Smoke-test fixture, not financial advice.", holdDuration: "Test only", citedEvidenceIds: ["test-source"] } });
  await advanceCandidateReviews(db, candidate.id);
  const reviewInput = { call: "go", summary: "Synthetic review for a smoke-test fixture.", answerAgainst: "Synthetic response to the smoke-test Against fixture." };
  for (let i = 0; i < 3; i++) {
    const job = await db.financePipelineJob.findFirstOrThrow({ where: { candidateId: candidate.id, kind: "review", status: "queued" } });
    await claimPipelineJob(db, agents[i], job.id, 20);
    if (i === 0) {
      const other = await db.financePipelineJob.findFirstOrThrow({ where: { candidateId: candidate.id, kind: "review", status: "queued" } });
      await assert.rejects(claimPipelineJob(db, agents[i], other.id, 20), /current Finance task/);
    }
    await submitReview(db, agents[i], candidate.id, { ...reviewInput, call: i === 2 ? "no_go" : "go" });
  }
  const decideJob = await db.financePipelineJob.findFirstOrThrow({ where: { candidateId: candidate.id, kind: "decide" } });
  await assert.rejects(claimPipelineJob(db, { ...agents[0], level: "merger" }, decideJob.id, 20), /two roles/);
  await claimPipelineJob(db, agents[3], decideJob.id, 20);
  const decisionInput = { call: "go", sentence: "Smoke-test decision only; this is not investment research.", reasons: ["Synthetic reason one.", "Synthetic reason two.", "Synthetic reason three."],
    answerAgainst: "Synthetic Against response for smoke testing.", changeMind: "Replace the synthetic fixture with actual evidence.", buyRangeLow: 90, buyRangeHigh: 110,
    reviewIfBelow: 70, holdDuration: "Test only", reasonPoints: [{ text: "Synthetic main reason remains true.", main: true }, { text: "Synthetic secondary reason remains true.", main: false }] };
  await assert.rejects(submitDecision(db, agents[3], candidate.id, decisionInput), /dissent/);
  const decision = await submitDecision(db, agents[3], candidate.id, { ...decisionInput, answerDissent: "Synthetic answer to the dissent for the smoke test." });
  assert((await decisionsForOwner(db, owner.id)).needsYou.some(d => d.id === decision.id));
  const trade = { symbol: "AAPL", side: "bought", shares: "10", price: "100", date: now.toISOString().slice(0, 10), decisionId: decision.id, requestId: randomUUID() };
  const saved = await recordTrade(db, actor, trade);
  assert.equal((await recordTrade(db, actor, trade)).id, saved.id);
  const before = await db.financeTrade.count({ where: { userId: owner.id } });
  await assert.rejects(recordTrade(db, actor, { ...trade, side: "sold", shares: "11", requestId: randomUUID() }), /exceeds/);
  assert.equal(await db.financeTrade.count({ where: { userId: owner.id } }), before);
  const yesterday = new Date(now); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  await assert.rejects(recordTrade(db, actor, { ...trade, side: "sold", shares: "1", date: yesterday.toISOString().slice(0, 10), requestId: randomUUID() }), /exceeds/);
  await recordTrade(db, actor, { ...trade, side: "sold", shares: "2", price: "125", decisionId: undefined, requestId: randomUUID() });
  const portfolio = await portfolioForOwner(db, owner.id);
  assert.equal(portfolio.positions[0].shares, "8");
  assert.equal(portfolio.positions[0].averageCost, "100");
  assert.equal((await portfolioForOwner(db, "another-person")).positions.length, 0);
  const concurrent = await Promise.allSettled([1, 2].map(() => recordTrade(db, actor, { ...trade, side: "sold", shares: "5", requestId: randomUUID() })));
  assert.equal(concurrent.filter(r => r.status === "fulfilled").length, 1);
  await assert.rejects(db.financeTrade.update({ where: { id: saved.id }, data: { price: "1" } }), /append-only/);
  await assert.rejects(db.financeTrade.delete({ where: { id: saved.id } }), /append-only/);
  const check = await db.financeCheck.findFirstOrThrow({ where: { holdingId: portfolio.positions[0].id, status: "queued" } });
  await claimMonitorCheck(db, agents[4], check.id);
  const points = await db.financeReasonPoint.findMany({ where: { holdingId: check.holdingId } });
  await submitMonitorCheck(db, agents[4], check.id, "check", { points: points.map(p => ({ reasonPointId: p.id, status: p.main ? "breaking" : "holding",
    summary: "Synthetic point status used to test the monitoring flow.", sources: ["https://example.com/stream-c-smoke"] })) });
  await assert.rejects(claimMonitorCheck(db, agents[4], check.id), /independent/);
  await claimMonitorCheck(db, agents[5], check.id);
  await submitMonitorCheck(db, agents[5], check.id, "review", { summary: "The synthetic main reason is broken; a Decider is required." });
  assert.equal((await db.financeCheck.findUniqueOrThrow({ where: { id: check.id } })).reasonStatus, "broken");
  await claimMonitorCheck(db, agents[6], check.id);
  await submitMonitorCheck(db, agents[6], check.id, "decide", { call: "trim", sentence: "Synthetic monitor decision for a smoke test.", reasons: ["The synthetic main reason broke."], changeMind: "A synthetic recovery supported by new sources." });
  assert((await decisionsForOwner(db, owner.id)).needsYou.some(d => d.call === "trim"));
  assert.equal((await decisionsForOwner(db, "another-person")).needsYou.some(d => d.checkId === check.id), false);
  const audit = await db.financeChange.findFirstOrThrow({ where: { userId: owner.id } });
  await assert.rejects(db.financeChange.update({ where: { id: audit.id }, data: { kind: "edited" } }), /append-only/);
  const otherTicker = await db.financeTicker.upsert({ where: { symbol: "MSFT" }, create: { symbol: "MSFT", name: "Microsoft" }, update: {} });
  const rejected = await db.financeCandidate.create({ data: { runId: run.id, tickerId: otherTicker.id, stage: "review", reviewSlots: 3, reviewGoRequired: 2 } });
  await db.financePipelineJob.createMany({ data: [1, 2, 3].map(() => ({ candidateId: rejected.id, kind: "review" as const })) });
  for (let i = 0; i < 3; i++) {
    const job = await db.financePipelineJob.findFirstOrThrow({ where: { candidateId: rejected.id, kind: "review", status: "queued" } });
    await claimPipelineJob(db, agents[i], job.id, 20);
    await submitReview(db, agents[i], rejected.id, { ...reviewInput, call: i === 0 ? "go" : "no_go" });
  }
  assert.equal(await db.financePipelineJob.count({ where: { candidateId: rejected.id, kind: "decide" } }), 0);
  const groups = await decisionsForOwner(db, owner.id);
  assert(groups.notNow.some(d => d.candidateId === rejected.id));
  assert(!groups.needsYou.some(d => d.candidateId === rejected.id));
  console.log("Stream C smoke passed: quorum/split/independence, idempotent trades, rollback on oversell, computed private holdings, immutable SQL history, and independent monitor-to-Trim flow.");
} finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
