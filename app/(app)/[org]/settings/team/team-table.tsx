"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import type { AgentLevel } from "@prisma/client";
import { Avatar } from "@/components/avatar";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { LocalTime } from "@/components/local-time";
import { MemberRoleActions } from "@/components/member-role-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { OrganisationRole } from "@/lib/organisation-role";
import { PILL_TONES, type PillTone } from "@/lib/pill-tones";
import { issuesPath, projectRef } from "@/lib/project-paths";
import { revokeInviteAction } from "@/app/(app)/organisations/actions";
import { removeProjectMemberAction } from "@/app/actions/project-join-requests";

export type TeamMember = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: OrganisationRole;
  /** The role's display label, from MEMBERSHIP_ROLE_LABELS. */
  roleLabel: string;
  siteSuperAdmin: boolean;
  joinedAt: string;
  agents: { id: string; name: string; level: AgentLevel }[];
  /** What they said when they joined (#join-questions): owners and admins only, null when unanswered or hidden. */
  joinedAs: string | null;
  /** Whether they pay for the organisation's issues (#payers): every owner, and admins an owner lets. */
  fundsIssues: boolean;
};

/** An email invite nobody has accepted yet. */
export type TeamInvite = { id: string; email: string; invitedByName: string; expiresAt: string };

/** Someone with access to one project only, without organisation membership. */
export type TeamCollaborator = {
  projectId: string;
  projectName: string;
  projectSlug: string;
  orgSlug: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
};

type Group = "all" | "members" | "invites" | "collaborators";
const PEOPLE_PER_PAGE = 15;

function pageRows<T>(rows: T[], start: number, offset = 0): T[] {
  return rows.slice(Math.max(0, start - offset), Math.max(0, start + PEOPLE_PER_PAGE - offset));
}

/** Each kind of person's label colour, from the pills the Work Feed uses for an item's state. */
const roleTone: Record<OrganisationRole, PillTone> = { owner: "yellow", admin: "blue", member: "grey" };

function has(query: string, ...values: (string | null | undefined)[]): boolean {
  const q = query.trim().toLocaleLowerCase();
  return !q || values.some((value) => (value ?? "").toLocaleLowerCase().includes(q));
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/** A group's heading and count, then its cards on the grey well, as the Work Feed lays out New ideas. */
function TeamSection({ id, title, count, children }: { id: string; title: string; count: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 px-1 text-[15px] font-semibold text-zk-text">
        {title} <span className="ml-1 text-[13px] font-medium tabular-nums text-zk-muted">{count}</span>
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 rounded-panel bg-zk-bg p-2" aria-label={title}>
        {children}
      </ul>
    </section>
  );
}

/**
 * One person as a Work Feed card: their avatar, their name in bold, a muted line of what to know (email, agents,
 * when they joined), and on the right their role beside their available actions.
 */
function PersonCard({
  name,
  image,
  you,
  meta,
  note,
  label,
  tone,
  extraLabel,
  actions,
}: {
  name: string;
  image: string | null;
  you?: boolean;
  meta: ReactNode;
  /** The meta line's tooltip: what they said when they joined, when there is something. */
  note?: string | null;
  label: string;
  tone: PillTone;
  extraLabel?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-panel border border-zk-border bg-zk-surface px-3 py-2.5 transition hover:bg-zk-chip">
      <Avatar name={name} image={image} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="m-0 flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-zk-text">
          <span className="truncate">{name}</span>
          {you ? <span className="shrink-0 text-xs font-normal text-zk-muted">(you)</span> : null}
        </p>
        <p className="m-0 mt-0.5 truncate text-[13px] text-zk-muted" title={note ?? undefined}>{meta}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex items-center gap-1.5">
          {extraLabel}
          <span className="rounded-md px-2 py-0.5 text-[11.5px] font-semibold" style={PILL_TONES[tone]}>{label}</span>
        </span>
        {actions}
      </div>
    </li>
  );
}

/** A member's agents by name: the first two, then "+N" for the rest (their classes live on the Workers page). */
function agentNames(agents: TeamMember["agents"]): string | null {
  if (agents.length === 0) return null;
  const shown = agents.slice(0, 2).map((agent) => agent.name).join(", ");
  return agents.length > 2 ? `${shown} +${agents.length - 2}` : shown;
}

/** Parts of the meta line, joined with a dot as on the Work Feed's cards. */
function Meta({ parts }: { parts: ReactNode[] }) {
  const shown = parts.filter((part) => part !== null && part !== false && part !== "");
  return (
    <>
      {shown.map((part, index) => (
        <span key={index}>
          {index > 0 ? " · " : null}
          {part}
        </span>
      ))}
    </>
  );
}

/**
 * The organisation's team (#team), laid out like the Work Feed: a section each for the members, the email invites
 * still waiting and the people who work on one project only. Search and group filtering run before pagination,
 * and each page can show cards from more than one section. A person's actions are in a ⋯ menu on their card; everyone
 * gets Leave on their own.
 */
export function TeamTable({
  organisationId,
  organisationName,
  viewerId,
  members,
  invites,
  collaborators,
  ownerCount,
  canChangeRoles,
  canManage,
}: {
  organisationId: string;
  organisationName: string;
  viewerId: string;
  members: TeamMember[];
  invites: TeamInvite[];
  collaborators: TeamCollaborator[];
  ownerCount: number;
  canChangeRoles: boolean;
  /** Owners and admins: remove people and revoke invites. */
  canManage: boolean;
}) {
  const searchId = useId();
  const groupId = useId();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [page, setPage] = useState(1);

  const memberName = (m: TeamMember) => m.name ?? m.email ?? "Member";
  const collaboratorName = (c: TeamCollaborator) => c.userName || c.userEmail || "Collaborator";

  const shownMembers = group === "all" || group === "members"
    ? members.filter((m) => has(query, m.name, m.email, ...m.agents.map((a) => a.name))).sort((a, b) => byName(memberName(a), memberName(b)))
    : [];
  const shownInvites = group === "all" || group === "invites"
    ? invites.filter((i) => has(query, i.email)).sort((a, b) => byName(a.email, b.email))
    : [];
  const shownCollaborators = group === "all" || group === "collaborators"
    ? collaborators.filter((c) => has(query, c.userName, c.userEmail, c.projectName)).sort((a, b) => byName(collaboratorName(a), collaboratorName(b)))
    : [];
  const total = members.length + invites.length + collaborators.length;
  const shown = shownMembers.length + shownInvites.length + shownCollaborators.length;
  const pageCount = Math.max(1, Math.ceil(shown / PEOPLE_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PEOPLE_PER_PAGE;
  const pageMembers = pageRows(shownMembers, start);
  const pageInvites = pageRows(shownInvites, start, shownMembers.length);
  const pageCollaborators = pageRows(shownCollaborators, start, shownMembers.length + shownInvites.length);

  const groups: { value: Group; label: string; count: number }[] = [
    { value: "all", label: "Everyone", count: total },
    { value: "members", label: "Members", count: members.length },
    { value: "invites", label: "Invites", count: invites.length },
    { value: "collaborators", label: "Project collaborators", count: collaborators.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={searchId} className="sr-only">Search the team</label>
        <div className="relative w-full sm:w-80">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zk-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email, agent or project"
            className="h-9 w-full rounded-control border border-zk-border bg-zk-surface pl-9 pr-3 text-sm text-zk-text"
          />
        </div>
        <label htmlFor={groupId} className="sr-only">Show</label>
        <div className="w-full sm:w-56">
          <Select id={groupId} value={group} onChange={(event) => {
            setGroup(event.target.value as Group);
            setPage(1);
          }}>
            {groups.map((option) => (
              <option key={option.value} value={option.value}>{option.label} ({option.count})</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-xs tabular-nums text-zk-muted" aria-live="polite">
          {shown ? `${start + 1}–${Math.min(start + PEOPLE_PER_PAGE, shown)} of ${shown} ${shown === 1 ? "person" : "people"}` : "0 matches"}
        </p>
        {pageCount > 1 ? (
          <nav aria-label="Team pages" className="flex items-center gap-2">
            <Button type="button" variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              Previous
            </Button>
            <span className="text-xs tabular-nums text-zk-muted">Page {currentPage} of {pageCount}</span>
            <Button type="button" variant="secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
              Next
            </Button>
          </nav>
        ) : null}
      </div>

      <div className="flex flex-col gap-6 rounded-panel border border-zk-border bg-zk-surface p-3 sm:p-5">
      {shown === 0 ? (
        <p className="m-0 rounded-panel bg-zk-bg px-4 py-6 text-center text-[13px] text-zk-muted">
          {total === 0 ? `No one has joined ${organisationName} yet.` : query.trim() ? `No one matches “${query.trim()}”.` : "No one here yet."}
        </p>
      ) : null}

      {pageMembers.length > 0 ? (
        <TeamSection id="team-members" title="Members" count={shownMembers.length}>
          {pageMembers.map((member) => {
            const name = memberName(member);
            const isSelf = member.id === viewerId;
            const agents = agentNames(member.agents);
            return (
              <PersonCard
                key={`m-${member.id}`}
                name={name}
                image={member.image}
                you={isSelf}
                note={member.joinedAs}
                meta={<Meta parts={[member.email, agents ? <span title={member.agents.map((a) => a.name).join(", ")}>{agents}</span> : null, <>Joined <LocalTime date={member.joinedAt} /></>]} />}
                label={member.roleLabel}
                tone={roleTone[member.role]}
                extraLabel={member.fundsIssues ? <span className="hidden rounded-md px-2 py-0.5 text-[11.5px] font-semibold sm:inline" style={PILL_TONES.green}>Funds issues</span> : null}
                actions={
                  <MemberRoleActions
                    layout="menu"
                    organisationId={organisationId}
                    organisationName={organisationName}
                    userId={member.id}
                    userName={name}
                    membershipRole={member.role}
                    fundsIssues={member.fundsIssues}
                    siteSuperAdmin={member.siteSuperAdmin}
                    canChangeRoles={canChangeRoles}
                    canRemove={canManage}
                    isSelf={isSelf}
                    ownerCount={ownerCount}
                  />
                }
              />
            );
          })}
        </TeamSection>
      ) : null}

      {pageInvites.length > 0 ? (
        <TeamSection id="team-invites" title="Invites" count={shownInvites.length}>
          {pageInvites.map((invite) => (
            <PersonCard
              key={`i-${invite.id}`}
              name={invite.email}
              image={null}
              meta={<Meta parts={[`Invited by ${invite.invitedByName}`, <>Expires <LocalTime date={invite.expiresAt} /></>]} />}
              label="Invited"
              tone="purple"
              actions={
                canManage ? (
                  <form action={revokeInviteAction} className="inline">
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <ConfirmSubmitButton
                      aria-label={`Revoke the invite for ${invite.email}`}
                      confirm={{
                        title: `Revoke the invite for ${invite.email}?`,
                        body: "Their link stops working at once. You can send a new invite later.",
                        confirmLabel: "Revoke invite",
                      }}
                    >
                      Revoke
                    </ConfirmSubmitButton>
                  </form>
                ) : null
              }
            />
          ))}
        </TeamSection>
      ) : null}

      {pageCollaborators.length > 0 ? (
        <TeamSection id="team-collaborators" title="Project collaborators" count={shownCollaborators.length}>
          {pageCollaborators.map((c) => {
            const name = collaboratorName(c);
            return (
              <PersonCard
                key={`c-${c.projectId}-${c.userId}`}
                name={name}
                image={null}
                meta={
                  <Meta
                    parts={[
                      c.userName ? c.userEmail : null,
                      <Link key="project" href={issuesPath(projectRef(c.orgSlug, c.projectSlug), "your_work")} className="font-medium text-zk-accent hover:underline">{c.projectName}</Link>,
                      <>Joined <LocalTime date={c.createdAt} /></>,
                    ]}
                  />
                }
                label="Collaborator"
                tone="teal"
                actions={
                  canManage ? (
                    <form action={removeProjectMemberAction} className="inline">
                      <input type="hidden" name="projectId" value={c.projectId} />
                      <input type="hidden" name="userId" value={c.userId} />
                      <ConfirmSubmitButton
                        aria-label={`Remove ${name} from ${c.projectName}`}
                        variant="danger-secondary"
                        confirm={{
                          title: `Remove collaborator from ${c.projectName}?`,
                          body: `${name} will lose access to contribute to ${c.projectName}.`,
                          confirmLabel: "Remove",
                        }}
                      >
                        Remove
                      </ConfirmSubmitButton>
                    </form>
                  ) : null
                }
              />
            );
          })}
        </TeamSection>
      ) : null}
      </div>
    </div>
  );
}
