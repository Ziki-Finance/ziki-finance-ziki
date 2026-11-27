import type { Prisma } from "@prisma/client";

/**
 * What the research pipeline panel shows for the Screen stage and for the
 * work going on in a stage: who proposed a stock and why, what the code check
 * found, and how many agent slots are open or working. Plain data, safe to
 * pass to a client component.
 */

export type ScreenSignalView = {
  id: string;
  kind: "proposed" | "confirmed";
  agentLabel: string;
  whyItFits: Array<{ criterion: string; why: string }>;
  sources: string[];
  createdAt: string;
};

export type ScreenCodeCheckView = {
  status: "not_checked" | "matched" | "failed" | "unavailable";
  checks: Array<{ rule: string; expected: string; actual: string; passed: boolean }>;
};

export type PipelineScreeningView = {
  screenStage: "proposed" | "issue" | "dropped";
  signals: ScreenSignalView[];
  codeCheck: ScreenCodeCheckView;
};

export type StageActivityView = { queued: number; working: number; done: number; failed: number };
export type PipelineActivityView = Partial<Record<"enrich" | "evaluate" | "review" | "decide", StageActivityView>>;

/** The candidate fields the panel needs on top of what the pages already load. */
export const candidateStageViewSelect = {
  screenStage: true,
  codeCheckStatus: true,
  codeCheckDetail: true,
  signals: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      whyItFits: true,
      sources: true,
      createdAt: true,
      agent: { select: { name: true } },
    },
  },
  jobs: { select: { kind: true, status: true } },
} satisfies Prisma.FinanceCandidateSelect;

export type CandidateStageViewRow = Prisma.FinanceCandidateGetPayload<{ select: typeof candidateStageViewSelect }>;

function whyItFitsOf(value: unknown): ScreenSignalView["whyItFits"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { criterion, why } = entry as Record<string, unknown>;
    if (typeof why !== "string" || !why.trim()) return [];
    return [{ criterion: typeof criterion === "string" ? criterion : "", why }];
  });
}

function checksOf(detail: unknown): ScreenCodeCheckView["checks"] {
  const checks = detail && typeof detail === "object" ? (detail as { checks?: unknown }).checks : null;
  if (!Array.isArray(checks)) return [];
  return checks.flatMap((c) => {
    if (!c || typeof c !== "object") return [];
    const { rule, expected, actual, passed } = c as Record<string, unknown>;
    if (typeof rule !== "string") return [];
    return [{ rule, expected: String(expected ?? ""), actual: String(actual ?? ""), passed: passed === true }];
  });
}

export function screeningView(row: Pick<CandidateStageViewRow, "screenStage" | "codeCheckStatus" | "codeCheckDetail" | "signals">): PipelineScreeningView {
  return {
    screenStage: row.screenStage,
    signals: row.signals.map((s) => ({
      id: s.id,
      kind: s.kind,
      agentLabel: s.agent?.name ?? "An agent",
      whyItFits: whyItFitsOf(s.whyItFits),
      sources: s.sources,
      createdAt: s.createdAt.toISOString().slice(0, 10),
    })),
    codeCheck: { status: row.codeCheckStatus, checks: checksOf(row.codeCheckDetail) },
  };
}

export function activityView(jobs: readonly { kind: string; status: string }[]): PipelineActivityView {
  const out: PipelineActivityView = {};
  for (const job of jobs) {
    if (job.kind !== "enrich" && job.kind !== "evaluate" && job.kind !== "review" && job.kind !== "decide") continue;
    const slot = (out[job.kind] ??= { queued: 0, working: 0, done: 0, failed: 0 });
    if (job.status === "queued") slot.queued++;
    else if (job.status === "running") slot.working++;
    else if (job.status === "done") slot.done++;
    else if (job.status === "failed") slot.failed++;
  }
  return out;
}
