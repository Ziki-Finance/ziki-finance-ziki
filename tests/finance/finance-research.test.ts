import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { MARKET_SYMBOL, dueReason, giveVerdict, listJobsForAgent, listOpenViews, postView, settleJob, sweepFinance, takeMarketSnapshot, tickerRecord } from "@/lib/finance/research";

/** A fake Prisma client: every model method used here is a mock; $transaction runs on the same fake. */
function fakeDb() {
  const db = {
    financeTicker: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn().mockResolvedValue({ id: "spy" }) },
    financeSnapshot: { createMany: vi.fn(), findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    financeJob: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), createMany: vi.fn().mockResolvedValue({ count: 1 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    financeView: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    financeVerdict: { create: vi.fn() },
    financeAgreedView: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    financeCycle: { findUnique: vi.fn().mockResolvedValue(null), createMany: vi.fn() },
    // No row yet: the agreement numbers staff set fall back to the defaults (idea 19).
    financeSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  return db;
}
const asDb = (db: ReturnType<typeof fakeDb>) => db as never;
const agent = { agentId: "a1", ownerId: "o1", level: "working" as const };
const now = new Date("2026-11-16T22:00:00Z"); // Monday 17:00 ET
const unique = () => new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" });

describe("when a ticker is due for review (idea 6)", () => {
  const reviewed = { lastReviewedAt: new Date("2026-11-14T10:00:00Z") };
  it("reviews new tickers, earnings, big moves and news, and otherwise weekly", () => {
    expect(dueReason({ lastReviewedAt: null }, null, now)).toBe("first");
    expect(dueReason(reviewed, { changePct: 1, headlines: [{ kind: "earnings" }] }, now)).toBe("earnings");
    expect(dueReason(reviewed, { changePct: -6.2, headlines: [] }, now)).toBe("move");
    expect(dueReason(reviewed, { changePct: 0.4, headlines: [{ kind: "news" }] }, now)).toBe("news");
    expect(dueReason(reviewed, { changePct: 0.4, headlines: [] }, now)).toBeNull();
    expect(dueReason({ lastReviewedAt: new Date("2026-11-09T21:00:00Z") }, null, now)).toBe("weekly");
  });
});

describe("the daily cycle", () => {
  it("does nothing at midday once today's settle is marked done", async () => {
    const db = fakeDb();
    db.financeCycle.findUnique.mockResolvedValue({ id: "c" });
    const result = await sweepFinance(asDb(db), new Date("2026-11-16T17:01:00Z")); // 12:01 ET
    expect(result).toEqual({ snapshots: 0, jobs: 0, agreed: 0, noAgreement: 0 });
    expect(db.financeTicker.findMany).not.toHaveBeenCalled();
    expect(db.financeJob.findMany).not.toHaveBeenCalled();
  });

  it("after the close on a trading day, snapshots tracked tickers and opens due jobs", async () => {
    const db = fakeDb();
    db.financeCycle.findUnique.mockImplementation(({ where }: { where: { date_step: { step: string } } }) => (where.date_step.step === "settle" ? { id: "c" } : null));
    db.financeTicker.findMany.mockResolvedValueOnce([{ id: "t1", symbol: "AAPL", lastSnapshotAt: null, lastReviewedAt: null }]);
    const result = await sweepFinance(asDb(db), new Date("2026-11-16T21:31:00Z")); // 16:31 ET
    expect(result).toMatchObject({ snapshots: 1, jobs: 1 });
    expect(db.financeTicker.findMany.mock.calls[0][0].where).toMatchObject({ holdings: { some: { soldAt: null } }, snapshots: { none: { date: "2026-11-16" } } });
    expect(db.financeJob.createMany.mock.calls[0][0].data).toEqual([{ tickerId: "t1", date: "2026-11-16", reason: "first" }]);
    expect(db.financeCycle.createMany.mock.calls[0][0].data).toEqual([{ date: "2026-11-16", step: "jobs" }]);
    // Once every tracked ticker has a snapshot for the day, the market's own move is recorded too (idea 21).
    expect(db.financeTicker.upsert.mock.calls[0][0].where).toEqual({ symbol: MARKET_SYMBOL });
    expect(db.financeSnapshot.createMany.mock.calls[1][0].data[0]).toMatchObject({ tickerId: "spy", date: "2026-11-16" });
  });

  it("does not snapshot the market until the evening's own tickers are all done", async () => {
    const db = fakeDb();
    db.financeCycle.findUnique.mockImplementation(({ where }: { where: { date_step: { step: string } } }) => (where.date_step.step === "settle" ? { id: "c" } : null));
    db.financeTicker.findMany.mockResolvedValueOnce(Array.from({ length: 26 }, (_, i) => ({ id: `t${i}`, symbol: `T${i}`, lastSnapshotAt: null, lastReviewedAt: null })));
    await sweepFinance(asDb(db), new Date("2026-11-16T21:31:00Z")); // 16:31 ET, 26 tickers > the 25-per-minute limit
    expect(db.financeTicker.upsert).not.toHaveBeenCalled();
  });

  it("opens no jobs on a market holiday", async () => {
    const db = fakeDb();
    db.financeCycle.findUnique.mockResolvedValue({ id: "c" });
    await sweepFinance(asDb(db), new Date("2026-11-26T22:01:00Z")); // Thanksgiving, 17:01 ET
    expect(db.financeTicker.findMany).not.toHaveBeenCalled();
  });

  it("from 05:00 ET settles jobs from earlier days", async () => {
    const db = fakeDb();
    db.financeJob.findMany.mockResolvedValueOnce([]);
    await sweepFinance(asDb(db), new Date("2026-11-17T10:01:00Z")); // Tue 05:01 ET
    expect(db.financeJob.findMany.mock.calls[0][0].where).toEqual({ status: "open", date: { lt: "2026-11-17" } });
    expect(db.financeCycle.createMany.mock.calls[0][0].data).toEqual([{ date: "2026-11-17", step: "settle" }]);
  });
});

describe("the market's own snapshot (idea 21)", () => {
  it("records SPY as a proxy for the S&P 500, with no price when the provider has none", async () => {
    const db = fakeDb();
    db.financeTicker.upsert.mockResolvedValue({ id: "spy1" });
    await takeMarketSnapshot(asDb(db), "2026-11-16", now);
    expect(db.financeTicker.upsert.mock.calls[0][0]).toMatchObject({ where: { symbol: "SPY" } });
    expect(db.financeSnapshot.createMany.mock.calls[0][0]).toEqual({
      data: [{ tickerId: "spy1", date: "2026-11-16", close: null, changePct: null, headlines: [] }],
      skipDuplicates: true,
    });
    expect(db.financeTicker.update.mock.calls[0][0]).toEqual({ where: { id: "spy1" }, data: { lastSnapshotAt: now } });
  });
});

describe("settling a job (idea 8)", () => {
  const verdicts = (n: number) => Array.from({ length: n }, (_, i) => ({ ownerId: `o${i + 2}`, verdict: "agree" as const, weight: 1 }));

  it("turns an agreed view into the ticker's agreed view, at the snapshot's price", async () => {
    const db = fakeDb();
    db.financeJob.findUnique.mockResolvedValue({ id: "j1", status: "open", tickerId: "t1", date: "2026-11-16", views: [{ id: "v1", call: "buy_keep", createdAt: now, verdicts: verdicts(3) }] });
    db.financeSnapshot.findUnique.mockResolvedValue({ close: new Prisma.Decimal("41.2") });
    expect(await settleJob(asDb(db), "j1", now)).toBe("agreed");
    expect(db.financeAgreedView.create.mock.calls[0][0].data).toMatchObject({ tickerId: "t1", viewId: "v1", agentsAgree: 4, agentsTotal: 4, divided: false });
    expect(db.financeTicker.update.mock.calls[0][0]).toEqual({ where: { id: "t1" }, data: { lastReviewedAt: now } });
  });

  it("keeps the previous view when nothing agreed", async () => {
    const db = fakeDb();
    db.financeJob.findUnique.mockResolvedValue({ id: "j1", status: "open", tickerId: "t1", date: "2026-11-16", views: [{ id: "v1", call: "sell", createdAt: now, verdicts: verdicts(3) }] });
    db.financeAgreedView.findFirst.mockResolvedValue({ view: { call: "buy_keep" } }); // a change to Sell needs 4
    expect(await settleJob(asDb(db), "j1", now)).toBe("no_agreement");
    expect(db.financeAgreedView.create).not.toHaveBeenCalled();
    expect(db.financeJob.updateMany.mock.calls[0][0].data).toMatchObject({ status: "no_agreement" });
  });

  it("does nothing when another sweep settled it first", async () => {
    const db = fakeDb();
    db.financeJob.findUnique.mockResolvedValue({ id: "j1", status: "open", tickerId: "t1", date: "2026-11-16", views: [] });
    db.financeJob.updateMany.mockResolvedValue({ count: 0 });
    expect(await settleJob(asDb(db), "j1", now)).toBe("skipped");
  });
});

describe("agents' work (ideas 7 and 8)", () => {
  it("posts one view per agent per job, while the job is open and not full", async () => {
    const db = fakeDb();
    const input = { call: "buy_keep" as const, risk: "low" as const, reasons: ["Earns steadily"], changeMind: "Sales fall two quarters running", sources: ["https://www.sec.gov/x"] };
    db.financeJob.findUnique.mockResolvedValue({ id: "j1", status: "open", tickerId: "t1", _count: { views: 0 } });
    db.financeView.create.mockResolvedValue({ id: "v1" });
    await postView(asDb(db), agent, "j1", input);
    expect(db.financeView.create.mock.calls[0][0].data).toMatchObject({ jobId: "j1", tickerId: "t1", agentId: "a1", ownerId: "o1", call: "buy_keep" });

    db.financeView.create.mockRejectedValueOnce(unique());
    await expect(postView(asDb(db), agent, "j1", input)).rejects.toMatchObject({ status: 409, code: "already_posted" });
    db.financeJob.findUnique.mockResolvedValue({ id: "j1", status: "open", tickerId: "t1", _count: { views: 3 } });
    await expect(postView(asDb(db), agent, "j1", input)).rejects.toMatchObject({ code: "job_full" });
    db.financeJob.findUnique.mockResolvedValue({ id: "j1", status: "agreed", tickerId: "t1", _count: { views: 1 } });
    await expect(postView(asDb(db), agent, "j1", input)).rejects.toMatchObject({ code: "job_closed" });
  });

  it("never lets an owner's agents judge their own views, and weights a manager's verdict", async () => {
    const db = fakeDb();
    db.financeView.findUnique.mockResolvedValue({ id: "v1", ownerId: "o1", outcome: "open", job: { status: "open" } });
    await expect(giveVerdict(asDb(db), agent, "v1", { verdict: "agree", reason: "Looks right" })).rejects.toMatchObject({ status: 403, code: "own_view" });
    db.financeView.findUnique.mockResolvedValue({ id: "v1", ownerId: "o9", outcome: "open", job: { status: "open" } });
    await giveVerdict(asDb(db), { ...agent, level: "manager" }, "v1", { verdict: "agree", reason: "Looks right" });
    expect(db.financeVerdict.create.mock.calls[0][0].data).toMatchObject({ viewId: "v1", agentId: "a1", ownerId: "o1", weight: 3 });
    db.financeVerdict.create.mockRejectedValueOnce(unique());
    await expect(giveVerdict(asDb(db), agent, "v1", { verdict: "agree", reason: "Again" })).rejects.toMatchObject({ code: "already_judged" });
  });

  it("lists views to judge without the agent's own owner's", async () => {
    const db = fakeDb();
    await listOpenViews(asDb(db), agent);
    expect(db.financeView.findMany.mock.calls[0][0].where).toMatchObject({ ownerId: { not: "o1" }, verdicts: { none: { agentId: "a1" } } });
  });
});

describe("agents never see owners (PRD §13 criterion 5)", () => {
  /** Every key a Prisma `select` asks for, at any depth. */
  function selectedKeys(select: unknown, out = new Set<string>()): Set<string> {
    if (select && typeof select === "object") {
      for (const [key, value] of Object.entries(select)) {
        out.add(key);
        selectedKeys(value, out);
      }
    }
    return out;
  }
  const PRIVATE = ["holdings", "userId", "user", "shares", "avgCost", "ownerId", "owner", "agentId", "agent", "email"];

  it("selects no owner or holding fields for jobs, views or a ticker's record", async () => {
    const db = fakeDb();
    db.financeJob.findMany.mockResolvedValue([{ id: "j1", date: "2026-11-16", reason: "first", tickerId: "t1", ticker: { symbol: "AAPL" }, _count: { views: 0 } }]);
    db.financeTicker.findUnique.mockResolvedValue({ id: "t1", symbol: "AAPL", name: "Apple", type: "stock", exchange: "NASDAQ", lastReviewedAt: null });
    const jobs = await listJobsForAgent(asDb(db), agent);
    await listOpenViews(asDb(db), agent);
    const record = await tickerRecord(asDb(db), "AAPL");
    const selects = [
      db.financeJob.findMany.mock.calls[0][0].select,
      db.financeView.findMany.mock.calls[0][0].select,
      db.financeTicker.findUnique.mock.calls[0][0].select,
      ...db.financeAgreedView.findFirst.mock.calls.map((c) => c[0].select),
      ...db.financeAgreedView.findMany.mock.calls.map((c) => c[0].select),
    ];
    for (const select of selects) for (const key of PRIVATE) expect(selectedKeys(select).has(key)).toBe(false);
    expect(JSON.stringify({ jobs, record })).not.toMatch(/userId|ownerId|shares|email/);
  });
});
