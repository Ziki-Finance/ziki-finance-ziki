/**
 * The screening rules for Finance (FIN-CR-013, §4.2), kept free of Prisma and
 * network calls so they can be tested directly.
 *
 * A candidate goes forward when at least two agents proposed it, or one
 * proposed it and another confirmed it. A failed code check drops it; missing
 * Finnhub data never does.
 */

export type FinanceCompanySizeValue = "any" | "small" | "mid" | "large";
export type FinanceCodeCheckStatusValue =
  | "not_checked"
  | "matched"
  | "failed"
  | "unavailable";
export type FinanceCandidateStageValue = "proposed" | "issue" | "dropped";

/** The free-data profile the code checks run against (Finnhub profile2). */
export type FinanceCompanyProfile = {
  ticker: string;
  name: string | null;
  /** Market capitalisation in millions of the quote currency (USD for US stocks). */
  marketCapitalization: number | null;
  industry: string | null;
  exchange: string | null;
};

export type FinanceCriteriaForCheck = {
  companySize: FinanceCompanySizeValue;
  industries: string[];
  leaveOut: string[];
};

export type FinanceCodeCheck = {
  rule: "companySize" | "industries" | "leaveOut";
  expected: string;
  actual: string;
  passed: boolean;
};

export type FinanceCodeCheckResult = {
  status: FinanceCodeCheckStatusValue;
  checks: FinanceCodeCheck[];
};

/** Small is under $2B, mid under $10B, large at or above $10B. */
export const SMALL_MARKET_CAP_MAX_MILLIONS = 2_000;
export const MID_MARKET_CAP_MAX_MILLIONS = 10_000;

/** At least two proposals, or one proposal and one confirmation. */
export const FINANCE_PROPOSALS_NEEDED = 2;

export function candidateRuleMet(counts: {
  proposals: number;
  confirmations: number;
}): boolean {
  if (counts.proposals >= FINANCE_PROPOSALS_NEEDED) return true;
  return counts.proposals >= 1 && counts.confirmations >= 1;
}

/** The stage a candidate belongs in after its signals and code check. */
export function candidateStageFor(input: {
  codeCheckStatus: FinanceCodeCheckStatusValue;
  proposals: number;
  confirmations: number;
}): FinanceCandidateStageValue {
  if (input.codeCheckStatus === "failed") return "dropped";
  return candidateRuleMet(input) ? "issue" : "proposed";
}

/** Rank by how many agents proposed it, then confirmations, then age. */
export function rankCandidates<
  T extends { proposals: number; confirmations: number; createdAt: Date },
>(candidates: readonly T[]): T[] {
  return [...candidates].sort((left, right) => {
    if (left.proposals !== right.proposals) return right.proposals - left.proposals;
    if (left.confirmations !== right.confirmations) {
      return right.confirmations - left.confirmations;
    }
    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

/** The size band a market cap (in millions) falls in. */
export function companySizeForMarketCap(
  marketCapMillions: number,
): Exclude<FinanceCompanySizeValue, "any"> | null {
  if (!Number.isFinite(marketCapMillions) || marketCapMillions <= 0) return null;
  if (marketCapMillions < SMALL_MARKET_CAP_MAX_MILLIONS) return "small";
  if (marketCapMillions < MID_MARKET_CAP_MAX_MILLIONS) return "mid";
  return "large";
}

export function formatMarketCap(marketCapMillions: number | null): string {
  if (marketCapMillions === null || !Number.isFinite(marketCapMillions)) {
    return "unknown";
  }
  if (marketCapMillions >= 1_000) {
    return `$${(marketCapMillions / 1_000).toFixed(1)}B`;
  }
  return `$${Math.round(marketCapMillions)}M`;
}

function normalizeIndustry(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Technology" matches "technology services"; "Banks" matches "banks". */
export function industryMatches(actual: string, tag: string): boolean {
  const a = normalizeIndustry(actual);
  const t = normalizeIndustry(tag);
  if (!a || !t) return false;
  return a === t || a.includes(t) || t.includes(a);
}

/**
 * Check a candidate against the criteria's code-checkable parts. A failed
 * check drops the candidate. A check whose data is missing (no Finnhub key,
 * an unknown ticker, no industry) is `unavailable`, never `failed`.
 */
export function checkCandidateAgainstCriteria(
  criteria: FinanceCriteriaForCheck,
  profile: FinanceCompanyProfile | null,
): FinanceCodeCheckResult {
  const needsCheck =
    criteria.companySize !== "any" ||
    criteria.industries.length > 0 ||
    criteria.leaveOut.length > 0;

  if (!needsCheck) return { status: "not_checked", checks: [] };
  if (!profile) return { status: "unavailable", checks: [] };

  const checks: FinanceCodeCheck[] = [];
  let missing = false;

  if (criteria.companySize !== "any") {
    const band = companySizeForMarketCap(profile.marketCapitalization ?? 0);
    if (band === null) {
      missing = true;
    } else {
      checks.push({
        rule: "companySize",
        expected: criteria.companySize,
        actual: `${band} (${formatMarketCap(profile.marketCapitalization)})`,
        passed: band === criteria.companySize,
      });
    }
  }

  const industry = profile.industry;
  if (criteria.industries.length > 0) {
    if (!industry) {
      missing = true;
    } else {
      checks.push({
        rule: "industries",
        expected: criteria.industries.join(", "),
        actual: industry,
        passed: criteria.industries.some((tag) => industryMatches(industry, tag)),
      });
    }
  }

  if (criteria.leaveOut.length > 0) {
    if (!industry) {
      missing = true;
    } else {
      const leftOut = criteria.leaveOut.find((tag) => industryMatches(industry, tag));
      checks.push({
        rule: "leaveOut",
        expected: criteria.leaveOut.join(", "),
        actual: industry,
        passed: leftOut === undefined,
      });
    }
  }

  if (checks.some((check) => !check.passed)) {
    return { status: "failed", checks };
  }
  if (missing) return { status: "unavailable", checks };
  return { status: "matched", checks };
}
