"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PublicContributorForm } from "@/components/public-contributor-form";
import type { FeedbackPortalProject } from "@/lib/public-projects";
export function FeedbackComposeDialog({ product }: { product: FeedbackPortalProject; signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => { if (open) { dialog.current?.showModal(); dialog.current?.querySelector("textarea")?.focus(); } }, [open]);
  function close() { if (busy) return; dialog.current?.close(); setOpen(false); }
  return <><Button onClick={() => setOpen(true)}>Add feedback</Button>{open ? <dialog ref={dialog} aria-labelledby={title} onCancel={event => { event.preventDefault(); close(); }} className="m-auto max-h-[90dvh] w-[min(40rem,calc(100vw-1rem))] overflow-y-auto rounded-panel border border-zk-border bg-zk-surface p-4 text-zk-text shadow-xl backdrop:bg-black/40 sm:p-5">
    <div className="mb-4 flex items-center gap-3"><h2 id={title} className="text-base font-semibold">Add feedback</h2><span className="border-l border-zk-divider pl-3 text-sm text-zk-muted">{product.name}</span><button type="button" aria-label="Close" disabled={busy} onClick={close} className="ml-auto flex h-8 w-8 items-center justify-center rounded-control text-zk-muted hover:bg-zk-chip focus-visible:outline-2 focus-visible:outline-zk-accent">×</button></div>
    <PublicContributorForm compact project={product} orgSlug={product.organisation.slug} projectSlug={product.slug} onCancel={close} onBusyChange={setBusy} />
  </dialog> : null}</>;
}
