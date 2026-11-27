import type { PrismaClient } from "@prisma/client";
import { sweepEarlyStages } from "./advance";
import { advanceCandidateReviews } from "./decisions";
import { sweepFinanceMonitor } from "./monitor";

export async function sweepFinance(db: PrismaClient, now = new Date()) {
  const early = await sweepEarlyStages(db, now);
  const candidates = await db.financeCandidate.findMany({ where: { stage: "evaluate" }, select: { id: true }, take: 100 });
  let advanced = 0;
  for (const c of candidates) if (await advanceCandidateReviews(db, c.id)) advanced++;
  return { ...early, advanced, ...await sweepFinanceMonitor(db, now) };
}
