import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * The Finance thresholds the v3 pipeline reads (PRD §3, §4.3, §4.4), set by
 * staff on `/superadmin/finance`. They live beside the agreement numbers in
 * `lib/finance/settings.ts` rather than replacing them, so the v1 settle logic
 * keeps working unchanged.
 */

export const FINANCE_EVIDENCE_SECTIONS = [
  "business",
  "numbers",
  "filings",
  "news",
  "social",
  "market_context",
] as const;

export type FinanceEvidenceSectionName = (typeof FINANCE_EVIDENCE_SECTIONS)[number];

/** The sections that must each have a tier 1–2 item before enrichment ends (PRD §4.3). */
export const REQUIRED_SECTIONS: readonly FinanceEvidenceSectionName[] = [
  "business",
  "numbers",
  "filings",
  "news",
  "market_context",
];

export const FINANCE_CANDIDATE_RULES = ["proposed_by_2", "proposed_1_confirmed_by_1"] as const;
export type FinanceCandidateRule = (typeof FINANCE_CANDIDATE_RULES)[number];

export type FinanceDossierCaps = Partial<Record<FinanceEvidenceSectionName, number>>;

export type PipelineSettingsValues = {
  researchersScreen: number;
  researchersEnrich: number;
  researchersEvaluate: number;
  reviewersPerStock: number;
  reviewersWhoMustAgree: number;
  candidateRule: FinanceCandidateRule;
  dossierCaps: FinanceDossierCaps;
  stageTimeLimitMinutes: number;
  balanceShare: number;
  browsingRules: string;
  oneTaskPerAgent: boolean;
};

export const DEFAULT_PIPELINE_SETTINGS: PipelineSettingsValues = {
  researchersScreen: 3,
  researchersEnrich: 3,
  researchersEvaluate: 5,
  reviewersPerStock: 3,
  reviewersWhoMustAgree: 2,
  candidateRule: "proposed_by_2",
  dossierCaps: {},
  stageTimeLimitMinutes: 20,
  balanceShare: 35,
  browsingRules: "",
  oneTaskPerAgent: true,
};

export type PipelineSettingsError =
  | "invalid_number"
  | "invalid_share"
  | "invalid_candidate_rule"
  | "reviewers_above_slots"
  | "invalid_dossier_cap"
  | "browsing_rules_too_long";

export const PIPELINE_SETTINGS_ERRORS: Record<PipelineSettingsError, string> = {
  invalid_number: "Each slot and time limit must be a whole number of 1 or more.",
  invalid_share: "The balance share must be a whole number from 1 to 100.",
  invalid_candidate_rule: "Pick one of the two candidate rules.",
  reviewers_above_slots: "The reviewers who must agree can't be more than the reviewer slots.",
  invalid_dossier_cap: "Each dossier cap must be a whole number of 1 or more, or left empty for no cap.",
  browsing_rules_too_long: "The browsing rules can be at most 2,000 characters.",
};

/** A whole number of at least `min`, or null. */
function wholeNumber(value: unknown, min = 1): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n >= min ? n : null;
}

export type PipelineSettingsInput = {
  researchersScreen?: unknown;
  researchersEnrich?: unknown;
  researchersEvaluate?: unknown;
  reviewersPerStock?: unknown;
  reviewersWhoMustAgree?: unknown;
  candidateRule?: unknown;
  stageTimeLimitMinutes?: unknown;
  balanceShare?: unknown;
  browsingRules?: unknown;
  oneTaskPerAgent?: unknown;
  /** One entry per section, e.g. { news: "8" }. Empty or absent means no cap. */
  dossierCaps?: Partial<Record<FinanceEvidenceSectionName, unknown>>;
};

export function parsePipelineSettings(
  input: PipelineSettingsInput,
): { ok: true; values: PipelineSettingsValues } | { ok: false; error: PipelineSettingsError } {
  const researchersScreen = wholeNumber(input.researchersScreen);
  const researchersEnrich = wholeNumber(input.researchersEnrich);
  const researchersEvaluate = wholeNumber(input.researchersEvaluate);
  const reviewersPerStock = wholeNumber(input.reviewersPerStock);
  const reviewersWhoMustAgree = wholeNumber(input.reviewersWhoMustAgree);
  const stageTimeLimitMinutes = wholeNumber(input.stageTimeLimitMinutes);
  const balanceShare = wholeNumber(input.balanceShare);

  if (
    researchersScreen === null ||
    researchersEnrich === null ||
    researchersEvaluate === null ||
    reviewersPerStock === null ||
    reviewersWhoMustAgree === null ||
    stageTimeLimitMinutes === null
  ) {
    return { ok: false, error: "invalid_number" };
  }
  if (balanceShare === null || balanceShare > 100) return { ok: false, error: "invalid_share" };

  const candidateRule = String(input.candidateRule ?? "") as FinanceCandidateRule;
  if (!(FINANCE_CANDIDATE_RULES as readonly string[]).includes(candidateRule)) {
    return { ok: false, error: "invalid_candidate_rule" };
  }
  if (reviewersWhoMustAgree > reviewersPerStock) {
    return { ok: false, error: "reviewers_above_slots" };
  }

  const dossierCaps: FinanceDossierCaps = {};
  for (const section of FINANCE_EVIDENCE_SECTIONS) {
    const raw = input.dossierCaps?.[section];
    const text = String(raw ?? "").trim();
    if (!text) continue;
    const cap = wholeNumber(text);
    if (cap === null) return { ok: false, error: "invalid_dossier_cap" };
    dossierCaps[section] = cap;
  }

  const browsingRules = String(input.browsingRules ?? "").trim();
  if (browsingRules.length > 2000) return { ok: false, error: "browsing_rules_too_long" };

  return {
    ok: true,
    values: {
      researchersScreen,
      researchersEnrich,
      researchersEvaluate,
      reviewersPerStock,
      reviewersWhoMustAgree,
      candidateRule,
      dossierCaps,
      stageTimeLimitMinutes,
      balanceShare,
      browsingRules,
      oneTaskPerAgent: input.oneTaskPerAgent === true || input.oneTaskPerAgent === "on" || input.oneTaskPerAgent === "true",
    },
  };
}

type Db = PrismaClient | Prisma.TransactionClient;

function asCaps(json: Prisma.JsonValue): FinanceDossierCaps {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: FinanceDossierCaps = {};
  for (const section of FINANCE_EVIDENCE_SECTIONS) {
    const value = (json as Record<string, unknown>)[section];
    if (typeof value === "number" && Number.isInteger(value) && value >= 1) out[section] = value;
  }
  return out;
}

export async function readPipelineSettings(db: Db): Promise<PipelineSettingsValues> {
  const row = await db.financeSettings.findUnique({
    where: { id: "default" },
    select: {
      researchersScreen: true,
      researchersEnrich: true,
      researchersEvaluate: true,
      reviewersPerStock: true,
      reviewersWhoMustAgree: true,
      candidateRule: true,
      dossierCaps: true,
      stageTimeLimitMinutes: true,
      balanceShare: true,
      browsingRules: true,
      oneTaskPerAgent: true,
    },
  });
  if (!row) return DEFAULT_PIPELINE_SETTINGS;
  return {
    researchersScreen: row.researchersScreen,
    researchersEnrich: row.researchersEnrich,
    researchersEvaluate: row.researchersEvaluate,
    reviewersPerStock: row.reviewersPerStock,
    reviewersWhoMustAgree: row.reviewersWhoMustAgree,
    candidateRule: (FINANCE_CANDIDATE_RULES as readonly string[]).includes(row.candidateRule)
      ? (row.candidateRule as FinanceCandidateRule)
      : DEFAULT_PIPELINE_SETTINGS.candidateRule,
    dossierCaps: asCaps(row.dossierCaps),
    stageTimeLimitMinutes: row.stageTimeLimitMinutes,
    balanceShare: row.balanceShare,
    browsingRules: row.browsingRules,
    oneTaskPerAgent: row.oneTaskPerAgent,
  };
}

/** Staff save the pipeline thresholds. Unlike the agreement numbers, these are
 * not settled against, so no audit row is written for them. */
export async function savePipelineSettings(
  db: PrismaClient,
  values: PipelineSettingsValues,
): Promise<void> {
  await db.financeSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...values, dossierCaps: values.dossierCaps as Prisma.InputJsonValue },
    update: { ...values, dossierCaps: values.dossierCaps as Prisma.InputJsonValue },
  });
}
