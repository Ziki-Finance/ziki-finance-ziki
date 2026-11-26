import type { ReactNode } from "react";

/**
 * One look for every item in a ⋯ menu (#menu-items): a full-width row, an icon then the label, no border, tinted on
 * hover. A destructive item is the same row in red.
 */
export const MENU_ITEM_CLASS =
  "inline-flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold text-zk-text transition hover:bg-zk-chip disabled:cursor-default disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue-strong";
export const MENU_ITEM_DANGER_CLASS = `${MENU_ITEM_CLASS} !text-zk-bad-fg hover:!bg-zk-bad-soft`;

/** A menu item's icon: a 24-unit outline at 16px, muted (red in a destructive item). */
export function MenuIcon({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-4 w-4 shrink-0 ${danger ? "text-zk-bad-fg" : "text-zk-muted"}`}>
      {children}
    </svg>
  );
}
