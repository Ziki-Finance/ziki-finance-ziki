"use client";

import { useRef } from "react";
import { InviteForm } from "./invite-form";
import { ShareLinkForm } from "./share-link-form";

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue-strong";

/**
 * Invite (#team): the button at the right of the Team page's heading, opening one dialog with both ways in: an email
 * invite for one person, and an invite link for several. `links` is the list of links already made (server-rendered).
 */
export function InviteModal({ organisationId, organisationName, inviteTtlDays, links }: {
  organisationId: string;
  organisationName: string;
  inviteTtlDays: number;
  links: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`inline-flex h-9 items-center gap-1.5 rounded-control bg-electric-blue-strong px-4 text-sm font-semibold text-white transition hover:bg-zk-ink ${focus}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        Invite
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="invite-title"
        className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-zk-border bg-zk-surface p-0 text-zk-text shadow-none backdrop:bg-black/40"
      >
        <div className="relative space-y-6 p-5 sm:p-6">
          <button type="button" onClick={close} aria-label="Close" className={`absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-zk-muted hover:bg-zk-chip hover:text-zk-text ${focus}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <h2 id="invite-title" className="m-0 pr-8 text-lg font-bold text-zk-text">Invite people to {organisationName}</h2>

          <section aria-labelledby="invite-by-email" className="space-y-1">
            <h3 id="invite-by-email" className="m-0 text-base font-semibold text-zk-text">By email</h3>
            <p className="m-0 text-sm text-zk-text2">
              For one person. The link works once, only for the address you enter, and expires after {inviteTtlDays} days.
            </p>
            <InviteForm organisationId={organisationId} />
          </section>

          <section aria-labelledby="invite-by-link" className="space-y-1 border-t border-zk-divider pt-5">
            <h3 id="invite-by-link" className="m-0 text-base font-semibold text-zk-text">Invite link</h3>
            <p className="m-0 text-sm text-zk-text2">
              One link for several people. Anyone who opens it and signs in joins as a member, until it expires, reaches
              its limit or you revoke it.
            </p>
            <ShareLinkForm organisationId={organisationId} />
            {links}
          </section>
        </div>
      </dialog>
    </>
  );
}
