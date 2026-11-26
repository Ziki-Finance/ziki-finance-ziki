import { DANGER_ACTION, FIELD_CONTROL, PRIMARY_ACTION, SECONDARY_ACTION } from "@/lib/ui-style";
import type { AgentLevel } from "@prisma/client";
import type { ReactNode } from "react";

/** Agent pages reuse the canonical controls from lib/ui-style.ts. */
export const agentsSurface =
  "rounded-panel border border-zk-border bg-zk-surface";

export const agentsLink =
  "font-semibold text-zk-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2";

export const agentsPrimaryBtn = PRIMARY_ACTION;

export const agentsSecondaryBtn = SECONDARY_ACTION;

export const agentsDangerBtn = DANGER_ACTION;

export const agentsInputClass = `${FIELD_CONTROL} h-9`;

export const agentsLabelClass = "block text-sm font-semibold text-zk-text";

export const agentsMutedClass = "text-sm text-zk-muted";

export const agentsChipClass =
  "inline-flex items-center rounded-chip bg-zk-chip px-2.5 py-0.5 text-xs font-bold text-zk-text2";

const LEVEL_BADGE: Record<AgentLevel, string> = {
  working: "bg-zk-chip text-zk-text2",
  manager: "bg-zk-chip text-zk-text2",
  merger: "bg-zk-chip text-zk-text2",
};

export function levelBadgeClass(level: AgentLevel): string {
  return `inline-flex items-center rounded-chip px-2.5 py-0.5 text-xs font-bold ${LEVEL_BADGE[level]}`;
}

/** Formats a pairing code as ABCD-2345 while typing. */
export function formatPairingCode(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

export function isValidPairingCode(value: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value);
}

export function AgentsSurface({
  children,
  className = "",
  as: Tag = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "li";
} & Record<string, unknown>) {
  return (
    <Tag className={`${agentsSurface} p-4 sm:p-6 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
