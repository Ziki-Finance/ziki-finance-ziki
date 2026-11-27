import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { FinancePipelineError, type PipelineAgent } from "./pipeline";
import { financeLock, logChange, type FinanceActor } from "./portfolio";
import { agentActor } from "./decisions";
import { reasonStatus, nextWeeklyCheck } from "./decision-rules";
import { readPipelineSettings } from "./pipeline-settings";
import { marketData } from "./market-data";

const httpUrl = z.url().max(2048).refine(s => /^https?:\/\//i.test(s));
export const checkResultsSchema = z.object({ points: z.array(z.object({
  reasonPointId: z.string().min(1).optional(), text: z.string().trim().min(5).max(500).optional(), main: z.boolean().optional(),
  status: z.enum(["holding", "breaking"]), summary: z.string().trim().min(10).max(1500), sources: z.array(httpUrl).min(1).max(10),
})).min(2).max(4) });
export const monitorDecisionSchema = z.object({ call: z.enum(["keep", "trim", "sell"]), sentence: z.string().trim().min(10).max(500),
  reasons: z.array(z.string().trim().min(5).max(500)).min(1).max(5), changeMind: z.string().trim().min(10).max(1500) });

export async function requestFreshCheck(db: PrismaClient, actor: FinanceActor, holdingId: string, requestId: string) {
  if (!z.uuid().safeParse(requestId).success) throw new FinancePipelineError(400, "invalid_request", "Invalid submission id.");
  return db.$transaction(async tx => {
    await financeLock(tx, `finance:holding:${holdingId}`);
    const holding = await tx.financeHolding.findFirst({ where: { id: holdingId, userId: actor.id, shares: { gt: 0 }, soldAt: null } });
    if (!holding) throw new FinancePipelineError(404, "not_found", "No such holding.");
    const pending = await tx.financeCheck.findFirst({ where: { holdingId, status: { not: "done" } } });
    if (pending) return pending;
    const check = await tx.financeCheck.upsert({ where: { dedupeKey: `manual:${holdingId}:${requestId}` }, create: { holdingId, trigger: "manual", dedupeKey: `manual:${holdingId}:${requestId}` }, update: {} });
    await logChange(tx, { userId: actor.id, tickerId: holding.tickerId, kind: "check_requested", actor, detail: { checkId: check.id, trigger: "manual" } });
    return check;
  });
}

/** A monitor job never reveals the portfolio owner's identity or share count. */
export async function listMonitorJobs(db: PrismaClient, agent: PipelineAgent, now = new Date()) {
  const busy = await db.financeCheck.count({ where: { claimedByAgentId: agent.agentId, leaseUntil: { gt: now } } });
  if (busy) return [];
  const jobs = await db.financeCheck.findMany({ where: { status: { not: "done" }, holding: { shares: { gt: 0 }, soldAt: null },
    OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, orderBy: { createdAt: "asc" }, take: 50,
    select: { id: true, trigger: true, status: true, researcherAgentId: true, reviewerAgentId: true, deciderAgentId: true,
      holding: { select: { reasonPoints: { select: { id: true, text: true, main: true } }, ticker: { select: { symbol: true, name: true } } } } } });
  return jobs.filter(j => {
    if (["review", "reviewing"].includes(j.status)) return agent.level !== "working" && Boolean(agent.level) && agent.agentId !== j.researcherAgentId;
    if (["decide", "deciding"].includes(j.status)) return agent.level === "merger" && ![j.researcherAgentId, j.reviewerAgentId].includes(agent.agentId);
    return ![j.reviewerAgentId, j.deciderAgentId].includes(agent.agentId);
  });
}

export async function claimMonitorCheck(db: PrismaClient, agent: PipelineAgent, checkId: string, now = new Date()) {
  const settings = await readPipelineSettings(db);
  return db.$transaction(async tx => {
    await financeLock(tx, `finance:agent:${agent.agentId}`);
    await financeLock(tx, `finance:check:${checkId}`);
    const check = await tx.financeCheck.findUnique({ where: { id: checkId }, include: { holding: { select: { soldAt: true, shares: true } } } });
    if (!check || check.status === "done" || check.holding.soldAt || !check.holding.shares?.gt(0)) throw new FinancePipelineError(409, "not_available", "This check is not available.");
    if (check.leaseUntil && check.leaseUntil > now) throw new FinancePipelineError(409, "not_available", "This check is already held.");
    const [pipelineBusy, monitorBusy] = await Promise.all([
      tx.financePipelineJob.count({ where: { claimedByAgentId: agent.agentId, status: "running", leaseUntil: { gt: now } } }),
      tx.financeCheck.count({ where: { claimedByAgentId: agent.agentId, leaseUntil: { gt: now } } }),
    ]);
    if (pipelineBusy || monitorBusy) throw new FinancePipelineError(409, "agent_busy", "Finish your current Finance task first.");
    const review = ["review", "reviewing"].includes(check.status);
    const decide = ["decide", "deciding"].includes(check.status);
    if (review && (agent.level !== "manager" && agent.level !== "merger")) throw new FinancePipelineError(403, "manager_required", "Review needs a manager-class agent.");
    if (decide && agent.level !== "merger") throw new FinancePipelineError(403, "merger_required", "Deciding needs a merger-class agent.");
    if ((review && agent.agentId === check.researcherAgentId) || (decide && [check.researcherAgentId, check.reviewerAgentId].includes(agent.agentId))) throw new FinancePipelineError(403, "role_conflict", "Each monitor role needs an independent agent.");
    return tx.financeCheck.update({ where: { id: checkId }, data: { status: decide ? "deciding" : review ? "reviewing" : "checking",
      claimedByAgentId: agent.agentId, leaseUntil: new Date(now.getTime() + settings.stageTimeLimitMinutes * 60000),
      ...(decide ? { deciderAgentId: agent.agentId } : review ? { reviewerAgentId: agent.agentId } : { researcherAgentId: agent.agentId }) },
      select: { id: true, status: true, leaseUntil: true, trigger: true, reasonStatus: true, reviewSummary: true,
        holding: { select: { ticker: { select: { symbol: true, name: true } }, reasonPoints: { select: { id: true, text: true, main: true } } } },
        results: { select: { reasonPointId: true, status: true, summary: true, sources: true } } } });
  });
}

export async function submitMonitorCheck(db: PrismaClient, agent: PipelineAgent, checkId: string, phase: "check" | "review" | "decide", raw: unknown, now = new Date()) {
  return db.$transaction(async tx => {
    await financeLock(tx, `finance:agent:${agent.agentId}`);
    await financeLock(tx, `finance:check:${checkId}`);
    const target = await tx.financeCheck.findUnique({ where: { id: checkId }, select: { holdingId: true } });
    if (!target) throw new FinancePipelineError(404, "not_found", "No such check.");
    await financeLock(tx, `finance:holding:${target.holdingId}`);
    const check = await tx.financeCheck.findUnique({ where: { id: checkId }, include: { holding: { include: { ticker: true, reasonPoints: true } }, results: { include: { reasonPoint: true } } } });
    const expected = { check: "checking", review: "reviewing", decide: "deciding" }[phase];
    if (!check || check.status !== expected || check.claimedByAgentId !== agent.agentId || !check.leaseUntil || check.leaseUntil <= now) throw new FinancePipelineError(409, "not_holder", "Claim a live check before submitting this stage.");
    const actor = await agentActor(tx, agent.agentId);
    const clearLease = { claimedByAgentId: null, leaseUntil: null };
    if (phase === "check") {
      const input = checkResultsSchema.parse(raw);
      let points = check.holding.reasonPoints;
      if (points.length === 0) {
        if (input.points.some(p => !p.text) || input.points.filter(p => p.main).length !== 1) throw new FinancePipelineError(400, "invalid_points", "Supply 2–4 checkable points with one main reason.");
        const created = [];
        for (const p of input.points) created.push(await tx.financeReasonPoint.create({ data: { holdingId: check.holdingId, text: p.text!, main: p.main ?? false } }));
        points = created;
      } else if (input.points.length !== points.length || new Set(input.points.map(p => p.reasonPointId)).size !== points.length
        || input.points.some(p => !points.some(r => r.id === p.reasonPointId))) throw new FinancePipelineError(400, "incomplete_check", "Check each existing reason point exactly once.");
      for (let index = 0; index < input.points.length; index++) {
        const p = input.points[index];
        const point = check.holding.reasonPoints.length ? points.find(r => r.id === p.reasonPointId)! : points[index];
        const result = await tx.financeCheckResult.create({ data: { checkId, reasonPointId: point.id, status: p.status, summary: p.summary,
          sources: p.sources, actorId: actor.id, actorLabel: actor.label } });
        await logChange(tx, { userId: check.holding.userId, tickerId: check.holding.tickerId, kind: "reason_point", actor,
          detail: { checkId, resultId: result.id, reasonPointId: point.id, reason: point.text, status: p.status, sources: p.sources } });
      }
      return tx.financeCheck.update({ where: { id: checkId }, data: { status: "review", ...clearLease }, select: { id: true, status: true } });
    }
    if (phase === "review") {
      if ((agent.level !== "manager" && agent.level !== "merger") || check.researcherAgentId === agent.agentId) throw new FinancePipelineError(403, "role_conflict", "An independent manager must review the check.");
      const input = z.object({ summary: z.string().trim().min(10).max(1500) }).parse(raw);
      const status = reasonStatus(check.results.map(r => ({ main: r.reasonPoint.main, status: r.status })));
      const previous = await tx.financeCheck.findFirst({ where: { holdingId: check.holdingId, reviewedAt: { not: null }, id: { not: checkId } }, orderBy: { reviewedAt: "desc" } });
      await logChange(tx, { userId: check.holding.userId, tickerId: check.holding.tickerId, kind: "reason_status", actor,
        detail: { checkId, before: previous?.reasonStatus ?? "not_checked", after: status, summary: input.summary } });
      if (status !== "holds" && previous?.reasonStatus !== status) await tx.notification.create({ data: { userId: check.holding.userId,
        kind: "finance_reason_break", title: `${check.holding.ticker.symbol}: a holding reason is ${status === "broken" ? "broken" : "weakening"}.`, url: `/finance/${encodeURIComponent(check.holding.ticker.symbol)}` } });
      return tx.financeCheck.update({ where: { id: checkId }, data: { status: status === "holds" ? "done" : "decide", reasonStatus: status,
        reviewSummary: input.summary, reviewedAt: now, ...clearLease }, select: { id: true, status: true, reasonStatus: true } });
    }
    if (agent.level !== "merger" || [check.researcherAgentId, check.reviewerAgentId].includes(agent.agentId)) throw new FinancePipelineError(403, "role_conflict", "An independent merger must decide.");
    const input = monitorDecisionSchema.parse(raw);
    const decision = await tx.financeDecision.create({ data: { checkId, tickerId: check.holding.tickerId, origin: "monitor", actorLabel: actor.label,
      agentId: agent.agentId, reviewGo: 0, reviewTotal: 1, answerAgainst: check.reviewSummary ?? "", ...input } });
    await logChange(tx, { userId: check.holding.userId, tickerId: check.holding.tickerId, kind: "decision", actor, detail: { checkId, decisionId: decision.id, call: input.call } });
    await tx.notification.create({ data: { userId: check.holding.userId, kind: "finance_decision", title: `${check.holding.ticker.symbol}: ${input.sentence}`, url: `/finance/${encodeURIComponent(check.holding.ticker.symbol)}` } });
    return tx.financeCheck.update({ where: { id: checkId }, data: { status: "done", ...clearLease }, select: { id: true, status: true } });
  });
}

/** Scheduled on Mondays and daily for listed market events; does no AI or trading. */
export async function sweepFinanceMonitor(db: PrismaClient, now = new Date()) {
  const holdings = await db.financeHolding.findMany({ where: { shares: { gt: 0 }, soldAt: null }, include: { ticker: true,
    checks: { where: { reviewedAt: { not: null } }, orderBy: { reviewedAt: "desc" }, take: 1 } }, take: 100 });
  let queued = 0;
  const today = now.toISOString().slice(0, 10);
  const provider = marketData();
  let marketReads = 0;
  if (provider.hasPrices) {
    const latestMarket = await db.financeSnapshot.findFirst({ where: { ticker: { symbol: "SPY" }, date: today } });
    if (!latestMarket) {
      const bar = await provider.latestBar("SPY");
      if (bar) {
        const market = await db.financeTicker.upsert({ where: { symbol: "SPY" }, create: { symbol: "SPY", name: "SPDR S&P 500 ETF", type: "etf" }, update: {} });
        await db.financeSnapshot.upsert({ where: { tickerId_date: { tickerId: market.id, date: bar.date } }, create: { tickerId: market.id, date: bar.date, close: bar.close, changePct: bar.changePct, headlines: [] }, update: {} });
      }
    }
  }
  for (const holding of holdings) {
    const last = holding.checks[0]?.reviewedAt;
    const triggers: { kind: string; key: string }[] = [];
    if (!last) triggers.push({ kind: "first", key: `first:${holding.id}` });
    else if (nextWeeklyCheck(last) <= now) triggers.push({ kind: "weekly", key: `weekly:${holding.id}:${today}` });
    if (provider.hasPrices && marketReads < 5 && (!holding.ticker.lastSnapshotAt || holding.ticker.lastSnapshotAt.toISOString().slice(0, 10) < today)) {
      marketReads++;
      const since = holding.ticker.lastSnapshotAt ?? new Date(now.getTime() - 86400000);
      const [bar, headlines, decision] = await Promise.all([provider.latestBar(holding.ticker.symbol), provider.headlines(holding.ticker.symbol, since),
        db.financeDecision.findFirst({ where: { tickerId: holding.tickerId, call: "go" }, orderBy: { createdAt: "desc" } })]);
      if (bar) await db.financeSnapshot.upsert({ where: { tickerId_date: { tickerId: holding.tickerId, date: bar.date } },
        create: { tickerId: holding.tickerId, date: bar.date, close: bar.close, changePct: bar.changePct, headlines: [] }, update: {} });
      for (const event of headlines) if (["filing", "earnings"].includes(event.kind) || /dividend.{0,30}(cut|suspend)|(cut|suspend).{0,30}dividend/i.test(event.title)) {
        triggers.push({ kind: event.kind === "news" ? "dividend_cut" : event.kind, key: `event:${holding.id}:${event.url}` });
      }
      if (bar && decision?.reviewIfBelow && bar.close < decision.reviewIfBelow.toNumber()) triggers.push({ kind: "below_review", key: `below:${holding.id}:${bar.date}` });
      await db.financeTicker.update({ where: { id: holding.tickerId }, data: { lastSnapshotAt: now } });
    }
    for (const trigger of triggers) {
      const made = await db.financeCheck.createMany({ data: [{ holdingId: holding.id, trigger: trigger.kind, dedupeKey: trigger.key }], skipDuplicates: true });
      queued += made.count;
    }
  }
  return { queued };
}
