import type { Substatus } from "@prisma/client";

/**
 * Where the latest pull request report puts an issue past review (#release-step). Ziki doesn't check GitHub to decide
 * whether work shipped: it follows what the latest report on the issue's linked pull request says, and moves the issue
 * when that changes.
 *
 * - In Merge: Error when the pull request can't merge as it is (closed, missing, conflicting or failing checks); Awaiting
 *   release when it is merged into another branch (such as staging) that isn't released to the default branch; else
 *   Ready to merge (a merged and released one waits there for the merger to resolve it).
 * - Done · Accepted: only a merged-but-unreleased report moves it, to Awaiting release; anything else waits for the
 *   manager's review.
 * - Live (On dev, On staging, On prod): stays while the report says merged into the default branch. Otherwise the
 *   work isn't in released code, so it steps back into Merge: Awaiting release, Error, or Ready to merge for an open
 *   pull request. Force-merged, Broken and Published work is judged by its own rules and doesn't move here.
 *
 * Returns the step to move to, or null to stay.
 */
export type ReleaseReport = { state: string; inDefaultBranch?: boolean | null; mergeable?: boolean | null; checks?: string | null };

const LIVE_STEPS: readonly Substatus[] = ["on_dev", "on_staging", "on_prod"];
const MERGE_STEPS: readonly Substatus[] = ["ready_to_merge", "error", "awaiting_release"];

function mergeStep(report: ReleaseReport): "ready_to_merge" | "error" | "awaiting_release" {
  if (report.state === "closed" || report.state === "not_found") return "error";
  if (report.state === "open" && (report.mergeable === false || report.checks === "failing")) return "error";
  if (report.state === "merged" && report.inDefaultBranch === false) return "awaiting_release";
  return "ready_to_merge";
}

export function releaseStepFor(current: Substatus, report: ReleaseReport): Substatus | null {
  let next: Substatus | null = null;
  if (MERGE_STEPS.includes(current)) next = mergeStep(report);
  else if (current === "accepted") next = report.state === "merged" && report.inDefaultBranch === false ? "awaiting_release" : null;
  else if (LIVE_STEPS.includes(current)) {
    const released = report.state === "merged" && report.inDefaultBranch !== false;
    next = released ? null : mergeStep(report);
  }
  return next && next !== current ? next : null;
}

/** The steps a report may move an issue out of: Merge's, Done · Accepted and Live's deployment steps. */
export const REPORT_MOVES_FROM: readonly Substatus[] = [...MERGE_STEPS, "accepted", ...LIVE_STEPS];
