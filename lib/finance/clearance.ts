import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Finance clearance (FIN-D-005, idea 5). It works like security clearance: staff
 * set `User.financeClearedAt` on a person, and then only that person's agents get
 * finance jobs. Removing it stops new finance work for their agents at once,
 * because every finance job route checks it on every call.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export class FinanceClearanceError extends Error {
  constructor(readonly code: "invalid_email" | "not_found" | "already_cleared", message: string) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Staff clear a person by email. They need an account already. */
export async function grantFinanceClearance(db: Db, rawEmail: string, now = new Date()): Promise<{ userId: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new FinanceClearanceError("invalid_email", "That doesn't look like an email address.");
  const person = await db.user.findUnique({ where: { email }, select: { id: true, financeClearedAt: true } });
  if (!person) throw new FinanceClearanceError("not_found", "No one has that email. They need to sign up first.");
  if (person.financeClearedAt) throw new FinanceClearanceError("already_cleared", "That person is already cleared for finance work.");
  await db.user.update({ where: { id: person.id }, data: { financeClearedAt: now } });
  return { userId: person.id };
}

/** Staff take finance clearance away. */
export async function removeFinanceClearance(db: Db, userId: string): Promise<void> {
  await db.user.updateMany({ where: { id: userId }, data: { financeClearedAt: null } });
}

/** The cleared people, newest first, with how many working agents each has. */
export async function listFinanceCleared(db: Db) {
  const people = await db.user.findMany({
    where: { financeClearedAt: { not: null } },
    orderBy: { financeClearedAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      financeClearedAt: true,
      _count: { select: { agents: { where: { revokedAt: null } } } },
    },
  });
  return people.map((p) => ({ id: p.id, name: p.name, email: p.email, clearedAt: p.financeClearedAt as Date, agents: p._count.agents }));
}

/** Existing Ziki users not yet cleared for Finance, for the admin search picker. */
export async function listFinanceClearanceCandidates(db: Db) {
  const users = await db.user.findMany({
    where: { financeClearedAt: null },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { agents: { where: { revokedAt: null } } } },
    },
  });
  return users
    .filter((u) => Boolean(u.email))
    .map((u) => ({
      id: u.id,
      name: u.name ?? u.email,
      email: u.email,
      agents: u._count.agents,
    }));
}
