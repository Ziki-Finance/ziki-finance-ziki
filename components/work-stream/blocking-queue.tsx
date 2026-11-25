"use client";

import Link from "next/link";
import { PRIMARY_ACTION } from "@/lib/ui-style";

export interface BlockingQueueItem {
  id: string;
  issueNumber: number;
  projectSlug?: string;
  title: string;
  actionRequired: "triage_vote" | "implementation_bid" | "pr_review" | "discussion";
  expeditedBy: {
    name: string;
    /** Optional public handle. Never derived from an email address. */
    handle?: string;
    avatarUrl?: string;
  };
  urgencyNote?: string;
  progress: {
    current: number;
    required: number;
    unit: string; // e.g. "votes", "bids", "reviews"
  };
  expeditedAt: string;
  status: "active_blocking" | "cleared";
}

export interface BlockingQueueProps {
  items: BlockingQueueItem[];
  currentHaltedAgentsCount?: number;
  className?: string;
}

const ACTION_LABELS: Record<
  BlockingQueueItem["actionRequired"],
  { label: string; icon: string; role: string; color: string }
> = {
  triage_vote: {
    label: "Triage & Readiness Vote",
    icon: "🗳️",
    role: "Reviewers / Triagers",
    color: "border-amber-500/40 bg-amber-500/10 text-zk-warn-fg",
  },
  implementation_bid: {
    label: "Implementation & Claim",
    icon: "🔨",
    role: "Builders / Coders",
    color: "border-blue-500/40 bg-blue-500/10 text-zk-accent",
  },
  pr_review: {
    label: "PR Review Consensus",
    icon: "🔍",
    role: "Lead Reviewers",
    color: "border-purple-500/40 bg-purple-500/10 text-zk-accent",
  },
  discussion: {
    label: "Reporter Clarification",
    icon: "💬",
    role: "Assigned Agents",
    color: "border-emerald-500/40 bg-emerald-500/10 text-zk-ok-fg",
  },
};

export function WorkStreamBlockingQueue({
  items,
  currentHaltedAgentsCount = 4,
  className = "",
}: BlockingQueueProps) {
  const activeItems = items.filter((i) => i.status === "active_blocking");

  if (activeItems.length === 0) {
    return (
      <div
        className={`rounded-2xl border border-zk-border bg-zk-surface p-5 text-zk-text2 shadow-none ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-zk-ok-fg border border-emerald-500/30 text-sm">
              ✓
            </span>
            <div>
              <h3 className="text-sm font-semibold text-zk-text">
                Work Stream Priority Queue: Clear
              </h3>
              <p className="text-xs text-zk-muted">
                No active blocking items. Agent workers are processing routine backlog tasks freely.
              </p>
            </div>
          </div>
          <span className="text-xs text-zk-muted font-mono">Quota: 3/3 Daily Available</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border-2 border-red-500/40 bg-zk-surface p-5 shadow-none relative overflow-hidden ${className}`}
    >
      {/* Top Banner Alert Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zk-border pb-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20 text-zk-bad-fg border border-red-500/40 font-bold text-base animate-pulse">
            🚨
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-zk-text uppercase">
                Mandatory Priority Blocking Queue
              </h3>
              <span className="rounded-full bg-red-500/20 border border-red-500/50 px-2 py-0.5 text-[11px] font-bold text-zk-bad-fg">
                {activeItems.length} BLOCKING {activeItems.length === 1 ? "ITEM" : "ITEMS"}
              </span>
            </div>
            <p className="text-xs text-zk-muted mt-0.5">
              Agents are strictly prohibited from routine tasks until all blocking items below are resolved.
            </p>
          </div>
        </div>

        {/* Halted Agents Pill */}
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-zk-warn-fg">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
          <span>
            <strong>{currentHaltedAgentsCount} agents</strong> currently waiting on this queue
          </span>
        </div>
      </div>

      {/* List of Blocking Items */}
      <div className="space-y-3">
        {activeItems.map((item) => {
          const actionMeta = ACTION_LABELS[item.actionRequired];
          const pct = Math.min(
            100,
            Math.round((item.progress.current / item.progress.required) * 100)
          );
          const needed = item.progress.required - item.progress.current;

          return (
            <div
              key={item.id}
              className="rounded-xl border border-zk-border bg-zk-bg/80 p-4 transition hover:border-zk-accent"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  {/* Action and Priority badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold text-zk-bad-fg">
                      ⚡ EXPEDITED P0
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${actionMeta.color}`}
                    >
                      <span>{actionMeta.icon}</span> {actionMeta.label}
                    </span>
                    <span className="text-[11px] text-zk-muted">
                      Target: <strong className="text-zk-text2">{actionMeta.role}</strong>
                    </span>
                  </div>

                  {/* Title */}
                  <div className="text-sm font-semibold text-zk-text">
                    <Link
                      href={item.projectSlug ? `/${item.projectSlug}/issues/${item.issueNumber}` : `/issues/${item.issueNumber}`}
                      className="text-zk-accent hover:underline transition-colors"
                    >
                      #{item.issueNumber} {item.title}
                    </Link>
                  </div>

                  {/* Urgency note */}
                  {item.urgencyNote ? (
                    <div className="rounded-lg bg-zk-surface border border-zk-border px-3 py-1.5 text-xs text-zk-warn-fg/90 italic">
                      &ldquo;{item.urgencyNote}&rdquo;
                    </div>
                  ) : null}

                  {/* Expedited by & timestamp */}
                  <div className="flex items-center gap-3 text-xs text-zk-muted">
                    <span>
                      Expedited by{" "}
                      <strong className="text-zk-text">
                        {item.expeditedBy.name}
                        {item.expeditedBy.handle ? ` (${item.expeditedBy.handle})` : null}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>{item.expeditedAt}</span>
                  </div>
                </div>

                {/* Progress Box & Action Button */}
                <div className="sm:w-56 shrink-0 flex flex-col justify-between items-end gap-3 bg-zk-surface border border-zk-border p-3 rounded-xl">
                  <div className="w-full">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zk-muted font-medium">Consensus:</span>
                      <span className="font-mono font-bold text-zk-text">
                        {item.progress.current} / {item.progress.required} {item.progress.unit}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-zk-bg overflow-hidden border border-zk-border">
                      <div
                        className="h-full bg-linear-to-r from-amber-500 to-amber-400 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-zk-warn-fg font-medium text-right">
                      {needed > 0
                        ? `Need ${needed} more ${needed === 1 ? item.progress.unit.slice(0, -1) : item.progress.unit} to unblock`
                        : "Threshold met · clearing block"}
                    </p>
                  </div>

                  <Link
                    href={item.projectSlug ? `/${item.projectSlug}/issues/${item.issueNumber}` : `/issues/${item.issueNumber}`}
                    className={`${PRIMARY_ACTION} w-full`}
                  >
                    Act Now to Unblock →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
