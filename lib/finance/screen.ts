import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/finance/finnhub";
import {
  candidateRuleMet,
  candidateStageFor,
  checkCandidateAgainstCriteria,
  FINANCE_PROPOSALS_NEEDED,
  rankCandidates,
  type FinanceCodeCheckResult,
  type FinanceCodeCheckStatusValue,
} from "@/lib/finance/screen-rules";
import type { FinanceCandidateSignalInput } from "@/lib/validations/finance";

/**
 * The discovery / screen engine (FIN-CR-013, Stream A, job 4).
 *
 * Agents browse public sources and propose stocks for a run. A second agent's
 * proposal — or another agent's confirmation — makes a candidate a match
 * (`stage: issue`). Finnhub's free data checks the numeric tags by code; a
 * failed check drops the candidate, missing data never does.
 */

export class FinanceScreenError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FinanceScreenError";
  }
}

const candidateSignalSelect = {
  id: true,
  kind: true,
  whyItFits: true,
  sources: true,
  createdAt: true,
  agent: { select: { id: true, name: true } },
} satisfies Prisma.FinanceCandidateSignalSelect;

type CandidateSignalRow = Prisma.FinanceCandidateSignalGetPayload<{
  select: typeof candidateSignalSelect;
}>;

function countsOf(signals: readonly { kind: "proposed" | "confirmed" }[]) {
  return {
    proposals: signals.filter((signal) => signal.kind === "proposed").length,
    confirmations: signals.filter((signal) => signal.kind === "confirmed").length,
  };
}

function signalView(signal: CandidateSignalRow) {
  return {
    id: signal.id,
    kind: signal.kind,
    whyItFits: signal.whyItFits,
    sources: signal.sources,
    createdAt: signal.createdAt,
    agent: signal.agent,
  };
}

function candidateView(
  candidate: {
    id: string;
    ticker: string;
    companyName: string | null;
    stage: "proposed" | "issue" | "dropped";
    codeCheckStatus: FinanceCodeCheckStatusValue;
    codeCheckDetail: Prisma.JsonValue | null;
    confirmedAt: Date | null;
    createdAt: Date;
    signals: CandidateSignalRow[];
  },
) {
  const counts = countsOf(candidate.signals);
  return {
    id: candidate.id,
    ticker: candidate.ticker,
    companyName: candidate.companyName,
    stage: candidate.stage,
    codeCheckStatus: candidate.codeCheckStatus,
    codeCheckDetail: candidate.codeCheckDetail,
    confirmedAt: candidate.confirmedAt,
    createdAt: candidate.createdAt,
    proposals: counts.proposals,
    confirmations: counts.confirmations,
    ruleMet: candidateRuleMet(counts),
    signals: candidate.signals.map(signalView),
  };
}

const runInclude = {
  criteriaVersion: true,
  criteria: { select: { id: true, preset: true, words: true } },
  candidates: {
    orderBy: { createdAt: "asc" as const },
    include: {
      signals: { select: candidateSignalSelect, orderBy: { createdAt: "asc" as const } },
    },
  },
} satisfies Prisma.FinanceRunInclude;

type RunRow = Prisma.FinanceRunGetPayload<{ include: typeof runInclude }>;

function runView(run: RunRow) {
  const candidates = rankCandidates(
    run.candidates.map((candidate) => ({
      ...candidate,
      ...countsOf(candidate.signals),
      view: candidateView(candidate),
    })),
  ).map((candidate) => candidate.view);

  return {
    id: run.id,
    stage: run.stage,
    createdAt: run.createdAt,
    criteriaId: run.criteriaId,
    criteriaVersionId: run.criteriaVersionId,
    criteria: {
      id: run.criteria.id,
      preset: run.criteria.preset,
      words: run.criteria.words,
      version: run.criteriaVersion.version,
      companySize: run.criteriaVersion.companySize,
      industries: run.criteriaVersion.industries,
      leaveOut: run.criteriaVersion.leaveOut,
      howManyStocks: run.criteriaVersion.howManyStocks,
    },
    candidates,
  };
}

/** Every run the owner started, newest first. */
export async function listFinanceRuns(ownerId: string) {
  const runs = await prisma.financeRun.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      stage: true,
      createdAt: true,
      criteriaId: true,
      criteriaVersionId: true,
      criteria: { select: { preset: true, words: true } },
      criteriaVersion: { select: { version: true } },
      _count: { select: { candidates: true } },
    },
  });

  return runs.map((run) => ({
    id: run.id,
    stage: run.stage,
    createdAt: run.createdAt,
    criteriaId: run.criteriaId,
    criteriaVersionId: run.criteriaVersionId,
    criteria: {
      preset: run.criteria.preset,
      words: run.criteria.words,
      version: run.criteriaVersion.version,
    },
    candidateCount: run._count.candidates,
  }));
}

/** One run with its criteria version and ranked candidates, scoped to the owner. */
export async function getFinanceRun(ownerId: string, runId: string) {
  const run = await prisma.financeRun.findFirst({
    where: { id: runId, ownerId },
    include: runInclude,
  });
  return run ? runView(run) : null;
}

/**
 * The screening jobs in the Finance work feed: one per run still at `screen`,
 * with the criteria version it uses and the candidates already proposed.
 */
export async function screenJobsForOwner(ownerId: string) {
  const runs = await prisma.financeRun.findMany({
    where: { ownerId, stage: "screen" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: runInclude,
  });

  return runs.map((run) => ({
    jobId: run.id,
    runId: run.id,
    kind: "screen" as const,
    createdAt: run.createdAt,
    criteria: {
      criteriaId: run.criteriaId,
      versionId: run.criteriaVersionId,
      version: run.criteriaVersion.version,
      preset: run.criteriaVersion.preset,
      words: run.criteriaVersion.words,
      companySize: run.criteriaVersion.companySize,
      industries: run.criteriaVersion.industries,
      leaveOut: run.criteriaVersion.leaveOut,
      howManyStocks: run.criteriaVersion.howManyStocks,
    },
    candidateRule: {
      proposalsNeeded: FINANCE_PROPOSALS_NEEDED,
      proposalsOrConfirmations: 1,
      description:
        "A stock goes forward when at least 2 agents proposed it, or 1 proposed it and another confirmed it.",
    },
    existingCandidates: rankCandidates(
      run.candidates.map((candidate) => ({
        ...candidate,
        ...countsOf(candidate.signals),
        view: {
          ticker: candidate.ticker,
          companyName: candidate.companyName,
          stage: candidate.stage,
          codeCheckStatus: candidate.codeCheckStatus,
          ...countsOf(candidate.signals),
        },
      })),
    ).map((candidate) => candidate.view),
  }));
}

type SignalActor = {
  agentId: string;
  ownerId: string;
};

/**
 * Record one agent's proposal or confirmation and recompute the candidate.
 *
 * Duplicate signals are refused (one per agent per kind), a confirmation must
 * name an existing proposal by a different agent, and screening is closed once
 * the run leaves the `screen` stage.
 */
export async function recordFinanceCandidateSignal(
  actor: SignalActor,
  input: FinanceCandidateSignalInput,
) {
  const run = await prisma.financeRun.findFirst({
    where: { id: input.runId, ownerId: actor.ownerId },
    include: { criteriaVersion: true },
  });
  if (!run) throw new FinanceScreenError(404, "Run not found.");
  if (run.stage !== "screen") {
    throw new FinanceScreenError(409, "Screening has closed for this run.");
  }

  const existing = await prisma.financeCandidate.findUnique({
    where: { runId_ticker: { runId: run.id, ticker: input.ticker } },
    include: { signals: { select: { agentId: true, kind: true } } },
  });

  if (input.kind === "confirmed") {
    if (!existing) {
      throw new FinanceScreenError(
        409,
        "Propose the stock before another agent confirms it.",
      );
    }
    if (
      existing.signals.some(
        (signal) =>
          signal.kind === "proposed" && signal.agentId === actor.agentId,
      )
    ) {
      throw new FinanceScreenError(
        409,
        "Only another agent can confirm a stock you proposed.",
      );
    }
    if (
      existing.signals.some(
        (signal) =>
          signal.kind === "confirmed" && signal.agentId === actor.agentId,
      )
    ) {
      throw new FinanceScreenError(409, "You already confirmed this stock.");
    }
  }

  if (
    input.kind === "proposed" &&
    existing?.signals.some(
      (signal) => signal.kind === "proposed" && signal.agentId === actor.agentId,
    )
  ) {
    throw new FinanceScreenError(409, "You already proposed this stock.");
  }

  // Only call the free data API when a tag can actually be checked, and only
  // when there is no check yet or the last one had no data.
  const needsProfile =
    run.criteriaVersion.companySize !== "any" ||
    run.criteriaVersion.industries.length > 0 ||
    run.criteriaVersion.leaveOut.length > 0;
  const shouldCheck =
    needsProfile &&
    (!existing ||
      existing.codeCheckStatus === "not_checked" ||
      existing.codeCheckStatus === "unavailable");
  let codeCheck: FinanceCodeCheckResult = {
    status: existing?.codeCheckStatus ?? "not_checked",
    checks: [],
  };
  if (shouldCheck) {
    const profile = await getCompanyProfile(input.ticker);
    codeCheck = checkCandidateAgainstCriteria(
      {
        companySize: run.criteriaVersion.companySize,
        industries: run.criteriaVersion.industries,
        leaveOut: run.criteriaVersion.leaveOut,
      },
      profile,
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const codeCheckData = shouldCheck
        ? {
            codeCheckStatus: codeCheck.status,
            codeCheckDetail: { checks: codeCheck.checks } as Prisma.InputJsonValue,
          }
        : {};

      const candidate = existing
        ? await tx.financeCandidate.update({
            where: { id: existing.id },
            data: {
              ...codeCheckData,
              ...(existing.companyName || !input.companyName
                ? {}
                : { companyName: input.companyName }),
            },
            select: { id: true, confirmedAt: true },
          })
        : await tx.financeCandidate.create({
            data: {
              runId: run.id,
              ticker: input.ticker,
              companyName: input.companyName,
              ...codeCheckData,
            },
            select: { id: true, confirmedAt: true },
          });

      await tx.financeCandidateSignal.create({
        data: {
          candidateId: candidate.id,
          agentId: actor.agentId,
          kind: input.kind,
          whyItFits: input.whyItFits as Prisma.InputJsonValue,
          sources: input.sources,
        },
      });

      const signals = await tx.financeCandidateSignal.findMany({
        where: { candidateId: candidate.id },
        select: { kind: true },
      });
      const counts = countsOf(signals);
      const stage = candidateStageFor({
        codeCheckStatus: codeCheck.status,
        ...counts,
      });
      await tx.financeCandidate.update({
        where: { id: candidate.id },
        data: {
          stage,
          confirmedAt:
            stage === "issue" ? candidate.confirmedAt ?? new Date() : null,
        },
      });

      return { candidateId: candidate.id, stage, ...counts };
    });

    const view = await prisma.financeCandidate.findUnique({
      where: { id: result.candidateId },
      include: {
        signals: { select: candidateSignalSelect, orderBy: { createdAt: "asc" } },
      },
    });
    if (!view) throw new FinanceScreenError(404, "Candidate not found.");

    return {
      ...candidateView(view),
      run: { id: run.id, stage: run.stage },
    };
  } catch (error) {
    // The unique key is the last guard against two simultaneous identical signals.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new FinanceScreenError(409, "That signal was already recorded.");
    }
    throw error;
  }
}
