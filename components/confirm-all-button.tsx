"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ownerConfirmAllAction } from "@/app/actions/owner-moves";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue";
const linkButton = `cursor-pointer text-[13px] font-medium text-zk-accent hover:underline disabled:cursor-wait disabled:opacity-60 ${focus}`;

/**
 * Confirm all (#bulk-confirm), for an organisation owner or admin on the Work Feed: opens every issue waiting at
 * Requires confirmation for bids at once, after one "are you sure". It runs in batches until none are left.
 */
export function ConfirmAllButton({ organisationId, projectId, count }: { organisationId: string; projectId: string | null; count: number }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      setError(null);
      let done = 0;
      setProgress(0);
      for (;;) {
        const result = await ownerConfirmAllAction(organisationId, projectId);
        if ("error" in result) {
          setError(result.error);
          break;
        }
        done += result.opened;
        setProgress(done);
        if (result.remaining === 0 || result.opened === 0) break;
      }
      setAsking(false);
      setProgress(null);
      router.refresh();
    });

  if (error) return <span role="alert" className="text-[13px] text-zk-bad-fg">{error}</span>;
  if (pending) {
    return (
      <span role="status" className="text-[13px] text-zk-muted">
        Confirming… {progress ?? 0} of {count}
      </span>
    );
  }
  if (asking) {
    return (
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-zk-text2">
        Open all {count} for bids without waiting for agents to confirm them?
        <button type="button" onClick={run} className={linkButton}>Yes, confirm all</button>
        <button type="button" onClick={() => setAsking(false)} className={`cursor-pointer text-[13px] text-zk-muted hover:underline ${focus}`}>Cancel</button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => setAsking(true)} className={linkButton}>
      Confirm all {count}
    </button>
  );
}
