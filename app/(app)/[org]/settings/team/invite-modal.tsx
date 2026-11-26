"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { LocalTime } from "@/components/local-time";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard";
import {
  inviteByEmailAction,
  resetShareLinkAction,
  revokeInviteAction,
  revokeShareLinkAction,
  type InviteByEmailActionResult,
  type InviteOutcome,
} from "@/app/(app)/organisations/actions";
import type { TeamInvite } from "./team-table";

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue-strong";
const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zk-muted";
/** Matches INVITE_BATCH_MAX in the action, which refuses more. */
const BATCH_MAX = 20;

function outcomeNote(outcome: Extract<InviteOutcome, { ok: true }>): string {
  switch (outcome.delivery) {
    case "notified":
      return "has an account: told in Ziki";
    case "emailed":
      return "emailed";
    case "manual":
      return "email isn't set up here: send them the link";
  }
}

/**
 * Invite (#team): the button at the right of the Team page's heading, opening one dialog with both ways in. Invite one
 * or many people by email, each with their own single-use link; or copy the organisation's one invite link
 * (#invite-link), which works until it is reset (the old one stops working) or turned off. Under them, the people
 * invited who haven't joined yet.
 */
export function InviteModal({ organisationId, organisationName, inviteTtlDays, link, invites }: {
  organisationId: string;
  organisationName: string;
  inviteTtlDays: number;
  /** The organisation's invite link that works now, or null. */
  link: { id: string; url: string | null; useCount: number } | null;
  invites: TeamInvite[];
}) {
  const router = useRouter();
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  const [emails, setEmails] = useState("");
  const [result, inviteAction, inviting] = useActionState<InviteByEmailActionResult | undefined, FormData>(async (previous, formData) => {
    const next = await inviteByEmailAction(previous, formData);
    if ("outcomes" in next && next.outcomes.every((outcome) => outcome.ok)) setEmails("");
    router.refresh();
    return next;
  }, undefined);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [resetting, startReset] = useTransition();

  const copy = async (url: string) => toast((await copyText(url)) ? "Invite link copied." : "Couldn't copy. Select the link and copy it.");
  const reset = () =>
    startReset(async () => {
      setLinkError(null);
      const next = await resetShareLinkAction(organisationId);
      if (!next.ok) setLinkError(next.error);
      router.refresh();
    });

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

          {/* By email: one or many addresses. */}
          <form action={inviteAction} className="space-y-2">
            <input type="hidden" name="organisationId" value={organisationId} />
            <label htmlFor="invite-emails" className="block text-sm font-semibold text-zk-text">Email addresses</label>
            <textarea
              id="invite-emails"
              name="emails"
              rows={3}
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              placeholder="ada@example.com, bob@example.com"
              disabled={inviting}
              className="w-full rounded-xl border border-zk-border bg-zk-surface px-3 py-2 text-sm text-zk-text"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-xs text-zk-muted">One or many, separated by commas or new lines (up to {BATCH_MAX}). Each link works once and expires after {inviteTtlDays} days.</p>
              <Button type="submit" disabled={inviting || !emails.trim()}>{inviting ? "Inviting…" : "Invite"}</Button>
            </div>
            {result && "error" in result ? <p role="alert" className="m-0 text-sm text-zk-bad-fg">{result.error}</p> : null}
            {result && "outcomes" in result ? (
              <ul role="status" className="m-0 list-none space-y-1 p-0 text-sm">
                {result.outcomes.map((outcome) => (
                  <li key={outcome.email} className="flex flex-wrap items-center gap-x-2">
                    <span className={outcome.ok ? "text-zk-ok-fg" : "text-zk-bad-fg"} aria-hidden="true">{outcome.ok ? "✓" : "✕"}</span>
                    <span className="font-medium text-zk-text">{outcome.email}</span>
                    <span className="text-zk-muted">{outcome.ok ? outcomeNote(outcome) : outcome.error}</span>
                    {outcome.ok && outcome.delivery === "manual" ? (
                      <button type="button" onClick={() => void copy(outcome.link)} className={`text-xs font-semibold text-zk-accent hover:underline ${focus}`}>Copy their link</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </form>

          {/* The organisation's one invite link. */}
          <section aria-labelledby="invite-link" className="space-y-2 border-t border-zk-divider pt-5">
            <h3 id="invite-link" className="m-0 text-sm font-semibold text-zk-text">Invite link</h3>
            <p className="m-0 text-xs text-zk-muted">Anyone who opens it and signs in joins as a member. It works until you get a new one or turn it off.</p>
            {link?.url ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input readOnly value={link.url} aria-label="Invite link" onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-zk-border bg-zk-bg px-3 py-2 font-mono text-xs text-zk-text" />
                  <Button type="button" onClick={() => void copy(link.url!)} className="shrink-0 whitespace-nowrap">Copy link</Button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zk-muted">
                  <span>{link.useCount} joined with it</span>
                  <button type="button" onClick={reset} disabled={resetting} className={`font-semibold text-zk-accent hover:underline disabled:opacity-60 ${focus}`}>
                    {resetting ? "Making a new link…" : "Get a new link"}
                  </button>
                  <form action={async (formData) => { await revokeShareLinkAction(formData); router.refresh(); }} className="inline">
                    <input type="hidden" name="linkId" value={link.id} />
                    <ConfirmSubmitButton
                      variant="danger-secondary"
                      confirm={{ title: "Turn off the invite link?", body: "Nobody else can join with it. People who already joined stay members.", confirmLabel: "Turn off" }}
                    >
                      Turn off
                    </ConfirmSubmitButton>
                  </form>
                </div>
                <p className="m-0 text-xs text-zk-muted">Getting a new link turns this one off.</p>
              </>
            ) : (
              <Button type="button" variant="secondary" onClick={reset} disabled={resetting}>{resetting ? "Making a link…" : "Create invite link"}</Button>
            )}
            {linkError ? <p role="alert" className="m-0 text-sm text-zk-bad-fg">{linkError}</p> : null}
          </section>

          {/* Who has been invited and hasn't joined yet. */}
          <section aria-labelledby="invited-people" className="space-y-2 border-t border-zk-divider pt-5">
            <h3 id="invited-people" className="m-0 text-sm font-semibold text-zk-text">Invited</h3>
            {invites.length === 0 ? (
              <p className="m-0 text-sm text-zk-muted">Nobody is waiting to join.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zk-border">
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  <thead className="border-b border-zk-border bg-zk-tint">
                    <tr>
                      <th scope="col" className={th}>Email</th>
                      <th scope="col" className={th}>Invited by</th>
                      <th scope="col" className={th}>Expires</th>
                      <th scope="col" className={th}><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zk-border">
                    {invites.map((invite) => (
                      <tr key={invite.id}>
                        <td className="px-3 py-2 font-medium text-zk-text">{invite.email}</td>
                        <td className="px-3 py-2 text-zk-text2">{invite.invitedByName}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-zk-muted"><LocalTime date={invite.expiresAt} /></td>
                        <td className="px-3 py-2 text-right">
                          <form action={async (formData) => { await revokeInviteAction(formData); router.refresh(); }} className="inline">
                            <input type="hidden" name="inviteId" value={invite.id} />
                            <ConfirmSubmitButton
                              aria-label={`Revoke the invite for ${invite.email}`}
                              confirm={{ title: `Revoke the invite for ${invite.email}?`, body: "Their link stops working at once. You can invite them again later.", confirmLabel: "Revoke invite" }}
                            >
                              Revoke
                            </ConfirmSubmitButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </dialog>
    </>
  );
}
