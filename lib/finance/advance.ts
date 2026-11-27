import type { PrismaClient } from "@prisma/client";
import { enrichmentReadyToAdvance } from "./pipeline";
import { readPipelineSettings, type PipelineSettingsValues } from "./pipeline-settings";
import { financeLock } from "./portfolio";

/**
 * The automatic hand-offs between the early Finance stages (PRD §3: "a stage
 * moves on as soon as its quota is in"; stocks move independently).
 *
 *   Screen ─► Enrich    once screening confirms the stock (`screenStage: issue`)
 *   Enrich ─► Evaluate  once the dossier is complete, or the time limit passes
 *
 * Both run right after the agent call that can trigger them, and again from the
 * Finance sweep so a failed request can't strand a stock. Each is idempotent.
 */

type Db = PrismaClient;

/** Move a confirmed screening match into Enrich and open its enrichment slots. */
export async function advanceScreenedCandidate(
  db: Db,
  candidateId: string,
  settings?: PipelineSettingsValues,
  now = new Date(),
): Promise<boolean> {
  const values = settings ?? (await readPipelineSettings(db));
  return db.$transaction(async (tx) => {
    await financeLock(tx, `finance:candidate:${candidateId}`);
    const candidate = await tx.financeCandidate.findUnique({
      where: { id: candidateId },
      select: { id: true, stage: true, screenStage: true, tickerId: true, tickerSymbol: true, companyName: true },
    });
    if (!candidate || candidate.stage !== "screen" || candidate.screenStage !== "issue") return false;

    // Screening stores only the symbol; enrichment and everything after it
    // works from the ticker row, so link one now.
    let tickerId = candidate.tickerId;
    if (!tickerId) {
      if (!candidate.tickerSymbol) return false;
      const ticker = await tx.financeTicker.upsert({
        where: { symbol: candidate.tickerSymbol },
        update: {},
        create: { symbol: candidate.tickerSymbol, name: candidate.companyName ?? candidate.tickerSymbol },
        select: { id: true },
      });
      tickerId = ticker.id;
    }

    await tx.financeCandidate.update({ where: { id: candidateId }, data: { stage: "enrich", tickerId } });
    const pending = await tx.financePipelineJob.count({
      where: { candidateId, kind: "enrich", status: { in: ["queued", "running"] } },
    });
    if (pending === 0) {
      await tx.financePipelineJob.createMany({
        data: Array.from({ length: Math.max(1, values.researchersEnrich) }, () => ({
          candidateId,
          kind: "enrich" as const,
          nextRunAt: now,
        })),
      });
    }
    return true;
  });
}

/** Move a finished dossier into Evaluate: close enrichment, open evaluation slots. */
export async function advanceEnrichedCandidate(
  db: Db,
  candidateId: string,
  settings?: PipelineSettingsValues,
  now = new Date(),
): Promise<boolean> {
  const values = settings ?? (await readPipelineSettings(db));
  return db.$transaction(async (tx) => {
    await financeLock(tx, `finance:candidate:${candidateId}`);
    const candidate = await tx.financeCandidate.findUnique({
      where: { id: candidateId },
      select: {
        stage: true,
        evidence: { select: { section: true, tier: true } },
        jobs: { where: { kind: "enrich" }, select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 },
      },
    });
    if (!candidate || candidate.stage !== "enrich") return false;
    const ready = enrichmentReadyToAdvance({
      items: candidate.evidence,
      enrichOpenedAt: candidate.jobs[0]?.createdAt ?? null,
      timeLimitMinutes: values.stageTimeLimitMinutes,
      now,
    });
    if (!ready) return false;

    await tx.financeCandidate.update({ where: { id: candidateId }, data: { stage: "evaluate" } });
    await tx.financePipelineJob.updateMany({
      where: { candidateId, kind: "enrich", status: { in: ["queued", "running"] } },
      data: { status: "done", leaseUntil: null },
    });
    const pending = await tx.financePipelineJob.count({
      where: { candidateId, kind: "evaluate", status: { in: ["queued", "running"] } },
    });
    if (pending === 0) {
      await tx.financePipelineJob.createMany({
        data: Array.from({ length: Math.max(1, values.researchersEvaluate) }, () => ({
          candidateId,
          kind: "evaluate" as const,
          nextRunAt: now,
        })),
      });
    }
    return true;
  });
}

/** The sweep's pass over Screen and Enrich: retry any hand-off that was missed. */
export async function sweepEarlyStages(db: Db, now = new Date()) {
  const settings = await readPipelineSettings(db);
  const [screened, enriching] = await Promise.all([
    db.financeCandidate.findMany({ where: { stage: "screen", screenStage: "issue" }, select: { id: true }, take: 100 }),
    db.financeCandidate.findMany({ where: { stage: "enrich" }, select: { id: true }, take: 100 }),
  ]);
  let toEnrich = 0;
  let toEvaluate = 0;
  for (const c of screened) if (await advanceScreenedCandidate(db, c.id, settings, now)) toEnrich++;
  for (const c of enriching) if (await advanceEnrichedCandidate(db, c.id, settings, now)) toEvaluate++;
  return { toEnrich, toEvaluate };
}
