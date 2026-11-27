"use client";

import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  leaveOrganisationAction,
  removeMemberAction,
  setMemberRoleAction,
} from "@/app/actions/membership";
import { useConfirm, type ConfirmOptions } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { OrganisationRole } from "@/lib/organisation-role";

const secondaryBtn =
  "inline-flex min-h-10 items-center justify-center rounded-control border border-zk-border bg-zk-surface px-3.5 py-2 text-sm font-semibold text-zk-text transition hover:bg-zk-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2 disabled:opacity-50";
const dangerBtn =
  "inline-flex min-h-10 items-center justify-center rounded-control border border-zk-bad-bd bg-zk-surface px-3.5 py-2 text-sm font-semibold text-zk-bad-fg transition hover:bg-zk-bad-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zk-bad-fg focus-visible:ring-offset-2 disabled:opacity-50";

/** One thing the viewer can do to a membership: asked first, then run. */
type MemberAction = {
  key: string;
  label: string;
  /** Shown on the button while it runs (buttons layout only). */
  busyLabel?: string;
  danger?: boolean;
  ask: ConfirmOptions;
  task: () => Promise<{ error?: string; ok?: boolean }>;
  success: string;
  href?: string;
};

/**
 * Promote, demote, remove, or leave inside one organisation.
 * A site super admin's site role is not edited here.
 *
 * `layout="menu"` puts the same actions behind a ⋯ button, one row each with the destructive ones last after a line,
 * for tables that keep one line per person (the team settings table, #team).
 */
export function MemberRoleActions({
  organisationId,
  organisationName,
  userId,
  userName,
  membershipRole,
  siteSuperAdmin = false,
  canChangeRoles,
  canRemove,
  isSelf,
  ownerCount,
  layout = "buttons",
}: {
  organisationId: string;
  organisationName: string;
  userId: string;
  userName: string;
  membershipRole: OrganisationRole;
  siteSuperAdmin?: boolean;
  canChangeRoles: boolean;
  canRemove: boolean;
  isSelf: boolean;
  ownerCount: number;
  layout?: "buttons" | "menu";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();

  const lastOwner = membershipRole === "owner" && ownerCount <= 1;
  const actions: MemberAction[] = [];

  if (canChangeRoles && !siteSuperAdmin && membershipRole === "member") {
    actions.push({
      key: "promote",
      label: "Promote to admin",
      busyLabel: "Promoting…",
      ask: {
        title: `Make ${userName} an admin of ${organisationName}?`,
        body: `They will be able to triage and delete issues in ${organisationName}. This does not make them an admin of any other organisation.`,
        confirmLabel: "Promote to admin",
      },
      task: () => setMemberRoleAction(organisationId, userId, "admin"),
      success: `${userName} is now an admin of ${organisationName}.`,
    });
  }

  if (canChangeRoles && !siteSuperAdmin && membershipRole === "admin") {
    actions.push({
      key: "demote",
      label: "Remove admin",
      busyLabel: "Removing…",
      ask: {
        title: `Remove admin from ${userName}?`,
        body: `They stay in ${organisationName} as a member. They will no longer be able to triage its issues.`,
        confirmLabel: "Remove admin",
        tone: "danger",
      },
      task: () => setMemberRoleAction(organisationId, userId, "member"),
      success: `${userName} is a member of ${organisationName}.`,
    });
  }

  if (canChangeRoles && !siteSuperAdmin && membershipRole === "owner" && !lastOwner) {
    actions.push({
      key: "demote-owner",
      label: "Demote to admin",
      busyLabel: "Updating…",
      ask: {
        title: `Make ${userName} an admin instead of an owner?`,
        body: `${organisationName} still has another owner.`,
        confirmLabel: "Demote to admin",
        tone: "danger",
      },
      task: () => setMemberRoleAction(organisationId, userId, "admin"),
      success: `${userName} is an admin of ${organisationName}.`,
    });
  }

  if (canRemove && !isSelf && !lastOwner && (canChangeRoles || membershipRole === "member")) {
    actions.push({
      key: "remove",
      label: "Remove",
      danger: true,
      ask: {
        title: `Remove ${userName} from ${organisationName}?`,
        body: "They keep their account. They lose access to this organisation's issues until someone invites them again.",
        confirmLabel: "Remove",
        tone: "danger",
      },
      task: () => removeMemberAction(organisationId, userId),
      success: `${userName} was removed from ${organisationName}.`,
    });
  }

  if (isSelf && !lastOwner) {
    actions.push({
      key: "leave",
      label: "Leave",
      danger: true,
      ask: {
        title: `Leave ${organisationName}?`,
        body: "You will lose access to its issues until someone invites you back.",
        confirmLabel: "Leave",
        tone: "danger",
      },
      task: () => leaveOrganisationAction(organisationId),
      success: `You left ${organisationName}.`,
      href: "/organisations",
    });
  }

  async function perform(action: MemberAction) {
    const confirmed = await confirm(action.ask);
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await action.task();
        if (result?.error) {
          setError(result.error);
          toast(result.error, "error");
        } else {
          toast(action.success);
          if (action.href) router.push(action.href);
        }
      } catch {
        const message = "Couldn't update that membership. Try again.";
        setError(message);
        toast(message, "error");
      }
    });
  }

  if (actions.length === 0) {
    return layout === "menu" ? null : <span className="text-xs text-zk-muted">—</span>;
  }

  const errorLine = error ? (
    <p className="text-xs text-zk-bad-fg" role="alert">
      {error}
    </p>
  ) : null;

  if (layout === "menu") {
    return (
      <div className="flex flex-col items-end gap-1">
        <MemberActionsMenu userName={userName} actions={actions} pending={pending} onSelect={perform} />
        {errorLine}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {actions.map((action) => (
          <button key={action.key} type="button" className={action.danger ? dangerBtn : secondaryBtn} disabled={pending} onClick={() => perform(action)}>
            {pending && action.busyLabel ? action.busyLabel : action.label}
          </button>
        ))}
      </div>
      {errorLine}
    </div>
  );
}

/** The ⋯ menu: the safe actions first, then the destructive ones in red after a line. */
function MemberActionsMenu({
  userName,
  actions,
  pending,
  onSelect,
}: {
  userName: string;
  actions: MemberAction[];
  pending: boolean;
  onSelect: (action: MemberAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // Opening puts focus on the first action; a click outside or Escape closes it.
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function moveFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? []);
    if (!items.length) return;
    event.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
      : event.key === "ArrowDown" ? (at + 1) % items.length
      : (at - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  const safe = actions.filter((action) => !action.danger);
  const danger = actions.filter((action) => action.danger);
  const row =
    "flex w-full cursor-pointer items-center px-3.5 py-2 text-left text-[13px] font-medium hover:bg-zk-chip focus-visible:bg-zk-chip focus-visible:outline-none disabled:cursor-default disabled:opacity-60";

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={`Actions for ${userName}`}
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={pending}
        onClick={() => setOpen((now) => !now)}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-control text-zk-muted hover:bg-zk-chip hover:text-zk-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open ? (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label={`Actions for ${userName}`}
          onKeyDown={moveFocus}
          className="absolute right-0 top-full z-30 mt-1 min-w-[200px] overflow-hidden rounded-panel border border-zk-border bg-zk-surface py-1 shadow-lg"
        >
          {safe.map((action) => (
            <button key={action.key} type="button" role="menuitem" className={`${row} text-zk-text`} onClick={() => { setOpen(false); onSelect(action); }}>
              {action.label}
            </button>
          ))}
          {safe.length > 0 && danger.length > 0 ? <div role="separator" className="my-1 border-t border-zk-border" /> : null}
          {danger.map((action) => (
            <button key={action.key} type="button" role="menuitem" className={`${row} text-zk-bad-fg`} onClick={() => { setOpen(false); onSelect(action); }}>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
