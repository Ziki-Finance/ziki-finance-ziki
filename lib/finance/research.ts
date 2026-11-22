import { Prisma, type AgentLevel, type FinanceCall, type FinanceJobReason, type FinanceRisk, type FinanceVerdictKind, type PrismaClient } from "@prisma/client";
import { MAX_VIEWS_PER_JOB, settleViews, verdictWeight } from "./agreement";
import { eastern, easternMinutes, isTradingDay, previousTradingDay } from "./calendar";
import { directoryEntry } from "./directory";
import { marketData, type Headline } from "./market-data";
import { readFinanceSettings } from "./settings";

/**
 * Ziki Finance agent research (FIN-CR-004, ideas 6–8; PRD §7).
 *
 * Agents research tickers, never people. Nothing here reads who holds a ticker
 * beyond "someone does" (`TRACKED`), and nothing returned to an agent names an
 * owner, a share count or a profile.
 *
 * The daily cycle, in US Eastern time:
 * - from 16:30 on a trading day: a snapshot of each tracked ticker, then a job
 *   for each one that is due (`dueReason`);
 * - until 05:00: agents post views and give verdicts;
 * - from 05:00: open jobs from earlier days settle into agreed views.
 */

type Db = PrismaClient;

export class FinanceJobError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** A ticker someone still holds or watches. */
export const TRACKED = { holdings: { some: { soldAt: null } } } satisfies Prisma.FinanceTickerWhereInput;

/** A move this big (either way) makes a ticker due for review. */
export const BIG_MOVE_PCT = 5;
export const REVIEW_EVERY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const EVENING_START = 16 * 60 + 30;
const SETTLE_AT = 5 * 60;
const NIGHT_END = 4 * 60;

/** Why a ticker needs a review today; null when it doesn't. */
export function dueReason(
  ticker: { lastReviewedAt: Date | null },
  snapshot: { changePct: number | null; headlines: readonly Pick<Headline, "kind">[] } | null,
  now: Date,
): FinanceJobReason | null {
  if (!ticker.lastReviewedAt) return "first";
  const headlines = snapshot?.headlines ?? [];
  if (headlines.some((h) => h.kind === "earnings")) return "earnings";
  if (snapshot?.changePct != null && Math.abs(snapshot.changePct) >= BIG_MOVE_PCT) return "move";
  if (headlines.length > 0) return "news";
  if (now.getTime() - ticker.lastReviewedAt.getTime() >= REVIEW_EVERY_DAYS * DAY_MS) return "weekly";
  return null;
}

function headlinesOf(json: Prisma.JsonValue): Headline[] {
  return Array.isArray(json) ? (json as unknown as Headline[]) : [];
}

/** Creates a job unless the ticker already has an open one, or one for that day. */
async function createJob(db: Db, tickerId: string, date: string, reason: FinanceJobReason): Promise<boolean> {
  const open = await db.financeJob.findFirst({ where: { tickerId, status: "open" }, select: { id: true } });
  if (open) return false;
  const made = await db.financeJob.createMany({ data: [{ tickerId, date, reason }], skipDuplicates: true });
  return made.count > 0;
}

/** Snapshots of tracked tickers that don't have one for `date` yet, with jobs for the due ones. */
export async function takeSnapshots(db: Db, date: string, now: Date, limit = 25): Promise<{ snapshots: number; jobs: number; remaining: boolean }> {
  const tickers = await db.financeTicker.findMany({
    where: { ...TRACKED, snapshots: { none: { date } } },
    select: { id: true, symbol: true, lastSnapshotAt: true, lastReviewedAt: true },
    orderBy: { symbol: "asc" },
    take: limit + 1,
  });
  const data = marketData();
  let snapshots = 0;
  let jobs = 0;
  for (const ticker of tickers.slice(0, limit)) {
    const since = ticker.lastSnapshotAt ?? new Date(now.getTime() - REVIEW_EVERY_DAYS * DAY_MS);
    const [bar, headlines] = await Promise.all([data.latestBar(ticker.symbol), data.headlines(ticker.symbol, since)]);
    const snapshot = { close: bar?.close ?? null, changePct: bar?.changePct ?? null, headlines: headlines.slice(0, 20) };
    await db.financeSnapshot.createMany({
      data: [{ tickerId: ticker.id, date, close: snapshot.close, changePct: snapshot.changePct, headlines: snapshot.headlines as unknown as Prisma.InputJsonValue }],
      skipDuplicates: true,
    });
    await db.financeTicker.update({ where: { id: ticker.id }, data: { lastSnapshotAt: now } });
    snapshots += 1;
    const reason = dueReason(ticker, snapshot, now);
    if (reason && (await createJob(db, ticker.id, date, reason))) jobs += 1;
  }
  return { snapshots, jobs, remaining: tickers.length > limit };
}

/** The most-traded ETF that tracks the S&P 500: the market's move, for the briefing's last line. */
export const MARKET_SYMBOL = "SPY";

/**
 * Records today's price of the market ETF, with no job and no review (idea 21).
 * One extra call in the evening run, so the briefing can say how the market did
 * without spending a call per person. Fails quietly: no line is better than a
 * wrong one, so a missing bar still writes a snapshot with no price.
 */
export async function takeMarketSnapshot(db: Db, date: string, now: Date): Promise<void> {
  const entry = directoryEntry(MARKET_SYMBOL);
  if (!entry) return;
  const ticker = await db.financeTicker.upsert({
    where: { symbol: MARKET_SYMBOL },
    create: { symbol: entry.symbol, name: entry.name, exchange: entry.exchange, type: entry.type },
    update: {},
    select: { id: true },
  });
  const bar = await marketData().latestBar(MARKET_SYMBOL);
  await db.financeSnapshot.createMany({
    data: [{ tickerId: ticker.id, date, close: bar?.close ?? null, changePct: bar?.changePct ?? null, headlines: [] }],
    skipDuplicates: true,
  });
  await db.financeTicker.update({ where: { id: ticker.id }, data: { lastSnapshotAt: now } });
}

/** Tickers added since the evening run, never reviewed: a first job straight away. */
export async function createFirstJobs(db: Db, date: string, limit = 50): Promise<number> {
  const tickers = await db.financeTicker.findMany({
    where: { ...TRACKED, lastReviewedAt: null, jobs: { none: { status: "open" } } },
    select: { id: true },
    take: limit,
  });
  let made = 0;
  for (const t of tickers) if (await createJob(db, t.id, date, "first")) made += 1;
  return made;
}

/** The latest agreed call on a ticker before now, for the Sell bar. */
async function previousCall(db: Db, tickerId: string): Promise<FinanceCall | null> {
  const prev = await db.financeAgreedView.findFirst({ where: { tickerId }, orderBy: { agreedAt: "desc" }, select: { view: { select: { call: true } } } });
  return prev?.view.call ?? null;
}

/** Settles one open job: an agreed view, or no agreement (the previous view stays). */
export async function settleJob(db: Db, jobId: string, now: Date): Promise<"agreed" | "no_agreement" | "skipped"> {
  const job = await db.financeJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      tickerId: true,
      date: true,
      views: { select: { id: true, call: true, createdAt: true, verdicts: { select: { ownerId: true, verdict: true, weight: true } } } },
    },
  });
  if (!job || job.status !== "open") return "skipped";
  const settings = await readFinanceSettings(db);
  const result = settleViews(job.views, await previousCall(db, job.tickerId), settings);
  const snapshot = await db.financeSnapshot.findUnique({ where: { tickerId_date: { tickerId: job.tickerId, date: job.date } }, select: { close: true } });

  return db.$transaction(async (tx) => {
    // Only the first settle wins, if two sweeps overlap.
    const claimed = await tx.financeJob.updateMany({
      where: { id: job.id, status: "open" },
      data: { status: result.agreed ? "agreed" : "no_agreement", settledAt: now },
    });
    if (claimed.count === 0) return "skipped" as const;
    if (!result.agreed) {
      await tx.financeView.updateMany({ where: { jobId: job.id }, data: { outcome: "not_agreed" } });
      return "no_agreement" as const;
    }
    await tx.financeView.updateMany({ where: { jobId: job.id, id: { not: result.viewId } }, data: { outcome: "not_agreed" } });
    await tx.financeView.update({ where: { id: result.viewId }, data: { outcome: "agreed" } });
    await tx.financeAgreedView.create({
      data: {
        tickerId: job.tickerId,
        viewId: result.viewId,
        agreedAt: now,
        priceAtAgreement: snapshot?.close ?? null,
        agentsAgree: result.tally.agentsAgree,
        agentsTotal: result.tally.agentsTotal,
        divided: result.divided,
      },
    });
    await tx.financeTicker.update({ where: { id: job.tickerId }, data: { lastReviewedAt: now } });
    return "agreed" as const;
  });
}

/** Settles open jobs from days before `today`. */
export async function settleOpenJobs(db: Db, today: string, now: Date, limit = 50): Promise<{ agreed: number; noAgreement: number; remaining: boolean }> {
  const jobs = await db.financeJob.findMany({ where: { status: "open", date: { lt: today } }, select: { id: true }, orderBy: { createdAt: "asc" }, take: limit + 1 });
  let agreed = 0;
  let noAgreement = 0;
  for (const job of jobs.slice(0, limit)) {
    const outcome = await settleJob(db, job.id, now);
    if (outcome === "agreed") agreed += 1;
    else if (outcome === "no_agreement") noAgreement += 1;
  }
  return { agreed, noAgreement, remaining: jobs.length > limit };
}

async function cycleDone(db: Db, date: string, step: string): Promise<boolean> {
  return (await db.financeCycle.findUnique({ where: { date_step: { date, step } }, select: { id: true } })) !== null;
}

async function markCycle(db: Db, date: string, step: string): Promise<void> {
  await db.financeCycle.createMany({ data: [{ date, step }], skipDuplicates: true });
}

export type FinanceSweepResult = { snapshots: number; jobs: number; agreed: number; noAgreement: number };

/**
 * Run by the platform cron every minute. Most minutes it does one or two
 * indexed lookups and stops, which keeps it inside the Workers Free CPU limit.
 */
export async function sweepFinance(db: Db, now = new Date()): Promise<FinanceSweepResult> {
  const result: FinanceSweepResult = { snapshots: 0, jobs: 0, agreed: 0, noAgreement: 0 };
  const { date: today } = eastern(now);
  const minutes = easternMinutes(now);

  if (minutes >= SETTLE_AT && !(await cycleDone(db, today, "settle"))) {
    const settled = await settleOpenJobs(db, today, now);
    result.agreed = settled.agreed;
    result.noAgreement = settled.noAgreement;
    if (!settled.remaining) await markCycle(db, today, "settle");
  }

  const evening = isTradingDay(today) && minutes >= EVENING_START;
  if (evening && !(await cycleDone(db, today, "jobs"))) {
    const taken = await takeSnapshots(db, today, now);
    result.snapshots = taken.snapshots;
    result.jobs = taken.jobs;
    // The market's own move, once, after the person's stocks (idea 21).
    if (!taken.remaining) await takeMarketSnapshot(db, today, now);
    if (!taken.remaining) await markCycle(db, today, "jobs");
  }

  // New tickers during the night get a first job every 15 minutes, dated to the evening's cycle.
  const cycleDate = evening ? today : minutes < NIGHT_END ? previousTradingDay(today) : null;
  if (cycleDate && now.getUTCMinutes() % 15 === 0) result.jobs += await createFirstJobs(db, cycleDate);
  return result;
}

// ---------------------------------------------------------------------------
// What agents see and do (no owner data anywhere)

export type FinanceAgent = { agentId: string; ownerId: string; level: AgentLevel };

const TICKER_PUBLIC = { symbol: true, name: true, type: true, exchange: true } as const;

async function currentAgreed(db: Db, tickerId: string) {
  const row = await db.financeAgreedView.findFirst({
    where: { tickerId },
    orderBy: { agreedAt: "desc" },
    select: { agreedAt: true, agentsAgree: true, agentsTotal: true, view: { select: { call: true, risk: true, reasons: true } } },
  });
  return row ? { call: row.view.call, risk: row.view.risk, reasons: row.view.reasons, agreedAt: row.agreedAt, agentsAgree: row.agentsAgree, agentsTotal: row.agentsTotal } : null;
}

/** Open jobs this agent can still post a view on, oldest first. */
export async function listJobsForAgent(db: Db, agent: FinanceAgent, limit = 5) {
  const jobs = await db.financeJob.findMany({
    where: { status: "open", views: { none: { agentId: agent.agentId } } },
    orderBy: { createdAt: "asc" },
    take: 25,
    select: { id: true, date: true, reason: true, tickerId: true, ticker: { select: TICKER_PUBLIC }, _count: { select: { views: true } } },
  });
  const open = jobs.filter((j) => j._count.views < MAX_VIEWS_PER_JOB).slice(0, limit);
  return Promise.all(
    open.map(async (job) => {
      const snapshot = await db.financeSnapshot.findUnique({ where: { tickerId_date: { tickerId: job.tickerId, date: job.date } }, select: { close: true, changePct: true, headlines: true } });
      return {
        id: job.id,
        date: job.date,
        reason: job.reason,
        ticker: job.ticker,
        snapshot: snapshot ? { close: snapshot.close === null ? null : Number(snapshot.close), changePct: snapshot.changePct, headlines: headlinesOf(snapshot.headlines) } : null,
        currentView: await currentAgreed(db, job.tickerId),
        viewsSoFar: job._count.views,
      };
    }),
  );
}

export type ViewInput = { call: FinanceCall; risk: FinanceRisk; reasons: string[]; changeMind: string; sources: string[] };

export async function postView(db: Db, agent: FinanceAgent, jobId: string, input: ViewInput) {
  const job = await db.financeJob.findUnique({ where: { id: jobId }, select: { id: true, status: true, tickerId: true, _count: { select: { views: true } } } });
  if (!job) throw new FinanceJobError(404, "not_found", "No such finance job.");
  if (job.status !== "open") throw new FinanceJobError(409, "job_closed", "This job has settled; no more views.");
  if (job._count.views >= MAX_VIEWS_PER_JOB) throw new FinanceJobError(409, "job_full", `This job already has ${MAX_VIEWS_PER_JOB} views. Give verdicts on them instead.`);
  try {
    const view = await db.financeView.create({
      data: { jobId: job.id, tickerId: job.tickerId, agentId: agent.agentId, ownerId: agent.ownerId, ...input },
      select: { id: true, createdAt: true },
    });
    return view;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FinanceJobError(409, "already_posted", "You already posted a view on this job.");
    }
    throw error;
  }
}

/** Views on open jobs waiting for this agent's verdict: never its owner's own. */
export async function listOpenViews(db: Db, agent: FinanceAgent, limit = 10) {
  const views = await db.financeView.findMany({
    where: { outcome: "open", job: { status: "open" }, ownerId: { not: agent.ownerId }, verdicts: { none: { agentId: agent.agentId } } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, jobId: true, call: true, risk: true, reasons: true, changeMind: true, sources: true, createdAt: true, ticker: { select: TICKER_PUBLIC } },
  });
  return views;
}

export async function giveVerdict(db: Db, agent: FinanceAgent, viewId: string, input: { verdict: FinanceVerdictKind; reason: string }) {
  const view = await db.financeView.findUnique({ where: { id: viewId }, select: { id: true, ownerId: true, outcome: true, job: { select: { status: true } } } });
  if (!view) throw new FinanceJobError(404, "not_found", "No such view.");
  if (view.outcome !== "open" || view.job.status !== "open") throw new FinanceJobError(409, "view_closed", "This view has settled; no more verdicts.");
  if (view.ownerId === agent.ownerId) throw new FinanceJobError(403, "own_view", "Agents can't judge a view by their own owner's agents.");
  const settings = await readFinanceSettings(db);
  try {
    return await db.financeVerdict.create({
      data: { viewId: view.id, agentId: agent.agentId, ownerId: agent.ownerId, verdict: input.verdict, reason: input.reason, weight: verdictWeight(agent.level, settings) },
      select: { id: true, weight: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FinanceJobError(409, "already_judged", "You already gave a verdict on this view.");
    }
    throw error;
  }
}

/** A ticker's public record: recent snapshots and agreed views. No owner data. */
export async function tickerRecord(db: Db, symbol: string) {
  const ticker = await db.financeTicker.findUnique({ where: { symbol }, select: { id: true, ...TICKER_PUBLIC, lastReviewedAt: true } });
  if (!ticker) return null;
  const [snapshots, agreed] = await Promise.all([
    db.financeSnapshot.findMany({ where: { tickerId: ticker.id }, orderBy: { date: "desc" }, take: 30, select: { date: true, close: true, changePct: true, headlines: true } }),
    db.financeAgreedView.findMany({
      where: { tickerId: ticker.id },
      orderBy: { agreedAt: "desc" },
      take: 20,
      select: { agreedAt: true, priceAtAgreement: true, agentsAgree: true, agentsTotal: true, divided: true, view: { select: { call: true, risk: true, reasons: true, changeMind: true, sources: true } } },
    }),
  ]);
  return {
    ticker: { symbol: ticker.symbol, name: ticker.name, type: ticker.type, exchange: ticker.exchange, lastReviewedAt: ticker.lastReviewedAt },
    snapshots: snapshots.map((s) => ({ date: s.date, close: s.close === null ? null : Number(s.close), changePct: s.changePct, headlines: headlinesOf(s.headlines) })),
    agreedViews: agreed.map((a) => ({ ...a.view, agreedAt: a.agreedAt, priceAtAgreement: a.priceAtAgreement === null ? null : Number(a.priceAtAgreement), agentsAgree: a.agentsAgree, agentsTotal: a.agentsTotal, divided: a.divided })),
  };
}

// ---------------------------------------------------------------------------
// What a person sees (their own tickers only; the page passes their ticker ids)

export type CurrentView = {
  call: FinanceCall;
  risk: FinanceRisk;
  reasons: string[];
  changeMind: string;
  sources: string[];
  agreedAt: Date;
  agentsAgree: number;
  agentsTotal: number;
  divided: boolean;
  /** The latest review didn't reach agreement, so this older view stands. */
  notReviewedToday: boolean;
};

/** The current agreed view of each ticker. */
export async function currentViews(db: Db, tickerIds: readonly string[]): Promise<Map<string, CurrentView>> {
  const out = new Map<string, CurrentView>();
  if (tickerIds.length === 0) return out;
  const [rows, lastJobs] = await Promise.all([
    db.financeAgreedView.findMany({
      where: { tickerId: { in: [...tickerIds] } },
      orderBy: { agreedAt: "desc" },
      distinct: ["tickerId"],
      select: { tickerId: true, agreedAt: true, agentsAgree: true, agentsTotal: true, divided: true, view: { select: { call: true, risk: true, reasons: true, changeMind: true, sources: true } } },
    }),
    db.financeJob.findMany({
      where: { tickerId: { in: [...tickerIds] }, status: { not: "open" } },
      orderBy: { settledAt: "desc" },
      distinct: ["tickerId"],
      select: { tickerId: true, status: true, settledAt: true },
    }),
  ]);
  const last = new Map(lastJobs.map((j) => [j.tickerId, j]));
  for (const row of rows) {
    const job = last.get(row.tickerId);
    out.set(row.tickerId, {
      ...row.view,
      agreedAt: row.agreedAt,
      agentsAgree: row.agentsAgree,
      agentsTotal: row.agentsTotal,
      divided: row.divided,
      notReviewedToday: job?.status === "no_agreement" && (job.settledAt?.getTime() ?? 0) > row.agreedAt.getTime(),
    });
  }
  return out;
}

/** A ticker's agreed views over time, newest first, with the price at each. */
export async function viewHistory(db: Db, tickerId: string, take = 10) {
  const rows = await db.financeAgreedView.findMany({
    where: { tickerId },
    orderBy: { agreedAt: "desc" },
    take,
    select: { agreedAt: true, priceAtAgreement: true, view: { select: { call: true } } },
  });
  return rows.map((r) => ({ agreedAt: r.agreedAt, call: r.view.call, price: r.priceAtAgreement === null ? null : Number(r.priceAtAgreement) }));
}
