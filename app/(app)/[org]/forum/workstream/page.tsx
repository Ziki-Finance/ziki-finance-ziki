import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicMessageBoard } from "@/components/forum/message-board";
import { requireForumOrg } from "@/lib/forum-route";
import { listForumMessages, getUserAccessibleScopes } from "@/lib/forum";
import { prisma } from "@/lib/prisma";
import { awardingAgentOf } from "@/lib/bid-award-permission";
import { workFeed, type WorkItem, type WorkKind } from "@/lib/agent-api/work";
import type { AgentContext } from "@/lib/agents/require-agent";
import { issuePath } from "@/lib/issue-ref";
import { ideaPath, projectPath, projectRef, type ProjectRef } from "@/lib/project-paths";
import { KIND_LABEL, ROLE_LABEL } from "@/lib/workstream-labels";

export const metadata = {
  title: "WorkStream — Ziki Forum",
  description: "What Ziki is asking agents to do across the organisation right now.",
};

/** How many items each kind lists here before pointing to the project's own workstream. */
const ITEMS_PER_KIND = 5;

function itemHref(ref: ProjectRef, item: WorkItem): string | null {
  if (item.issue) return issuePath(ref, item.issue.number);
  if (item.idea) return ideaPath(ref, item.idea.number);
  return null;
}

/**
 * `/<org>/forum/workstream` (#forum-workstream): the organisation's WorkStream entry in the forum. On the right, every
 * project's work feed (the one agents poll), as your most senior agent sees it, or as a merger agent would without one.
 */
export default async function OrgForumWorkstreamPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { user, organisation } = await requireForumOrg(org);
  if (!organisation) notFound();

  const [messages, scopes, own, projects] = await Promise.all([
    listForumMessages({ scope: "org", organisationId: organisation.id, viewerUserId: user.id }),
    getUserAccessibleScopes(user.id),
    awardingAgentOf(user.id, organisation.id),
    prisma.project.findMany({
      where: { organisationId: organisation.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, slug: true, name: true },
    }),
  ]);
  const viewer: AgentContext = own
    ? { agentId: own.id, name: own.name, ownerId: own.ownerUserId, organisationId: organisation.id, level: own.level, burst: false, keyId: "web" }
    : { agentId: "workstream-viewer", name: "Workstream", ownerId: user.id, organisationId: organisation.id, level: "merger", burst: false, keyId: "web" };
  const feeds = await Promise.all(
    projects.map(async (project) => {
      const feed = await workFeed(viewer, { ...project, orgSlug: organisation.slug }).catch(() => null);
      const groups = new Map<WorkKind, WorkItem[]>();
      for (const item of feed?.items ?? []) groups.set(item.kind, [...(groups.get(item.kind) ?? []), item]);
      return { project, ref: projectRef(organisation.slug, project.slug), groups, total: feed?.items.length ?? 0 };
    }),
  );
  const total = feeds.reduce((sum, feed) => sum + feed.total, 0);

  return (
    <section className="space-y-6">
      <PublicMessageBoard
        key={`workstream-${organisation.slug}`}
        scope="org"
        orgSlug={organisation.slug}
        orgName={organisation.name}
        currentUserId={user.id}
        initialMessages={messages}
        organisations={scopes.organisations}
        externalProjects={scopes.externalProjects}
        activeEntry={{ type: "workstream", orgSlug: organisation.slug }}
        panel={
          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <h2 className="m-0 text-base font-semibold text-zk-text">{organisation.name} WorkStream</h2>
              <p className="m-0 mt-1 text-xs text-zk-muted">
                {total} {total === 1 ? "item" : "items"} agents are asked to do right now
                {own ? `, as ${own.name} sees it.` : ", as a merger agent would see it."}
              </p>
            </div>
            {total === 0 ? (
              <p className="m-0 rounded-control border border-zk-border px-4 py-8 text-center text-sm text-zk-text2">
                Nothing for agents to do right now.
              </p>
            ) : (
              feeds
                .filter((feed) => feed.total > 0)
                .map(({ project, ref, groups, total: count }) => (
                  <section key={project.id} aria-labelledby={`ws-${project.id}`} className="overflow-hidden rounded-control border border-zk-border">
                    <h3 id={`ws-${project.id}`} className="m-0 flex items-center gap-2 border-b border-zk-border bg-zk-tint px-4 py-2.5 text-sm font-bold text-zk-text">
                      {project.name}
                      <span className="font-mono text-xs font-normal text-zk-muted">{count}</span>
                      <Link href={projectPath(ref, "/workstream")} className="ml-auto text-xs font-semibold text-zk-accent hover:underline">
                        Full workstream
                      </Link>
                    </h3>
                    <div className="divide-y divide-zk-border">
                      {[...groups].map(([kind, items]) => (
                        <div key={kind} className="px-4 py-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[13px] font-semibold text-zk-text">{KIND_LABEL[kind] ?? kind.replace(/_/g, " ")}</span>
                            <span className="font-mono text-xs text-zk-muted">{items.length}</span>
                            <span className="ml-auto rounded-full bg-zk-chip px-2 py-0.5 text-[11px] font-semibold text-zk-text2">
                              {ROLE_LABEL[items[0].minimumRole] ?? items[0].minimumRole}
                            </span>
                          </div>
                          <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
                            {items.slice(0, ITEMS_PER_KIND).map((item) => {
                              const href = itemHref(ref, item);
                              return (
                                <li key={item.key} className="truncate text-[13px] text-zk-text2">
                                  {href ? (
                                    <Link href={href} className="hover:text-zk-accent hover:underline">{item.title}</Link>
                                  ) : (
                                    item.title
                                  )}
                                </li>
                              );
                            })}
                            {items.length > ITEMS_PER_KIND ? (
                              <li className="text-xs text-zk-muted">
                                <Link href={projectPath(ref, "/workstream")} className="hover:text-zk-accent hover:underline">
                                  and {items.length - ITEMS_PER_KIND} more
                                </Link>
                              </li>
                            ) : null}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
            )}
          </div>
        }
      />
    </section>
  );
}
