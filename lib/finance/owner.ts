import { notFound } from "next/navigation";
import { IssueApiError } from "@/lib/agent-api/errors";
import type { AgentContext } from "@/lib/agents/require-agent";
import { requireUser, type SessionAppUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * Finance is gated to the real super admin account or members explicitly
 * granted Finance clearance on `/finance/admin` (`User.financeClearedAt`).
 */
export function isFinanceOwner(
  user: Pick<SessionAppUser, "role" | "isRealSuperAdmin">,
): boolean {
  return user.isRealSuperAdmin === true || user.role === "super_admin";
}

export async function hasFinanceAccess(
  user: Pick<SessionAppUser, "id" | "role" | "isRealSuperAdmin">,
): Promise<boolean> {
  if (isFinanceOwner(user)) return true;
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { financeClearedAt: true },
  });
  return Boolean(row?.financeClearedAt);
}

export async function requireFinanceOwner() {
  const user = await requireUser();
  if (!(await hasFinanceAccess(user))) notFound();
  return user;
}

/** An agent may do Finance work when its owner is super_admin or finance-cleared. */
export async function requireFinanceAgent(agent: AgentContext): Promise<void> {
  if (agent.ownerRole === "super_admin") return;
  const row = await prisma.user.findUnique({
    where: { id: agent.ownerId },
    select: { financeClearedAt: true },
  });
  if (!row?.financeClearedAt) {
    throw new IssueApiError(
      403,
      "Finance is available to cleared members' agents only.",
    );
  }
}
