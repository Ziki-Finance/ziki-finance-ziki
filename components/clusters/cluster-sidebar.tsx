"use client";

import { useEffect, useState } from "react";
import { sharedMatches } from "@/app/(app)/[org]/[project]/clusters/search";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { ClusterMark } from "@/components/clusters/cluster-mark";

export type SidebarCluster = {
  id: string;
  name: string;
  purpose: string;
  members: { agentId: string }[];
  lastActivityAt: Date;
  myStatus: string | null;
  archived: boolean;
  project: { name: string; path: string };
  lastTask: { title: string; authorName: string } | null;
};

/**
 * The left column of the Clusters screen (#agent-clusters), laid out like a
 * messenger's chat list: a search box, then the workspace's clusters as rows
 * (mark, name, time, the latest task or purpose, project and members). Your
 * clusters come first; the rest are clusters you can open and join.
 */
export function ClusterSidebar({ clusters, currentId, org, projectSlug, userId, query, newHref }: {
  clusters: SidebarCluster[];
  currentId?: string;
  org: string;
  projectSlug: string;
  userId: string;
  query?: string;
  newHref: string | null;
}) {
  const [input, setInput] = useState(query ?? "");
  const [limit, setLimit] = useState(8);
  const [recent, setRecent] = useState<string[]>([]);
  const [shared, setShared] = useState<{ query: string; excerpts: Map<string, string> }>();
  const term = input.trim().toLowerCase();
  useEffect(() => {
    const key = JSON.stringify(["cluster-recent", org, projectSlug, userId]);
    const load = () => { try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      const ids = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
      const next = currentId ? [currentId, ...ids.filter(id => id !== currentId)].slice(0, 8) : ids;
      setRecent(next);
      if (currentId && ids[0] !== currentId) localStorage.setItem(key, JSON.stringify(next));
    } catch { setRecent([]); } };
    const frame = requestAnimationFrame(load);
    return () => cancelAnimationFrame(frame);
  }, [currentId, org, projectSlug, userId]);
  useEffect(() => {
    if (!term) return;
    let active = true;
    const timer = setTimeout(() => {
      sharedMatches(org, projectSlug, term).then(rows => {
        if (active) setShared({ query: term, excerpts: new Map(rows.map(r => [r.id, r.excerpt])) });
      }).catch(() => { if (active) setShared(undefined); });
    }, 220);
    return () => { active = false; clearTimeout(timer); };
  }, [org, projectSlug, term]);
  const excerpts = shared?.query === term ? shared.excerpts : undefined;
  const words = term.split(/\s+/);
  const results = clusters.flatMap(cluster => {
    const name = cluster.name.toLowerCase();
    const text = name + " " + cluster.purpose.toLowerCase();
    if (term && !words.every(word => text.includes(word)) && !excerpts?.has(cluster.id)) return [];
    const position = recent.indexOf(cluster.id);
    let score = position < 0 ? 0 : 10 - position;
    if (term) {
      score = name === term ? 5 : name.startsWith(term) ? 4 : name.includes(term) ? 3 : words.every(word => name.includes(word)) ? 2 : 1;
    }
    return [{ cluster, score }];
  }).sort((a,b) => b.score - a.score || b.cluster.lastActivityAt.getTime() - a.cluster.lastActivityAt.getTime());
  const row = (c: SidebarCluster) => {
    const on = c.id === currentId;
    return (
      <li key={c.id}>
        <Link
          href={`${c.project.path}/clusters/${c.id}`}
          aria-current={on ? "page" : undefined}
          className={`flex items-center gap-3 px-4 py-3 outline-none transition focus:outline-none ${on ? "bg-zk-tint" : "hover:bg-zk-chip/60"} ${c.archived ? "opacity-60" : ""}`}
        >
          <ClusterMark name={c.name} size={44} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-bold text-zk-text">{c.name}</span>
              <span className="shrink-0 text-[11px] text-zk-muted"><LocalTime date={c.lastActivityAt} /></span>
            </span>
            <span className="block truncate text-xs text-zk-text2">
              {term ? excerpts?.get(c.id) ?? c.purpose : c.lastTask ? `${c.lastTask.authorName}: ${c.lastTask.title}` : c.purpose}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zk-muted">
              <span className="truncate">{c.project.name}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{c.members.length} {c.members.length === 1 ? "member" : "members"}</span>
              {c.myStatus === "invited" ? <span className="shrink-0 rounded-full bg-zk-accent px-1.5 text-[10px] font-bold text-white">Invited</span> : null}
            </span>
          </span>
        </Link>
      </li>
    );
  };
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col border-zk-border md:border-r">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h1 className="text-xl font-extrabold tracking-tight text-zk-text">Clusters</h1>
        {newHref ? (
          <Link href={newHref} title="Create cluster" aria-label="Create cluster" className="grid h-9 w-9 place-items-center rounded-full bg-electric-blue-strong text-white outline-none hover:bg-[#2552af] focus:outline-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </Link>
        ) : null}
      </div>
      <div className="px-4 pb-3">
        <label className="sr-only" htmlFor="cluster-search">Search clusters</label>
        <input
          id="cluster-search"
          name="q"
          type="search"
          value={input}
          maxLength={100}
          onChange={event => { setInput(event.target.value); setLimit(8); }}
          placeholder="Search clusters"
          className="h-10 w-full rounded-full border border-zk-border bg-zk-chip/50 px-4 text-sm text-zk-text placeholder:text-zk-muted outline-none focus:outline-none"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-zk-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <p aria-live="polite" className="m-0 px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-zk-muted">
          {term ? results.length + " matching clusters" : "Recent clusters"}
        </p>
        <ul className="m-0 list-none p-0">{results.slice(0, limit).map(({ cluster }) => row(cluster))}</ul>
        {results.length > limit && <button type="button" onClick={() => setLimit(limit + 8)} className="px-4 py-3 text-sm text-zk-muted">Show more clusters</button>}
        {!results.length && <p className="px-4 py-3 text-sm text-zk-muted">{term ? "Try a different name or keyword." : "No clusters yet."}</p>}
      </div>
    </div>
  );
}
