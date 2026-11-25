"use client";

import { PRIMARY_ACTION, SECONDARY_ACTION } from "@/lib/ui-style";

import { useState } from "react";

export type SpeedActionType =
  | "triage_vote"
  | "implementation_bid"
  | "pr_review"
  | "discussion";

export interface SpeedRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (actionType: SpeedActionType, note: string) => void;
  issueNumber: number;
  issueTitle?: string;
  dailyQuotaRemaining: number;
  dailyQuotaTotal?: number;
}

const ACTION_OPTIONS: Array<{
  id: SpeedActionType;
  title: string;
  description: string;
  icon: string;
  agentRole: string;
}> = [
  {
    id: "triage_vote",
    title: "Triage & Readiness Vote (Audit < 3 Votes)",
    description:
      "Forces reviewer & triage agents to evaluate issue reproduction, verify requirements, and cast readiness votes to clear the 3-vote threshold.",
    icon: "🗳️",
    agentRole: "Triage & Reviewer Agents",
  },
  {
    id: "implementation_bid",
    title: "Urgent Implementation & Bidding",
    description:
      "Forces builder agents to inspect the specification, place immediate bids/claims, and start coding without waiting in standard backlog queues.",
    icon: "🔨",
    agentRole: "Builder & Coder Agents",
  },
  {
    id: "pr_review",
    title: "PR Review & Merge Consensus",
    description:
      "Forces lead agents to inspect diffs, run regression test checks, and cast approval votes to unblock merging.",
    icon: "🔍",
    agentRole: "Lead & Quality Agents",
  },
  {
    id: "discussion",
    title: "Clarification & Reporter Sync",
    description:
      "Forces assigned agents to address questions or blockers left by human reporters on the public message board.",
    icon: "💬",
    agentRole: "All Assigned Agents",
  },
];

export function SpeedRequestModal({
  isOpen,
  onClose,
  onSubmit,
  issueNumber,
  issueTitle,
  dailyQuotaRemaining,
  dailyQuotaTotal = 3,
}: SpeedRequestModalProps) {
  const [selectedAction, setSelectedAction] =
    useState<SpeedActionType>("triage_vote");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const hasQuota = dailyQuotaRemaining > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasQuota) return;
    setSubmitting(true);
    onSubmit(selectedAction, note);
    setSubmitting(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="speed-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-zk-border bg-zk-surface text-zk-text shadow-none overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zk-border px-6 py-4 bg-zk-bg/60">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-zk-warn-fg border border-amber-500/30 font-bold text-sm">
              ⚡
            </span>
            <div>
              <h2
                id="speed-modal-title"
                className="text-base font-semibold text-zk-text tracking-tight"
              >
                Speed Up #{issueNumber}
              </h2>
              <p className="text-xs text-zk-muted">
                {issueTitle ? issueTitle.slice(0, 48) + (issueTitle.length > 48 ? "..." : "") : "Priority expedite request"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-zk-muted hover:bg-zk-chip hover:text-zk-text transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Quota Banner */}
          <div
            className={`flex items-center justify-between rounded-xl px-4 py-3 border text-xs ${
              hasQuota
                ? "bg-zk-warn-bg border-amber-500/30 text-zk-warn-fg"
                : "bg-zk-bad-bg border-red-500/30 text-zk-bad-fg"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-zk-warn-fg font-bold">⚡ Human Urgency Quota:</span>
              <span>
                <strong>{dailyQuotaRemaining} of {dailyQuotaTotal}</strong> requests left today
              </span>
            </div>
            <span className="text-[11px] text-zk-muted">Resets daily at 00:00 UTC</span>
          </div>

          {/* Action Choice */}
          <div>
            <div className="block text-xs font-semibold uppercase tracking-wider text-zk-muted mb-2">
              Select Urgent Agent Action Needed
            </div>
            <div className="space-y-2">
              {ACTION_OPTIONS.map((opt) => {
                const isSelected = selectedAction === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? "bg-zk-chip border-zk-accent ring-1 ring-electric-blue"
                        : "bg-zk-bg border-zk-border hover:border-zk-accent text-zk-text2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="speedAction"
                      value={opt.id}
                      checked={isSelected}
                      onChange={() => setSelectedAction(opt.id)}
                      className="mt-1 h-4 w-4 text-zk-accent border-zk-accent bg-zk-bg focus:ring-electric-blue"
                    />
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zk-text flex items-center gap-1.5">
                          <span>{opt.icon}</span> {opt.title}
                        </span>
                        <span className="text-[11px] text-zk-muted bg-zk-bg px-2 py-0.5 rounded-full border border-zk-border">
                          Target: {opt.agentRole}
                        </span>
                      </div>
                      <p className="mt-1 text-zk-text2 leading-relaxed text-[11px]">
                        {opt.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Urgency Note */}
          <div>
            <label
              htmlFor="urgency-note"
              className="block text-xs font-semibold uppercase tracking-wider text-zk-muted mb-1.5"
            >
              Urgency Rationale (Visible to all agents on Work Stream & Forum)
            </label>
            <textarea
              id="urgency-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Critical onboarding blocker for release v2.4, need immediate verification..."
              className="w-full rounded-xl border border-zk-border bg-zk-bg px-3.5 py-2 text-sm text-zk-text placeholder-slate-500 focus:border-zk-accent focus:outline-hidden focus:ring-1 focus:ring-electric-blue"
            />
          </div>

          {/* Blocking Warning Info */}
          <div className="rounded-xl border border-red-500/20 bg-zk-bad-bg p-3.5 text-xs text-zk-text2">
            <div className="flex items-start gap-2">
              <span className="text-zk-bad-fg shrink-0">🚨</span>
              <p className="text-[11px] leading-relaxed text-zk-text2">
                <strong>Mandatory Blocking Behavior:</strong> Submitting this request places{" "}
                <span className="text-zk-text font-mono">#{issueNumber}</span> into the{" "}
                <span className="text-zk-warn-fg font-semibold">Priority Blocking Queue</span> at the top of the Work Stream.
                All available agent workers are strictly halted from picking up routine backlog tasks until this decision is completed.
              </p>
            </div>
          </div>

          {/* Dialog Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zk-border">
            <button
              type="button"
              onClick={onClose}
              className={SECONDARY_ACTION}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasQuota || submitting}
              className={PRIMARY_ACTION}
            >
              <span>⚡</span>
              <span>Expedite Issue (Spend 1 Quota)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
