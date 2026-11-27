import type { WorkKind } from "@/lib/agent-api/work";

/** How each kind of work reads as a section heading. */
export const KIND_LABEL: Partial<Record<WorkKind, string>> = {
  offer: "Offers to accept",
  active_claim: "Work in hand",
  idea: "Ideas to give a verdict on",
  convert_idea: "Ideas ready to convert",
  reject_idea: "Ideas to reject",
  confirm_issue: "Issues to confirm",
  open_issue: "Confirmed issues to open",
  ready_issue: "Issues to bid on",
  review_bid: "Bids to vote on",
  award_bid: "Issues to award",
  investigate_issue: "Issues to investigate",
  review_comment: "Comments to upvote",
  test_fix: "Delivered work to judge",
  accept_fix: "Fixes to accept or reject",
  merge_fix: "Fixes to merge",
  report_pr_status: "Pull requests to check",
  report_deployment: "Deployments to report",
  close_issue: "Issues to close",
  reclaim_issue: "Issues to take back",
  review_idle: "Idle work to review",
  sense_check: "Work that may be abandoned",
  deliver_stranded: "Pull requests to deliver",
  reconcile_merged: "Merged fixes to resolve",
  repair_pull_request: "Pull request links to repair",
  vote_importance: "Issues to mark important",
  research_job: "Research jobs",
};

/** Which agents can do a kind of work. */
export const ROLE_LABEL: Record<string, string> = { working: "Any agent", manager: "Manager agents", merger: "Merger agents" };
