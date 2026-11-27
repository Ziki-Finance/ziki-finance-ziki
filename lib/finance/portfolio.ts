import { Prisma, type PrismaClient } from "@prisma/client";
import { marketData } from "./market-data";
import { holdingFromTrades, tradeBodySchema, industryWarning } from "./portfolio-ledger";
import { FinancePipelineError } from "./pipeline";
import { readPipelineSettings } from "./pipeline-settings";
import { nextWeeklyCheck } from "./decision-rules";

export type FinanceActor = { id: string; label: string };
export type FinanceTx = Prisma.TransactionClient;
export const tradeOrder = [{ tradedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }] as const;
export async function financeLock(tx: FinanceTx, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
export async function logChange(tx: FinanceTx, data: { userId?: string; tickerId: string; kind: string; actor: FinanceActor; detail: Prisma.InputJsonValue }) {
  await tx.financeChange.create({ data: { userId: data.userId, tickerId: data.tickerId, kind: data.kind,
    actorId: data.actor.id, actorLabel: data.actor.label, detail: data.detail } });
}

/** Validate the whole dated ledger under a per-owner/ticker lock, including backdated trades. */
export async function recordTrade(db: PrismaClient, actor: FinanceActor, raw: unknown, now = new Date()) {
  const input = tradeBodySchema.parse(raw);
  if (input.date > now.toISOString().slice(0, 10)) throw new FinancePipelineError(400, "future_trade", "A trade cannot be in the future.");
  const symbol = input.symbol.replace(/-/g, ".");
  const knownTicker = await db.financeTicker.findUnique({ where: { symbol } });
  let listing = knownTicker ?? await marketData().lookup(symbol);
  if (!listing) throw new FinancePipelineError(400, "unknown_listing", "This symbol could not be verified as a US listing. Check the ticker or market-data configuration.");
  if (knownTicker && !knownTicker.industry && marketData().hasPrices) {
    const refreshed = await marketData().lookup(symbol);
    if (refreshed?.industry) listing = { ...knownTicker, industry: refreshed.industry };
  }
  const listingDetails = listing;
  let price = input.price;
  if (!price) {
    const snapshot = await db.financeSnapshot.findFirst({ where: { ticker: { symbol }, date: { lte: input.date } }, orderBy: { date: "desc" } });
    if (!snapshot?.close || snapshot.date !== input.date) throw new FinancePipelineError(400, "price_required", "No closing price is available for this date. Enter the price you paid.");
    price = snapshot.close.toString();
  }
  const benchmark = await db.financeSnapshot.findFirst({ where: { ticker: { symbol: "SPY" }, date: { lte: input.date } }, orderBy: { date: "desc" } });
  const tradedAt = new Date(`${input.date}T00:00:00.000Z`);
  return db.$transaction(async tx => {
    await financeLock(tx, `finance:portfolio:${actor.id}:${symbol}`);
    const duplicate = await tx.financeTrade.findUnique({ where: { userId_requestId: { userId: actor.id, requestId: input.requestId } } });
    if (duplicate) {
      if (duplicate.side !== input.side || duplicate.shares.toString() !== new Prisma.Decimal(input.shares).toString() || duplicate.price?.toString() !== new Prisma.Decimal(price).toString()
        || duplicate.tradedAt.getTime() !== tradedAt.getTime() || (duplicate.decisionId ?? undefined) !== input.decisionId
        || !(await tx.financeTicker.findFirst({ where: { id: duplicate.tickerId, symbol } }))) {
        throw new FinancePipelineError(409, "request_reused", "This submission id belongs to a different trade.");
      }
      return duplicate;
    }
    const ticker = await tx.financeTicker.upsert({ where: { symbol }, create: { symbol, name: listingDetails.name, exchange: listingDetails.exchange, type: listingDetails.type, industry: listingDetails.industry }, update: listingDetails.industry ? { industry: listingDetails.industry } : {} });
    const decision = input.decisionId ? await tx.financeDecision.findFirst({ where: { id: input.decisionId, OR: [{ candidateId: { not: null } }, { check: { holding: { userId: actor.id } } }] } }) : null;
    if (input.decisionId && (!decision || decision.tickerId !== ticker.id)) throw new FinancePipelineError(400, "wrong_decision", "The decision must belong to this stock.");
    const trade = await tx.financeTrade.create({ data: { userId: actor.id, tickerId: ticker.id, side: input.side, shares: input.shares, price,
      tradedAt, decisionId: input.decisionId, benchmarkPrice: benchmark?.close, actorId: actor.id, actorLabel: actor.label, requestId: input.requestId, createdAt: now } });
    const trades = await tx.financeTrade.findMany({ where: { userId: actor.id, tickerId: ticker.id }, orderBy: [...tradeOrder] });
    let position;
    try { position = holdingFromTrades(trades); } catch (error) { throw new FinancePipelineError(400, "oversell", (error as Error).message); }
    // Legacy holding columns are a cache for Stream B's TRACKED query only.
    const holding = await tx.financeHolding.upsert({ where: { userId_tickerId: { userId: actor.id, tickerId: ticker.id } },
      create: { userId: actor.id, tickerId: ticker.id, shares: position.shares, avgCost: position.averageCost, addedAt: tradedAt,
        soldAt: position.shares.isZero() ? now : null },
      update: { shares: position.shares, avgCost: position.averageCost, soldAt: position.shares.isZero() ? now : null } });
    if (position.shares.gt(0)) {
      const count = await tx.financeReasonPoint.count({ where: { holdingId: holding.id } });
      if (!count && decision?.call === "go" && Array.isArray(decision.reasonPoints)) {
        const points = decision.reasonPoints as { text: string; main: boolean }[];
        await tx.financeReasonPoint.createMany({ data: points.map(p => ({ holdingId: holding.id, text: p.text, main: p.main })) });
      }
      await tx.financeCheck.upsert({ where: { dedupeKey: `first:${holding.id}` },
        create: { holdingId: holding.id, trigger: "first", dedupeKey: `first:${holding.id}` }, update: {} });
    }
    if (decision && input.side === "bought") await tx.financeOwnerAction.create({ data: { userId: actor.id, decisionId: decision.id, action: "bought", actorLabel: actor.label } });
    await logChange(tx, { userId: actor.id, tickerId: ticker.id, kind: "trade", actor,
      detail: { tradeId: trade.id, side: input.side, shares: input.shares, price, date: input.date, decisionId: input.decisionId ?? null } });
    return trade;
  });
}

export async function portfolioForOwner(db: PrismaClient, userId: string) {
  const holdings = await db.financeHolding.findMany({ where: { userId }, include: {
    ticker: { include: { snapshots: { orderBy: { date: "desc" }, take: 1 } } },
    reasonPoints: true, checks: { where: { reviewedAt: { not: null } }, orderBy: { reviewedAt: "desc" }, take: 1 },
  } });
  const ledger = await db.financeTrade.findMany({ where: { userId }, orderBy: [...tradeOrder] });
  const benchmark = await db.financeSnapshot.findFirst({ where: { ticker: { symbol: "SPY" } }, orderBy: { date: "desc" } });
  const positions = holdings.map(h => {
    const trades = ledger.filter(t => t.tickerId === h.tickerId);
    const position = holdingFromTrades(trades);
    const close = h.ticker.snapshots[0]?.close;
    const value = close == null ? null : position.shares.mul(close);
    const gain = value && position.cost ? value.sub(position.cost) : null;
    const gainPct = gain && position.cost?.gt(0) ? gain.div(position.cost).mul(100) : null;
    const benchmarkGainPct = benchmark?.close && position.benchmarkUnits && position.cost?.gt(0)
      ? position.benchmarkUnits.mul(benchmark.close).sub(position.cost).div(position.cost).mul(100) : null;
    const check = h.checks[0];
    return { id: h.id, tickerId: h.tickerId, symbol: h.ticker.symbol, name: h.ticker.name,
      shares: position.shares.toString(), averageCost: position.averageCost?.toString() ?? null, value: value?.toNumber() ?? null,
      gain: gain?.toNumber() ?? null, gainPct: gainPct?.toNumber() ?? null, benchmarkGainPct: benchmarkGainPct?.toNumber() ?? null,
      priceDate: h.ticker.snapshots[0]?.date ?? null, reasonStatus: check?.reasonStatus ?? "not_checked", lastChecked: check?.reviewedAt?.toISOString() ?? null,
      nextCheck: check?.reviewedAt ? nextWeeklyCheck(check.reviewedAt).toISOString() : null,
      addedByYou: !trades.some(t => t.decisionId), reasonPoints: h.reasonPoints.map(p => ({ id: p.id, text: p.text, main: p.main })), industry: h.ticker.industry };
  }).filter(p => new Prisma.Decimal(p.shares).gt(0));
  const settings = await readPipelineSettings(db);
  return { positions, totalValue: positions.some(p => p.value === null) ? null : positions.reduce((sum, p) => sum + (p.value ?? 0), 0),
    balanceWarning: industryWarning(positions, settings.balanceShare) };
}

export async function recordOwnerAction(db: PrismaClient, actor: FinanceActor, decisionId: string, action: "watch" | "not_for_me", reason?: string) {
  if (reason && reason.length > 1500) throw new FinancePipelineError(400, "reason_too_long", "Keep the reason below 1,500 characters.");
  return db.$transaction(async tx => {
    const decision = await tx.financeDecision.findFirst({ where: { id: decisionId, OR: [{ candidateId: { not: null } }, { check: { holding: { userId: actor.id } } }] } });
    if (!decision) throw new FinancePipelineError(404, "not_found", "No such decision.");
    const entry = await tx.financeOwnerAction.create({ data: { userId: actor.id, decisionId, action, reason: reason?.trim() || null, actorLabel: actor.label } });
    await logChange(tx, { userId: actor.id, tickerId: decision.tickerId, kind: "owner_action", actor, detail: { decisionId, action, reason: reason ?? null } });
    return entry;
  });
}
