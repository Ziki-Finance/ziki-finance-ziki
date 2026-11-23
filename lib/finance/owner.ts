import { notFound } from "next/navigation";
import { requireUser, type SessionAppUser } from "@/lib/auth-helpers";

export function isFinanceOwner(user: Pick<SessionAppUser, "role" | "isRealSuperAdmin">) {
  return user.isRealSuperAdmin === true || user.role === "super_admin";
}
export async function requireFinanceOwner() {
  const user = await requireUser();
  if (!isFinanceOwner(user)) notFound();
  return user;
}
