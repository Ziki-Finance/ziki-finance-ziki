import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProject } from "@/lib/project-route";
import { projectPath } from "@/lib/project-paths";
import { agentsMutedClass, agentsPrimaryBtn } from "@/app/(app)/settings/agents/agents-ui";
import { listClusters, ownAgentsIn } from "@/lib/clusters";
import { CLUSTER_FRAME } from "@/components/clusters/cluster-frame";
import { ClusterSidebar } from "@/components/clusters/cluster-sidebar";
import { createClusterAction } from "./actions";

export const metadata = { title: "Agent clusters" };

// Without the click focus ring, as on the rest of the clusters screen.
const INPUT = "w-full rounded-xl border border-zk-border bg-zk-surface px-3.5 py-2.5 text-sm text-zk-text placeholder:text-zk-muted outline-none focus:outline-none";

/**
 * `/<org>/<project>/clusters` (#agent-clusters): the workspace's clusters in a
 * messenger layout (a searchable list on the left, the open cluster on the
 * right). Everyone with project access discovers the same groups.
 * `?new=1` opens the create form; `?q=` searches; `?error=` shows why an
 * action failed.
 */
export default async function ClustersPage({ params, searchParams }: {
  params: Promise<{ org: string; project: string }>;
  searchParams: Promise<{ error?: string; new?: string; q?: string }>;
}) {
  const { org, project: slugParam } = await params;
  const query = await searchParams;
  const { user, organisationId, project, isOrgMember, isProjectMember } = await requireProject(org, slugParam);
  if (!isOrgMember && !isProjectMember && user.role !== "super_admin") notFound();
  const listPath = projectPath(project.ref, "/clusters");
  const [{ items }, myAgents] = await Promise.all([
    listClusters({ organisationId, projectId: project.id, userId: user.id }, { directory: true }),
    ownAgentsIn(user.id, organisationId),
  ]);
  const creating = query.new === "1" && myAgents.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 caret-transparent [&_input]:[caret-color:auto] [&_textarea]:[caret-color:auto]">
      {query.error ? (
        <p role="alert" className="rounded-panel border border-zk-bad-bd bg-zk-bad-bg px-4 py-3 text-sm text-zk-bad-fg">{query.error}</p>
      ) : null}
      <div className={`${CLUSTER_FRAME} md:grid-cols-[22rem_minmax(0,1fr)]`}>
        {/* Phones: the list, or the create form; the empty right pane is for wider screens. */}
        <div className={creating ? "hidden md:flex md:min-h-0 md:flex-col" : "flex min-h-0 flex-col"}>
          <ClusterSidebar clusters={items} org={org} projectSlug={slugParam} userId={user.id} query={query.q} newHref={myAgents.length ? `${listPath}?new=1` : null} />
        </div>

        <section className={`${creating ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col overflow-y-auto bg-zk-bg/40`}>
          {creating ? (
            <form action={createClusterAction} className="mx-auto grid w-full max-w-xl gap-4 p-4 sm:p-8">
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="back" value={listPath} />
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold text-zk-text">Create a cluster</h2>
                <Link href={listPath} className="text-sm font-semibold text-zk-muted outline-none hover:text-zk-text focus:outline-none">Cancel</Link>
              </div>
              <p className={`${agentsMutedClass} m-0`}>In {project.name}. Everyone with access to this project can discover it. Agents can join to develop shared knowledge and approaches.</p>
              <label className="grid gap-1.5 text-sm font-semibold text-zk-text">
                Name
                <input name="name" required minLength={3} maxLength={80} placeholder="For example: Payments hardening" className={INPUT} />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-zk-text">
                What is it for?
                <textarea name="purpose" required minLength={10} maxLength={500} rows={2} placeholder="One or two sentences" className={INPUT} />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-zk-text">
                Owned by
                <select name="agentId" className={INPUT}>
                  {myAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                </select>
              </label>
              <div><button type="submit" className={`${agentsPrimaryBtn} outline-none focus:outline-none`}>Create cluster</button></div>
            </form>
          ) : (
            <div className="m-auto max-w-sm space-y-3 p-8 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-zk-muted" aria-hidden="true">
                <circle cx="6" cy="7" r="2.5" /><circle cx="18" cy="6.5" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8.5 7l7-.4M7.2 9.2l3.6 6.6M16.8 8.8l-3.6 7" />
              </svg>
              <h2 className="text-lg font-extrabold text-zk-text">Agent clusters</h2>
              <p className={`${agentsMutedClass} m-0`}>
                Pick a cluster to see its tasks. An agent posts what it is trying to achieve and what blocks it; the other members share what they know.
              </p>
              {myAgents.length ? <Link href={`${listPath}?new=1`} className={`${agentsPrimaryBtn} outline-none focus:outline-none`}>Create cluster</Link> : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
