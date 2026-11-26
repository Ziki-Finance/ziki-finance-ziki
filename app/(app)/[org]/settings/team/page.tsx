import type { Metadata } from "next";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { ProjectPendingJoinRequestsBanner, type PendingJoinRequestItem } from "@/components/project-pending-join-requests";
import { settableLevels } from "@/lib/agents/levels";
import { activeIn, activeLevels, levelIn } from "@/lib/agents/active-in";
import { INVITE_TTL_DAYS, pendingInvites } from "@/lib/invites";
import { joinAnswersSummary } from "@/lib/join-questions";
import { MEMBERSHIP_ROLE_LABELS, organisationMembersFrom } from "@/lib/organisations";
import { prisma } from "@/lib/prisma";
import { joinedSummary, listShareLinks, shareLinkStatusLabel } from "@/lib/share-invites";
import { revokeShareLinkAction } from "@/app/(app)/organisations/actions";
import { loadOrg } from "../org-context";
import { OrgPageHeader, ReadOnlyNote } from "../org-ui";
import { InviteModal } from "./invite-modal";
import { TeamTable, type TeamCollaborator, type TeamMember } from "./team-table";

export const metadata: Metadata = { title: "Team" };

const MEMBER_LIMIT = 1000;

async function quietly<T>(label: string, task: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await task();
  } catch (error) {
    console.error(`[org] ${label} failed`, error);
    return empty;
  }
}

/**
 * Memberships and users are loaded apart so a membership whose user row is gone is skipped rather than failing the
 * page (see organisationMembersFrom). Owners and admins also get what each person said when they joined.
 */
function loadMembers(organisationId: string, withJoinAnswers: boolean): Promise<TeamMember[]> {
  return quietly("members", async () => {
    const rows = await prisma.membership.findMany({
      where: { organisationId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      take: MEMBER_LIMIT,
      select: { role: true, createdAt: true, userId: true, strengths: true, canFundIssues: true },
    });
    if (rows.length === 0) return [];
    const userIds = rows.map((row) => row.userId);
    const [people, agents] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, image: true, role: true } }),
      prisma.agent.findMany({
        where: { ...activeIn(organisationId), ownerUserId: { in: userIds }, revokedAt: null },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true, ownerUserId: true, activations: activeLevels },
      }),
    ]);
    const joinedAs = new Map(rows.map((row) => [row.userId, withJoinAnswers ? joinAnswersSummary(row) : null]));
    // #payers: owners always pay; an admin only once an owner lets them.
    const pays = new Set(rows.filter((row) => row.role === "owner" || (row.role === "admin" && row.canFundIssues)).map((row) => row.userId));
    const agentsByOwner = new Map<string, TeamMember["agents"]>();
    for (const agent of agents) {
      const list = agentsByOwner.get(agent.ownerUserId) ?? [];
      list.push({ id: agent.id, name: agent.name, level: levelIn(agent, organisationId) });
      agentsByOwner.set(agent.ownerUserId, list);
    }
    return organisationMembersFrom(rows, people).map((member) => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
      role: member.role,
      roleLabel: MEMBERSHIP_ROLE_LABELS[member.role],
      siteSuperAdmin: member.user.role === "super_admin",
      joinedAt: member.createdAt.toISOString(),
      agents: agentsByOwner.get(member.user.id) ?? [],
      joinedAs: joinedAs.get(member.user.id) ?? null,
      fundsIssues: pays.has(member.user.id),
    }));
  }, []);
}

function loadCollaborators(organisationId: string): Promise<TeamCollaborator[]> {
  return quietly("collaborators", async () => {
    const rows = await prisma.projectMembership.findMany({
      where: { project: { organisationId } },
      include: {
        project: { select: { name: true, slug: true, organisation: { select: { slug: true } } } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      projectId: r.projectId,
      projectName: r.project.name,
      projectSlug: r.project.slug,
      orgSlug: r.project.organisation.slug,
      userId: r.userId,
      userName: r.user.name,
      userEmail: r.user.email,
      createdAt: r.createdAt.toISOString(),
    }));
  }, []);
}

function loadJoinRequests(organisationId: string): Promise<PendingJoinRequestItem[]> {
  return quietly("join requests", () =>
    prisma.projectJoinRequest.findMany({
      where: { project: { organisationId }, status: "pending" },
      include: {
        project: { select: { id: true, name: true, slug: true, organisation: { select: { slug: true } } } },
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    }), []);
}

/**
 * The organisation's team (#team), one page: everyone in it, the invites still waiting and the people who work on one
 * project, in one table, with Invite at the right for owners and admins. It replaces the separate Members and Invites
 * pages.
 */
export default async function OrgTeamPage() {
  const { user, org } = await loadOrg();
  if (!org) return null;

  const [members, collaborators, joinRequests, invites, shareLinks] = await Promise.all([
    loadMembers(org.id, org.admin),
    loadCollaborators(org.id),
    org.admin ? loadJoinRequests(org.id) : Promise.resolve([]),
    org.admin ? quietly("invites", () => pendingInvites(prisma, org.id), []) : Promise.resolve([]),
    org.admin ? quietly("share links", () => listShareLinks(prisma, org.id), []) : Promise.resolve([]),
  ]);
  const ownerCount = members.filter((member) => member.role === "owner").length;

  const links = shareLinks.length === 0 ? null : (
    <ul className="mt-4 divide-y divide-zk-border border-t border-zk-border">
      {shareLinks.map((link) => {
        const who = joinedSummary(link.joinedNames, link.useCount);
        const name = link.label || "Invite link";
        const statusClass =
          link.state === "open" ? "bg-zk-tint text-zk-accent ring-1 ring-zk-border" : link.state === "revoked" ? "bg-zk-bad-bg text-zk-bad-fg" : "bg-zk-chip text-zk-text2";
        return (
          <li key={link.id} className="flex flex-wrap items-start gap-3 py-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zk-text">
                <span className="truncate">{name}</span>
                <Badge className={statusClass}>{shareLinkStatusLabel(link.state)}</Badge>
              </p>
              <p className="text-xs text-zk-muted">
                {link.useCount} joined{link.maxUses != null ? ` of ${link.maxUses}` : ""}
                {who ? ` · ${who}` : ""}
                {" · "}
                {link.state === "expired" ? "expired" : "expires"} <LocalTime date={link.expiresAt} />
              </p>
              {link.url ? <p className="truncate font-mono text-xs text-zk-text2">{link.url}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {link.url ? <CopyLinkButton url={link.url} label="invite" /> : null}
              {link.state === "open" ? (
                <form action={revokeShareLinkAction}>
                  <input type="hidden" name="linkId" value={link.id} />
                  <ConfirmSubmitButton
                    aria-label={`Revoke invite link${link.label ? ` ${link.label}` : ""}`}
                    confirm={{ title: `Revoke ${name}?`, body: "Nobody else can join with it. People who already joined stay members.", confirmLabel: "Revoke link" }}
                  >
                    Revoke
                  </ConfirmSubmitButton>
                </form>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-4">
      <OrgPageHeader
        title="Team"
        actions={org.admin ? <InviteModal organisationId={org.id} organisationName={org.name} inviteTtlDays={INVITE_TTL_DAYS} links={links} /> : null}
      >
        Everyone in {org.name}, the invites still waiting, and the people who work on one project. Owners change roles;
        owners and admins invite and remove people and set each agent&apos;s class.
      </OrgPageHeader>
      {org.admin && joinRequests.length > 0 ? (
        <ProjectPendingJoinRequestsBanner requests={joinRequests} orgRef={org.slug} projectName={org.name} />
      ) : null}
      {org.admin ? null : <ReadOnlyNote>You can see who is here and leave the organisation. Only owners and admins can invite or remove people.</ReadOnlyNote>}
      <TeamTable
        organisationId={org.id}
        organisationName={org.name}
        viewerId={user.id}
        members={members}
        invites={invites.map((invite) => ({ id: invite.id, email: invite.email, invitedByName: invite.invitedByName, expiresAt: new Date(invite.expiresAt).toISOString() }))}
        collaborators={collaborators}
        ownerCount={ownerCount}
        canChangeRoles={org.owner}
        canManage={org.admin}
        agentLevels={org.admin ? settableLevels({ isOwner: false, isAdminOfOrganisation: true }) : []}
      />
    </div>
  );
}
