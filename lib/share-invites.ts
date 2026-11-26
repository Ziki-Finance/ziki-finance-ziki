import type { PrismaClient } from "@prisma/client";
import type { AppRole } from "@/lib/roles";
import { giveWelcomeBonus } from "@/lib/coins/welcome-bonus";
import {
  INVITE_NOT_ALLOWED,
  canInvite,
  generateInviteToken,
  invitingOrganisation,
  hashInviteToken,
  isInviteToken,
} from "@/lib/invites";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { absoluteUrl } from "@/lib/site-url";

/**
 * The organisation's invite link (#invite-link). An email invite (#444) is one address and one use. The link is
 * for everyone else: one per organisation, it never expires, and anyone who opens it and signs in joins as a member,
 * until an owner or admin resets it (the old one stops working) or turns it off.
 *
 * The raw token is sealed with NEXTAUTH_SECRET so owners can copy it again.
 * Acceptance looks up the SHA-256 hash. A mail scanner that only GETs the
 * page joins nobody; joining is a POST from the signed-in account.
 */

type Db = PrismaClient;

export const SHARE_JOIN_PATH = "/join";
/** Each organisation has one invite link (#invite-link): it works until an owner or admin turns it off or resets it. */
export type ShareLinkState = "open" | "revoked";

export type ShareLinkFailure = "invalid" | "revoked";

export const SHARE_LINK_ERRORS: Record<ShareLinkFailure | "rate", string> = {
  invalid: "This invite link isn't valid. Ask the person who sent it for a new one.",
  revoked: "This invite link was turned off. Ask the person who sent it for a new one.",
  rate: "You're doing that too fast. Please wait a moment.",
};

export function shareJoinPath(rawToken: string): string {
  return `${SHARE_JOIN_PATH}/${rawToken}`;
}

export function shareJoinUrl(rawToken: string): string {
  return absoluteUrl(shareJoinPath(rawToken));
}

export function shareLinkState(link: { revokedAt: Date | null }): ShareLinkState {
  return link.revokedAt ? "revoked" : "open";
}

/** Names of people who joined, plus a count of anyone not listed. */
export function joinedSummary(names: string[], total: number): string {
  const shown = names.filter(Boolean).slice(0, 3);
  if (shown.length === 0 || total <= 0) return "";
  const extra = total - shown.length;
  return extra > 0 ? `${shown.join(", ")} and ${extra} more` : shown.join(", ");
}

function isUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002";
}

function readStoredToken(encrypted: string): string | null {
  try {
    const raw = openSecret(encrypted);
    return isInviteToken(raw) ? raw : null;
  } catch {
    return null;
  }
}

function failureOf(link: { revokedAt: Date | null }): ShareLinkFailure {
  return link.revokedAt ? "revoked" : "invalid";
}

// ---------------------------------------------------------------------------
// Creating and listing
// ---------------------------------------------------------------------------

export type ResetShareLinkResult = { ok: true; url: string; organisationSlug: string } | { ok: false; error: string };

/**
 * A new invite link for the organisation (#invite-link). The one it had stops working at once, so there is only ever
 * one: anyone who opens it and signs in joins as a member, until it is reset or turned off.
 */
export async function resetShareLink(
  db: Db,
  inviter: { id: string; role?: AppRole | null },
  input: { organisationId: string },
  now = new Date(),
): Promise<ResetShareLinkResult> {
  const organisation = await invitingOrganisation(db, inviter, input.organisationId);
  if (!organisation) return { ok: false, error: INVITE_NOT_ALLOWED };

  const token = generateInviteToken();
  let tokenEncrypted: string;
  try {
    tokenEncrypted = sealSecret(token.raw);
  } catch {
    return { ok: false, error: "Invite links aren't available on this site yet." };
  }

  await db.$transaction([
    db.organisationShareLink.updateMany({ where: { organisationId: organisation.id, revokedAt: null }, data: { revokedAt: now } }),
    db.organisationShareLink.create({ data: { organisationId: organisation.id, tokenHash: token.hash, tokenEncrypted, invitedById: inviter.id } }),
  ]);
  return { ok: true, url: shareJoinUrl(token.raw), organisationSlug: organisation.slug };
}

export type CurrentShareLink = { id: string; url: string | null; useCount: number; createdAt: Date; joinedNames: string[] };

/** The organisation's invite link that works now, or null when it has none. */
export async function currentShareLink(db: Db, organisationId: string): Promise<CurrentShareLink | null> {
  const row = await db.organisationShareLink.findFirst({
    where: { organisationId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, tokenEncrypted: true, useCount: true, createdAt: true, redemptions: { orderBy: { createdAt: "desc" }, take: 8, select: { userId: true } } },
  });
  if (!row) return null;
  // Names are loaded apart: joining `user` makes Prisma throw when that account is gone.
  const people = row.redemptions.length
    ? await db.user.findMany({ where: { id: { in: row.redemptions.map((r) => r.userId) } }, select: { id: true, name: true } })
    : [];
  const names = new Map(people.map((person) => [person.id, person.name]));
  const raw = readStoredToken(row.tokenEncrypted);
  return {
    id: row.id,
    url: raw ? shareJoinUrl(raw) : null,
    useCount: row.useCount,
    createdAt: row.createdAt,
    joinedNames: row.redemptions.flatMap((r) => (names.get(r.userId) ? [names.get(r.userId)!] : [])),
  };
}

export type RevokeShareLinkResult = { ok: true; organisationSlug: string } | { ok: false; error: string };

/** An owner or admin turns the link off. People who already joined stay members. */
export async function revokeShareLink(db: Db, actor: { id: string; role?: AppRole | null }, linkId: string, now = new Date()): Promise<RevokeShareLinkResult> {
  const link = linkId
    ? await db.organisationShareLink.findUnique({
        where: { id: linkId },
        select: { id: true, organisationId: true, revokedAt: true, organisation: { select: { slug: true } } },
      })
    : null;
  const membership = link
    ? await db.membership.findUnique({
        where: { organisationId_userId: { organisationId: link.organisationId, userId: actor.id } },
        select: { role: true },
      })
    : null;
  if (!link || !canInvite(membership?.role, actor.role)) return { ok: false, error: INVITE_NOT_ALLOWED };
  if (link.revokedAt) return { ok: true, organisationSlug: link.organisation.slug };

  await db.organisationShareLink.updateMany({
    where: { id: link.id, revokedAt: null },
    data: { revokedAt: now },
  });
  return { ok: true, organisationSlug: link.organisation.slug };
}

// ---------------------------------------------------------------------------
// What a guest sees, and joining
// ---------------------------------------------------------------------------

const linkSelect = {
  id: true,
  organisationId: true,
  revokedAt: true,
  invitedBy: { select: { name: true } },
  organisation: { select: { id: true, slug: true, name: true } },
} as const;

async function findByToken(db: Db, token: string) {
  if (!isInviteToken(token)) return null;
  return db.organisationShareLink.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: linkSelect,
  });
}

export type ShareLinkPreview = {
  state: ShareLinkState;
  organisation: { id: string; slug: string; name: string };
  invitedByName: string;
  alreadyMember: boolean;
};

/**
 * Public details of a link. An unknown token is null, so a guess learns
 * nothing.
 */
export async function previewShareLink(
  db: Db,
  token: string,
  viewer?: { id: string },
): Promise<ShareLinkPreview | null> {
  const link = await findByToken(db, token);
  if (!link) return null;
  const membership = viewer
    ? await db.membership.findUnique({
        where: { organisationId_userId: { organisationId: link.organisationId, userId: viewer.id } },
        select: { id: true },
      })
    : null;
  return {
    state: shareLinkState(link),
    organisation: link.organisation,
    invitedByName: link.invitedBy.name,
    alreadyMember: Boolean(membership),
  };
}

export type AcceptShareLinkResult =
  | { ok: true; organisation: { id: string; slug: string; name: string }; alreadyMember: boolean }
  | { ok: false; reason: ShareLinkFailure };

/**
 * Adds the signed-in account to the organisation.
 *
 * The use is counted with a conditional update on a link that still works, so
 * a link turned off meanwhile lets nobody in. The same account is never
 * counted twice: a second click finds their redemption. Someone who is already
 * a member keeps their role.
 */
export async function acceptShareLink(
  db: Db,
  token: string,
  account: { id: string },
): Promise<AcceptShareLinkResult> {
  const link = await findByToken(db, token);
  if (!link) return { ok: false, reason: "invalid" };

  return db.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({
      where: { organisationId_userId: { organisationId: link.organisationId, userId: account.id } },
      select: { id: true },
    });
    if (existing) return { ok: true as const, organisation: link.organisation, alreadyMember: true };

    const redeemed = await tx.organisationShareRedemption.findUnique({
      where: { linkId_userId: { linkId: link.id, userId: account.id } },
      select: { id: true },
    });
    if (redeemed) {
      await tx.membership.upsert({
        where: { organisationId_userId: { organisationId: link.organisationId, userId: account.id } },
        create: { organisationId: link.organisationId, userId: account.id, role: "member" },
        update: {},
      });
      await giveWelcomeBonus(tx, account.id);
      return { ok: true as const, organisation: link.organisation, alreadyMember: false };
    }

    if (shareLinkState(link) !== "open") return { ok: false as const, reason: failureOf(link) };

    const claimed = await tx.organisationShareLink.updateMany({
      where: { id: link.id, revokedAt: null },
      data: { useCount: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      const again = await tx.organisationShareRedemption.findUnique({
        where: { linkId_userId: { linkId: link.id, userId: account.id } },
        select: { id: true },
      });
      if (again) {
        await tx.membership.upsert({
          where: { organisationId_userId: { organisationId: link.organisationId, userId: account.id } },
          create: { organisationId: link.organisationId, userId: account.id, role: "member" },
          update: {},
        });
        await giveWelcomeBonus(tx, account.id);
        return { ok: true as const, organisation: link.organisation, alreadyMember: false };
      }
      const latest = await tx.organisationShareLink.findUnique({
        where: { id: link.id },
        select: { revokedAt: true },
      });
      return { ok: false as const, reason: latest ? failureOf(latest) : "invalid" };
    }

    try {
      await tx.organisationShareRedemption.create({ data: { linkId: link.id, userId: account.id } });
    } catch (error) {
      if (!isUniqueError(error)) throw error;
      await tx.organisationShareLink.updateMany({
        where: { id: link.id, useCount: { gt: 0 } },
        data: { useCount: { decrement: 1 } },
      });
      await tx.membership.upsert({
        where: { organisationId_userId: { organisationId: link.organisationId, userId: account.id } },
        create: { organisationId: link.organisationId, userId: account.id, role: "member" },
        update: {},
      });
      await giveWelcomeBonus(tx, account.id);
      return { ok: true as const, organisation: link.organisation, alreadyMember: false };
    }

    await tx.membership.upsert({
      where: { organisationId_userId: { organisationId: link.organisationId, userId: account.id } },
      create: { organisationId: link.organisationId, userId: account.id, role: "member" },
      update: {},
    });
    await giveWelcomeBonus(tx, account.id);
    return { ok: true as const, organisation: link.organisation, alreadyMember: false };
  });
}
