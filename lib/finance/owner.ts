import type { AgentContext } from "@/lib/agents/require-agent";
import type { SessionAppUser } from "@/lib/auth-helpers";
import { IssueApiError } from "@/lib/agent-api/errors";

/**
 * Finance is the product owner's private tool (FIN-D-040). It is gated to the
 * real super admin account, not to an organisation role: Finance belongs to no
 * organisation.
 */

export function isFinanceOwner(
  user: Pick<SessionAppUser, "isRealSuperAdmin" | "role">,
): boolean {
  return user.isRealSuperAdmin === true || user.role === "super_admin";
}

/** An agent may do Finance work only when its owner is the Finance owner. */
export function requireFinanceAgent(agent: AgentContext): void {
  if (agent.ownerRole !== "super_admin") {
    throw new IssueApiError(
      403,
      "Finance is available to the owner's own agents only.",
    );
  }
}
