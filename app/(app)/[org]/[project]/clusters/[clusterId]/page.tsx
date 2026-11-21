import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProject } from "@/lib/project-route";
import { projectPath } from "@/lib/project-paths";
import { IssueApiError } from "@/lib/agent-api/errors";
import { prisma } from "@/lib/prisma";
import { LocalTime } from "@/components/local-time";
import { ClusterMark } from "@/components/clusters/cluster-mark";
import { CLUSTER_FRAME } from "@/components/clusters/cluster-frame";
import { ClusterSidebar } from "@/components/clusters/cluster-sidebar";
import { agentsDangerBtn, agentsMutedClass, agentsPrimaryBtn, agentsSecondaryBtn } from "@/app/(app)/settings/agents/agents-ui";
import {
  getClusterCard, listClusters, listPending, listTasks, ownAgentsIn, readDoc, readNotes, suggestInvites, type ClusterViewer,
} from "@/lib/clusters";
import {
  respondToInviteAction, addBlockerAction, addTaskAction, deleteClusterAction, inviteAction, joinClusterAction, leaveClusterAction, removeMemberAction,
  saveDocAction, saveNoteAction, shareAction, solveBlockerAction,
} from "../actions";

export const metadata = { title: "Cluster" };

const INPUT = "w-full rounded-xl border border-zk-border bg-zk-surface px-3.5 py-2.5 text-sm text-zk-text placeholder:text-zk-muted outline-none focus:outline-none";
const NOFOCUS = "outline-none focus:outline-none";
const TEXT_LINK = "text-xs font-bold outline-none hover:underline focus:outline-none";
const PANEL_TITLE = "m-0 text-[11px] font-bold uppercase tracking-wide text-zk-muted";

/**
 * `/<org>/<project>/clusters/<id>` (#agent-clusters): an open cluster in the
 * messenger layout. Left: the workspace's clusters. Middle: the cluster's header
 * and its tasks as a conversation (each task says what its agent is trying to
 * achieve and what blocks it; members reply with what they know), with a bar to
 * post a task. Tabs switch the middle to the cluster's shared doc (`?view=doc`,
 * which every member reads and edits, with its revisions) or your agent's
 * private doc (`?view=private`, which only you and your agent read).
 * `?info=1` opens the group info panel (members, invites, leave or delete).
 * Non-members see the cluster's card and Join or Accept instead of its tasks.
 * On phones the list, the chat and group info each take the whole screen.
 */
export default async function ClusterPage({ params, searchParams }: {
  params: Promise<{ org: string; project: string; clusterId: string }>;
  searchParams: Promise<{ error?: string; info?: string; q?: string; view?: string }>;
}) {
  const { org, project: slugParam, clusterId } = await params;
  const query = await searchParams;
  const { user, organisationId, project, isOrgMember, isProjectMember } = await requireProject(org, slugParam);
  if (!isOrgMember && !isProjectMember && user.role !== "super_admin") notFound();
  const viewer: ClusterViewer = { organisationId, projectId: project.id, userId: user.id };

  let cluster;
  try {
    ({ cluster } = await getClusterCard(viewer, clusterId));
  } catch (caught) {
    if (caught instanceof IssueApiError && caught.status === 404) notFound();
    throw caught;
  }
  const listPath = projectPath(project.ref, "/clusters");
  const here = projectPath(project.ref, `/clusters/${clusterId}`);
  const showInfo = query.info === "1";
  const view = query.view === "doc" || query.view === "private" ? query.view : "tasks";
  const viewPath = view === "tasks" ? here : `${here}?view=${view}`;
  const member = cluster.myStatus === "active";
  const [{ items }, myAgents] = await Promise.all([
    listClusters(viewer, { directory: true }),
    ownAgentsIn(user.id, organisationId),
  ]);
  const memberIds = new Set(cluster.members.map((m) => m.agentId));
  // Owners act as the creator agent when it is theirs; anyone else as their first member agent.
  const acting = myAgents.find((a) => a.id === cluster.creatorAgentId) ?? myAgents.find((a) => memberIds.has(a.id)) ?? null;
  const isOwner = acting?.id === cluster.creatorAgentId;
  const owner = cluster.members.find((m) => m.agentId === cluster.creatorAgentId)?.name;
  const [tasks, notes, pending, suggestions, doc] = member && acting
    ? await Promise.all([
      listTasks(viewer, clusterId), readNotes(viewer, clusterId), listPending(viewer, clusterId),
      suggestInvites(viewer, clusterId).catch(() => ({ items: [] })),
      readDoc(viewer, clusterId),
    ])
    : [null, null, null, null, null];
  const myNote = notes && acting ? notes.items.find((n) => n.agentId === acting.id) ?? null : null;
  const lastEdit = doc?.revisions[0] ?? null;
  // Accept with the invited agent, otherwise join with an owned agent.
  const invitations = await prisma.clusterMember.findMany({
    where: { clusterId, status: "invited", agentId: { in: myAgents.map(agent => agent.id) } },
    select: { agentId: true, agent: { select: { name: true } } },
  });
  const joiner = myAgents[0];
  const open = !cluster.archived;
  const hidden = (extra: Record<string, string> = {}) => {
    const { back = here, agentId = acting?.id ?? "", ...rest } = extra;
    return (
      <>
        <input type="hidden" name="projectId" value={project.id} />
        <input type="hidden" name="agentId" value={agentId} />
        <input type="hidden" name="back" value={back} />
        <input type="hidden" name="clusterId" value={clusterId} />
        {Object.entries(rest).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      </>
    );
  };

  const invitationControls = invitations.length > 0 && (
    <section id="cluster-invitations" aria-label="Your invitations" className="space-y-3 border-b border-zk-border bg-zk-surface p-4">
      {invitations.map(invite => (
        <form key={invite.agentId} action={respondToInviteAction} className="flex flex-wrap items-center gap-2">
          {hidden({ agentId: invite.agentId })}
          <p className="w-full text-sm">Your agent <b>{invite.agent.name}</b> was invited to {cluster.name}.</p>
          <button className={agentsPrimaryBtn} name="decision" value="accept">Accept invite</button>
          <button className={agentsSecondaryBtn} name="decision" value="decline">Decline</button>
        </form>
      ))}
    </section>
  );
  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 caret-transparent [&_input]:[caret-color:auto] [&_textarea]:[caret-color:auto]">
      {query.error ? <p role="alert" className="rounded-[20px] border border-zk-bad-bd bg-zk-bad-bg px-4 py-3 text-sm text-zk-bad-fg">{query.error}</p> : null}
      {/* Phones: one pane at a time (the chat, or group info); the list is its own page. */}
      <div className={`${CLUSTER_FRAME} ${showInfo && member ? "md:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[20rem_minmax(0,1fr)_18rem]" : "md:grid-cols-[22rem_minmax(0,1fr)]"}`}>
        <div className={showInfo && member ? "hidden xl:flex xl:min-h-0 xl:flex-col" : "hidden md:flex md:min-h-0 md:flex-col"}>
          <ClusterSidebar clusters={items} currentId={clusterId} org={org} projectSlug={slugParam} userId={user.id} query={query.q} newHref={myAgents.length ? `${listPath}?new=1` : null} />
        </div>

        <section aria-label={cluster.name} className={`${showInfo && member ? "hidden md:flex" : "flex"} min-h-0 min-w-0 flex-col`}>
          {/* Header bar, as an open chat's: back on phones, the cluster, and its info. */}
          <header className="flex min-w-0 items-center gap-2 border-b border-zk-border bg-zk-surface px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
            <Link href={listPath} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-zk-muted hover:bg-zk-chip md:hidden ${NOFOCUS}`} aria-label="All clusters">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
            <ClusterMark name={cluster.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-[15px] font-extrabold text-zk-text">{cluster.name}</p>
              <p className="m-0 truncate text-xs text-zk-muted">
                {cluster.project.name} · {cluster.members.length} {cluster.members.length === 1 ? "member" : "members"}
              </p>
            </div>
            {member ? (
              <Link href={showInfo ? viewPath : `${viewPath}${view === "tasks" ? "?" : "&"}info=1`} title="Group info" aria-label={showInfo ? "Close group info" : "Group info"} className={`${agentsSecondaryBtn} min-h-9 shrink-0 px-2.5 sm:px-4 ${NOFOCUS}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sm:hidden" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
                <span className="hidden sm:inline">{showInfo ? "Close info" : "Group info"}</span>
              </Link>
            ) : null}
            {/* Close the chat: back to the list with nothing open, as in a messenger. */}
            <Link href={listPath} title="Close chat" aria-label="Close chat" className={`hidden h-9 w-9 shrink-0 place-items-center rounded-full text-zk-muted hover:bg-zk-chip hover:text-zk-text md:grid ${NOFOCUS}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </Link>
          </header>

          {(!showInfo || !member) && invitationControls}
          {member && acting ? (
            <nav aria-label="Cluster views" className="flex shrink-0 gap-1 overflow-x-auto border-b border-zk-border bg-zk-surface px-2 [scrollbar-width:none] sm:px-3 [&::-webkit-scrollbar]:hidden">
              {([["tasks", "Tasks", here], ["doc", "Shared doc", `${here}?view=doc`], ["private", "Private doc", `${here}?view=private`]] as const).map(([key, label, href]) => (
                <Link
                  key={key}
                  href={showInfo ? `${href}${key === "tasks" ? "?" : "&"}info=1` : href}
                  aria-current={view === key ? "page" : undefined}
                  className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-bold ${NOFOCUS} ${view === key ? "border-electric-blue text-zk-accent" : "border-transparent text-zk-muted hover:text-zk-text"}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto bg-zk-bg/40 px-3 py-4 sm:px-6">
            {view === "tasks" || !member ? (
              <div className="mx-auto max-w-xl rounded-2xl bg-zk-surface px-4 py-3 text-center text-xs text-zk-muted shadow-[0_1px_2px_rgba(11,23,51,0.06)] [overflow-wrap:anywhere]">
                {owner ? `${owner} created this cluster. ` : ""}{cluster.purpose}
              </div>
            ) : null}

            {member && acting && view === "doc" && doc ? (
              <div className="mx-auto max-w-3xl space-y-3">
                <div className="space-y-3 rounded-2xl bg-zk-surface p-4 shadow-[0_1px_2px_rgba(11,23,51,0.08)] sm:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h2 className="m-0 text-base font-extrabold text-zk-text">Shared doc</h2>
                    <p className="m-0 text-xs text-zk-muted">
                      {lastEdit ? <>Version {doc.version} · {lastEdit.editorName} · <LocalTime date={lastEdit.createdAt} /></> : "Not written yet"}
                    </p>
                  </div>
                  <p className="m-0 text-xs text-zk-muted">What the cluster knows. Every member reads it and can edit it.</p>
                  {doc.body ? (
                    <div className="whitespace-pre-wrap rounded-xl border border-zk-border bg-zk-bg/40 p-3 text-sm text-zk-text2 [overflow-wrap:anywhere]">{doc.body}</div>
                  ) : (
                    <p className={`${agentsMutedClass} m-0`}>Nothing here yet. Write what every member should know: decisions, links, how things work.</p>
                  )}
                  {open ? (
                    <details className="group" open={!doc.body}>
                      <summary className={`${agentsSecondaryBtn} min-h-9 w-fit cursor-pointer list-none px-4 ${NOFOCUS} [&::-webkit-details-marker]:hidden`}>Edit shared doc</summary>
                      <form action={saveDocAction} className="mt-3 grid gap-2">
                        {hidden({ back: `${here}?view=doc`, expectedVersion: String(doc.version) })}
                        <textarea name="body" rows={10} maxLength={100_000} defaultValue={doc.body} placeholder="Write the shared doc" className={INPUT} />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input name="reason" maxLength={500} placeholder="What changed? (optional)" className={`${INPUT} min-w-0 flex-1`} />
                          <button type="submit" className={`${agentsPrimaryBtn} shrink-0 ${NOFOCUS}`}>Save as {acting.name}</button>
                        </div>
                        <p className="m-0 text-xs text-zk-muted">If someone saved a newer version first, yours is refused so nothing is overwritten: reload and edit again.</p>
                      </form>
                    </details>
                  ) : null}
                </div>
                {doc.revisions.length ? (
                  <div className="space-y-2 rounded-2xl bg-zk-surface p-4 shadow-[0_1px_2px_rgba(11,23,51,0.08)] sm:p-5">
                    <p className={PANEL_TITLE}>History</p>
                    <ul className="m-0 grid list-none gap-1.5 p-0">
                      {doc.revisions.slice(0, 8).map((r) => (
                        <li key={r.id} className="text-xs text-zk-text2 [overflow-wrap:anywhere]">
                          <b className="font-bold text-zk-text">v{r.version}</b> · {r.editorName} · <LocalTime date={r.createdAt} />{r.reason ? <> · {r.reason}</> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : member && acting && view === "private" ? (
              <div className="mx-auto max-w-3xl space-y-3 rounded-2xl bg-zk-surface p-4 shadow-[0_1px_2px_rgba(11,23,51,0.08)] sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 className="m-0 text-base font-extrabold text-zk-text">Private doc</h2>
                  {myNote ? <p className="m-0 text-xs text-zk-muted">Saved <LocalTime date={myNote.updatedAt} /></p> : null}
                </div>
                <p className="m-0 text-xs text-zk-muted">{acting.name}&apos;s own notes in this cluster. Only you and your agent can read them; other members never see them.</p>
                <form action={saveNoteAction} className="grid gap-2">
                  {hidden({ back: `${here}?view=private` })}
                  <textarea name="body" rows={12} maxLength={20_000} defaultValue={myNote?.body ?? ""} placeholder={`Private notes for ${acting.name}`} className={INPUT} />
                  <div><button type="submit" className={`${agentsPrimaryBtn} ${NOFOCUS}`}>Save private doc</button></div>
                </form>
              </div>
            ) : !member || !acting || !tasks ? (
              <div className="mx-auto max-w-md space-y-3 rounded-2xl bg-zk-surface p-6 text-center shadow-[0_1px_2px_rgba(11,23,51,0.06)]">
                <p className="m-0 text-sm font-bold text-zk-text">Only members see this cluster&apos;s tasks.</p>
                {invitations.length ? null : joiner && open ? (
                  <form action={joinClusterAction}>{hidden({ agentId: joiner.id })}<button type="submit" className={`${agentsPrimaryBtn} ${NOFOCUS}`}>Join as {joiner.name}</button></form>
                ) : <p className={agentsMutedClass}>Choose an agent in this organisation to join.</p>}
              </div>
            ) : tasks.items.length ? (
              [...tasks.items].reverse().map((task) => {
                const mine = task.authorAgentId === acting.id;
                const blockerText = new Map(task.blockers.map((blocker) => [blocker.id, blocker.text]));
                const openBlockers = task.blockers.filter((blocker) => blocker.solvedAt === null);
                return (
                  <article key={task.id} className={`max-w-[44rem] space-y-2 rounded-2xl bg-zk-surface px-4 py-3 shadow-[0_1px_2px_rgba(11,23,51,0.08)] ${mine ? "ml-auto border border-electric-blue/20" : ""}`}>
                    <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                      <b className="font-bold text-zk-accent">{task.authorName}</b>
                      <span className="text-zk-muted"><LocalTime date={task.createdAt} /></span>
                    </p>
                    <p className="m-0 text-sm font-extrabold text-zk-text [overflow-wrap:anywhere]">
                      {task.issueNumber ? <Link href={projectPath(project.ref, `/${task.issueNumber}`)} className={`mr-1.5 font-mono text-zk-accent hover:underline ${NOFOCUS}`}>#{task.issueNumber}</Link> : null}
                      {task.title}
                    </p>
                    <p className="m-0 whitespace-pre-wrap text-sm text-zk-text2 [overflow-wrap:anywhere]">{task.body}</p>
                    {task.blockers.length ? (
                      <ul className="m-0 grid list-none gap-1 p-0">
                        {task.blockers.map((blocker) => (
                          <li key={blocker.id} className="flex items-start gap-2 text-sm">
                            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${blocker.solvedAt ? "bg-zk-chip text-zk-text2" : "bg-zk-warn-bg text-zk-warn-fg"}`}>{blocker.solvedAt ? "Solved" : "Blocked"}</span>
                            <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${blocker.solvedAt ? "text-zk-muted line-through" : "text-zk-text2"}`}>{blocker.text}</span>
                            {mine && open ? (
                              <form action={solveBlockerAction} className="shrink-0">
                                {hidden({ blockerId: blocker.id, solved: blocker.solvedAt ? "false" : "true" })}
                                <button type="submit" className={`${TEXT_LINK} text-zk-accent`}>{blocker.solvedAt ? "Reopen" : "Solved"}</button>
                              </form>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {task.shared.length ? (
                      <ul className="m-0 grid list-none gap-1.5 border-l-2 border-zk-divider p-0 pl-3">
                        {task.shared.map((info) => (
                          <li key={info.id} className="text-sm">
                            <p className="m-0 text-xs text-zk-muted">
                              <b className="font-bold text-zk-text">{info.authorName}</b> · <LocalTime date={info.createdAt} />
                              {info.blockerId && blockerText.has(info.blockerId) ? <> · re: {blockerText.get(info.blockerId)}</> : null}
                            </p>
                            <p className="m-0 whitespace-pre-wrap text-zk-text2 [overflow-wrap:anywhere]">{info.body}</p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {open ? (
                      <details className="group">
                        <summary className={`cursor-pointer list-none text-xs font-bold text-zk-accent ${NOFOCUS} [&::-webkit-details-marker]:hidden`}>Reply or add a blocker</summary>
                        <form action={shareAction} className="mt-2 grid gap-2">
                          {hidden({ taskId: task.id })}
                          <textarea name="body" required rows={2} placeholder="Share what you know" className={INPUT} />
                          <div className="flex flex-wrap items-center gap-2">
                            {openBlockers.length ? (
                              <select name="blockerId" defaultValue="" className={`${INPUT} w-auto min-w-0 max-w-full flex-1`}>
                                <option value="">General reply</option>
                                {openBlockers.map((blocker) => <option key={blocker.id} value={blocker.id}>Answers: {blocker.text}</option>)}
                              </select>
                            ) : null}
                            <button type="submit" className={`${agentsPrimaryBtn} min-h-9 px-4 ${NOFOCUS}`}>Send</button>
                          </div>
                        </form>
                        <form action={addBlockerAction} className="mt-2 flex gap-2">
                          {hidden({ taskId: task.id })}
                          <input name="text" required minLength={3} maxLength={1000} placeholder="Add a blocker" className={`${INPUT} min-w-0 flex-1`} />
                          <button type="submit" className={`${agentsSecondaryBtn} min-h-9 px-4 ${NOFOCUS}`}>Add</button>
                        </form>
                      </details>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className={`${agentsMutedClass} m-0 text-center`}>No tasks yet. Post the first one below.</p>
            )}
          </div>

          {member && acting && open && view === "tasks" ? (
            <details className="group shrink-0 border-t border-zk-border bg-zk-surface">
              <summary className={`flex cursor-pointer list-none items-center gap-3 px-4 py-3 ${NOFOCUS} [&::-webkit-details-marker]:hidden`}>
                <span className="min-w-0 flex-1 truncate rounded-full border border-zk-border bg-zk-chip/50 px-4 py-2.5 text-sm text-zk-muted">Post a task as {acting.name}…</span>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-electric-blue-strong text-white" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </span>
              </summary>
              <form action={addTaskAction} className="grid gap-2 px-4 pb-4">
                {hidden()}
                <input name="title" required minLength={3} maxLength={200} placeholder="Task title" className={INPUT} />
                <textarea name="tryingToAchieve" required minLength={3} rows={2} placeholder="What are you trying to achieve?" className={INPUT} />
                <textarea name="blockers" rows={2} placeholder="What is blocking you? One per line." className={INPUT} />
                <div className="flex flex-wrap items-center gap-2">
                  <input name="issueNumber" type="number" min={1} placeholder="Issue # (optional)" className={`${INPUT} w-40`} />
                  <span className="flex-1" />
                  <button type="submit" className={`${agentsPrimaryBtn} ${NOFOCUS}`}>Post task</button>
                </div>
              </form>
            </details>
          ) : null}
        </section>

        {showInfo && member && acting && pending && suggestions ? (
          <aside aria-label="Group info" className="flex min-h-0 min-w-0 flex-col overflow-y-auto border-zk-border md:border-l">
            <div className="flex items-center gap-2 border-b border-zk-border px-3 py-2.5 md:hidden">
              <Link href={viewPath} className={`grid h-9 w-9 place-items-center rounded-full text-zk-muted hover:bg-zk-chip ${NOFOCUS}`} aria-label="Back to the chat">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              </Link>
              <p className="m-0 text-[15px] font-extrabold text-zk-text">Group info</p>
            </div>
            {invitationControls}
            <div className="space-y-2 border-b border-zk-border p-5 text-center">
              <div className="flex justify-center"><ClusterMark name={cluster.name} size={72} /></div>
              <p className="m-0 text-base font-extrabold text-zk-text">{cluster.name}</p>
              <p className="m-0 text-xs text-zk-muted">Cluster · {cluster.members.length} {cluster.members.length === 1 ? "member" : "members"} · {cluster.project.name}</p>
            </div>
            <div className="space-y-3 border-b border-zk-border p-5">
              <p className={PANEL_TITLE}>Members</p>
              <ul className="m-0 grid list-none gap-3 p-0">
                {cluster.members.map((m) => (
                  <li key={m.agentId} className="flex min-w-0 items-center gap-3">
                    <ClusterMark name={m.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-sm font-bold text-zk-text">{m.name}</p>
                      <p className="m-0 truncate text-xs text-zk-muted">{m.agentId === cluster.creatorAgentId ? "Owner" : "Member"}</p>
                    </div>
                    {isOwner && m.agentId !== cluster.creatorAgentId ? (
                      <form action={removeMemberAction} className="shrink-0">
                        {hidden({ memberId: m.agentId, decision: "remove", back: `${here}?info=1` })}
                        <button type="submit" className={`${TEXT_LINK} text-zk-bad-fg`}>Remove</button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
              {pending.items.length ? (
                <div className="space-y-1.5 pt-1">
                  <p className={PANEL_TITLE}>Invited</p>
                  {pending.items.map((p) => (
                    <div key={p.agentId} className="flex items-center justify-between gap-2 text-sm text-zk-text2">
                      <span className="truncate">{p.name}</span>
                      {isOwner ? (
                        <form action={removeMemberAction} className="shrink-0">
                          {hidden({ memberId: p.agentId, decision: "cancel_invite", back: `${here}?info=1` })}
                          <button type="submit" className={`${TEXT_LINK} text-zk-bad-fg`}>Cancel</button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {open && suggestions.items.length ? (
                <form action={inviteAction} className="space-y-2 pt-1">
                  {hidden({ back: `${here}?info=1` })}
                  <label htmlFor="invitee" className={`${PANEL_TITLE} block`}>Invite an agent</label>
                  <select id="invitee" name="invitee" className={INPUT}>
                    {suggestions.items.map((s) => <option key={s.agentId} value={s.agentId}>{s.name}</option>)}
                  </select>
                  <button type="submit" className={`${agentsSecondaryBtn} w-full min-h-9 ${NOFOCUS}`}>Invite</button>
                </form>
              ) : null}
            </div>
            <div className="space-y-2 p-5">
              {isOwner ? (
                <details className="group">
                  <summary className={`${agentsDangerBtn} w-full min-h-9 cursor-pointer list-none ${NOFOCUS} [&::-webkit-details-marker]:hidden`}>Delete cluster</summary>
                  <div className="mt-2 space-y-2 text-xs text-zk-text2">
                    <p className="m-0">Deletes the cluster with its tasks and notes for every member. It can&apos;t be undone.</p>
                    <form action={deleteClusterAction}>
                      {hidden({ afterDelete: listPath })}
                      <button type="submit" className={`${agentsDangerBtn} w-full min-h-9 ${NOFOCUS}`}>Yes, delete it</button>
                    </form>
                  </div>
                </details>
              ) : (
                <form action={leaveClusterAction}>
                  {hidden({ back: listPath })}
                  <button type="submit" className={`${agentsDangerBtn} w-full min-h-9 ${NOFOCUS}`}>Leave cluster</button>
                </form>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
