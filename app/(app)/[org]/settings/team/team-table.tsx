"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { AgentLevel } from "@prisma/client";
import { Avatar } from "@/components/avatar";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { LocalTime } from "@/components/local-time";
import { MemberRoleActions } from "@/components/member-role-actions";
import { TeamAgentLevelControl } from "@/components/team-agent-level";
import { Badge } from "@/components/ui/badge";
import { AGENT_LEVEL_LABELS } from "@/lib/agents/levels";
import type { OrganisationRole } from "@/lib/organisation-role";
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

const roleBadgeClass: Record<OrganisationRole, string> = {
  owner: "bg-zk-warn-bg text-zk-warn-fg",
  admin: "bg-zk-tint text-zk-accent",
  member: "bg-zk-chip text-zk-text2",
};

const th = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-zk-muted";
const td = "px-4 py-3 align-top";

function has(query: string, ...values: (string | null | undefined)[]): boolean {
  const q = query.trim().toLocaleLowerCase();
  return !q || values.some((value) => (value ?? "").toLocaleLowerCase().includes(q));
}

/**
 * The organisation's team as one table (#team): its members with their role, agents and controls, then the email
 * invites still waiting, then the people who work on one project only. Owners and admins get the controls; everyone
 * gets Leave on their own row.
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
  agentLevels,
}: {
  organisationId: string;
  organisationName: string;
  viewerId: string;
  members: TeamMember[];
  invites: TeamInvite[];
  collaborators: TeamCollaborator[];
  ownerCount: number;
  canChangeRoles: boolean;
  /** Owners and admins: remove people, revoke invites, set agent classes. */
  canManage: boolean;
  /** The agent classes the viewer may set; empty means they only see them. */
  agentLevels: AgentLevel[];
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const shownMembers = members.filter((m) => has(query, m.name, m.email, ...m.agents.map((a) => a.name)));
  const shownInvites = invites.filter((i) => has(query, i.email));
  const shownCollaborators = collaborators.filter((c) => has(query, c.userName, c.userEmail, c.projectName));
  const total = members.length + invites.length + collaborators.length;
  const shown = shownMembers.length + shownInvites.length + shownCollaborators.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={searchId} className="sr-only">Search the team</label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, email, agent or project"
          className="w-full rounded-xl border border-zk-border bg-zk-surface px-3 py-2 text-sm text-zk-text sm:w-72"
        />
        <p className="text-xs text-zk-muted" aria-live="polite">{query.trim() ? `${shown} of ${total}` : `${total} ${total === 1 ? "person" : "people"}`}</p>
      </div>

      <div className="overflow-x-auto rounded-panel border border-zk-border bg-zk-surface">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="border-b border-zk-border bg-zk-tint">
            <tr>
              <th scope="col" className={th}>Person</th>
              <th scope="col" className={th}>Role</th>
              <th scope="col" className={th}>Agents</th>
              <th scope="col" className={th}>Since</th>
              <th scope="col" className={`${th} text-right`}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zk-border">
            {shown === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-zk-muted">
                  {total === 0 ? `No one has joined ${organisationName} yet.` : `No one matches “${query.trim()}”.`}
                </td>
              </tr>
            ) : null}

            {shownMembers.map((member) => {
              const name = member.name ?? member.email ?? "Member";
              const isSelf = member.id === viewerId;
              return (
                <tr key={`m-${member.id}`}>
                  <td className={td}>
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={member.name} image={member.image} size="md" />
                      <div className="min-w-0 space-y-0.5">
                        <p className="flex flex-wrap items-center gap-1.5 font-medium text-zk-text">
                          <span className="truncate">{name}</span>
                          {isSelf ? <span className="text-xs font-normal text-zk-muted">(you)</span> : null}
                        </p>
                        {member.email ? <p className="truncate text-xs text-zk-muted">{member.email}</p> : null}
                        {member.joinedAs ? <p className="text-xs text-zk-text2">{member.joinedAs}</p> : null}
                      </div>
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      <Badge className={`rounded-full ${roleBadgeClass[member.role]}`}>{member.roleLabel}</Badge>
                      {member.fundsIssues ? <Badge className="rounded-full bg-zk-ok-bg text-zk-ok-fg">Funds issues</Badge> : null}
                    </div>
                  </td>
                  <td className={td}>
                    {member.agents.length === 0 ? (
                      <span className="text-xs text-zk-muted">—</span>
                    ) : (
                      <ul className="space-y-1.5" aria-label={`${name}'s agents`}>
                        {member.agents.map((agent) => (
                          <li key={agent.id} className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-zk-text2">{agent.name}</span>
                            {agentLevels.length > 0 ? (
                              <TeamAgentLevelControl agentId={agent.id} agentName={agent.name} level={agent.level} levels={agentLevels} />
                            ) : (
                              <span className="rounded-full bg-zk-info-bg px-2 py-0.5 text-[11px] font-bold text-zk-info-fg">{AGENT_LEVEL_LABELS[agent.level]}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap text-xs text-zk-muted`}>
                    <LocalTime date={member.joinedAt} />
                  </td>
                  <td className={`${td} text-right`}>
                    <MemberRoleActions
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
                  </td>
                </tr>
              );
            })}

            {shownInvites.map((invite) => (
              <tr key={`i-${invite.id}`}>
                <td className={td}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={invite.email} image={null} size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zk-text">{invite.email}</p>
                      <p className="text-xs text-zk-muted">Invited by {invite.invitedByName}</p>
                    </div>
                  </div>
                </td>
                <td className={td}>
                  <Badge className="rounded-full border border-zk-border bg-zk-surface text-zk-text2">Invited</Badge>
                </td>
                <td className={`${td} text-xs text-zk-muted`}>—</td>
                <td className={`${td} whitespace-nowrap text-xs text-zk-muted`}>
                  Expires <LocalTime date={invite.expiresAt} />
                </td>
                <td className={`${td} text-right`}>
                  {canManage ? (
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
                  ) : null}
                </td>
              </tr>
            ))}

            {shownCollaborators.map((c) => {
              const name = c.userName || c.userEmail || "Collaborator";
              return (
                <tr key={`c-${c.projectId}-${c.userId}`}>
                  <td className={td}>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={name} image={null} size="md" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zk-text">{name}</p>
                        {c.userName && c.userEmail ? <p className="truncate text-xs text-zk-muted">{c.userEmail}</p> : null}
                      </div>
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge className="rounded-full bg-zk-chip text-zk-text2">Collaborator</Badge>
                      <Link href={issuesPath(projectRef(c.orgSlug, c.projectSlug), "your_work")} className="text-xs font-medium text-zk-accent hover:underline">
                        {c.projectName}
                      </Link>
                    </div>
                  </td>
                  <td className={`${td} text-xs text-zk-muted`}>—</td>
                  <td className={`${td} whitespace-nowrap text-xs text-zk-muted`}>
                    <LocalTime date={c.createdAt} />
                  </td>
                  <td className={`${td} text-right`}>
                    {canManage ? (
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
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
