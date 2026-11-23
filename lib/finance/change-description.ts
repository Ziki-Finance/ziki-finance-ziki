import type { Prisma } from "@prisma/client";

/** Plain descriptions from stored records; no generated investment reasoning. */
export function describeFinanceChange(kind: string, detail: Prisma.JsonValue): string {
  const d = detail && typeof detail === "object" && !Array.isArray(detail) ? detail : {};
  if (kind === "trade") return `${d.side === "sold" ? "Sold" : "Bought"} ${d.shares} shares${d.price == null ? " (historical price unknown)" : ` at $${d.price}`} on ${d.date}.`;
  if (kind === "reason_point") return `${d.reason}: ${d.status}.`;
  if (kind === "reason_status") return `Reason changed from ${String(d.before).replaceAll("_", " ")} to ${d.after}. ${d.summary ?? ""}`;
  if (kind === "decision") return `Decision recorded: ${String(d.call).replaceAll("_", "-")}.`;
  if (kind === "owner_action") return `Owner chose ${String(d.action).replaceAll("_", " ")}.${d.reason ? ` ${d.reason}` : ""}`;
  if (kind === "check_requested") return "Fresh reason check requested.";
  return "Portfolio change recorded.";
}
