"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AccessibleOrganisation, ExternalProject } from "@/lib/forum-types";
import { buildForumSearchParams, parseForumSearchParams } from "@/lib/forum-url";
import { scopedForumPath, scopedForumPostPath } from "@/lib/project-paths";
import {
  buildForumScopeApiUrl,
  buildForumScopeKey,
  getCachedForumScope,
  getForumScopeCacheKey,
  setCachedForumScope,
} from "@/components/forum/forum-scope-cache";
import {
  DEFAULT_EXTERNAL_PROJECTS,
  DEFAULT_ORGANISATIONS,
  FORUM_SCROLLBAR_CLASS,
  trendingScore,
  type FeedFilter,
  type ForumCategory,
  type ForumMessage,
  type ForumReplyItem,
  type ForumViewMode,
  type MyAgentsView,
  type SelectedScope,
  type SortOption,
  type StatusFilter,
  type TrackFilter,
} from "@/components/forum/forum-shared";
import { ForumSidebar, type ForumSidebarEntry } from "@/components/forum/forum-sidebar";
import { ForumToolbar } from "@/components/forum/forum-toolbar";
import { ForumThreadList } from "@/components/forum/forum-thread-list";
import { ForumPostDetail } from "@/components/forum/forum-post-detail";

export { forumSourceLabel } from "@/components/forum/forum-shared";
export type { ForumCategory, ForumMessage, ForumReplyItem };

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

function useSafePathname() {
  try {
    return usePathname();
  } catch {
    return null;
  }
}

function useSafeSearchParams() {
  try {
    return useSearchParams();
  } catch {
    return null;
  }
}

export interface PublicMessageBoardProps {
  initialView?: ForumViewMode;
  initialPostId?: string;
  scope?: "platform" | "org" | "project";
  orgSlug?: string;
  orgName?: string;
  projectSlug?: string;
  projectName?: string;
  currentUserId?: string;
  organisations?: AccessibleOrganisation[];
  externalProjects?: ExternalProject[];
  initialMessages?: ForumMessage[];
  /** Shown on the right instead of the topics (#forum-instructions): llms.txt or an organisation's workstream. */
  panel?: React.ReactNode;
  /** Which sidebar entry the panel is, so the sidebar marks it. */
  activeEntry?: ForumSidebarEntry;
}

export function PublicMessageBoard({
  initialView = "list",
  initialPostId,
  scope = "platform",
  orgSlug,
  orgName,
  projectSlug,
  projectName,
  currentUserId,
  organisations,
  externalProjects,
  initialMessages,
  panel,
  activeEntry,
}: PublicMessageBoardProps = {}) {
  const router = useSafeRouter();
  const pathname = useSafePathname();
  const searchParams = useSafeSearchParams();
  const initialUrlFilters = parseForumSearchParams(searchParams);

  const [messages, setMessages] = useState<ForumMessage[]>(initialMessages ?? []);
  const [view, setView] = useState<ForumViewMode>(initialView);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(initialPostId ?? null);

  // Synchronize with external prop changes
  const [prevInitialPostId, setPrevInitialPostId] = useState(initialPostId);
  if (initialPostId !== prevInitialPostId) {
    setPrevInitialPostId(initialPostId);
    if (initialPostId) setSelectedPostId(initialPostId);
  }

  const [prevInitialView, setPrevInitialView] = useState(initialView);
  if (initialView !== prevInitialView) {
    setPrevInitialView(initialView);
    if (initialView) setView(initialView);
  }

  const [prevInitialMessages, setPrevInitialMessages] = useState(initialMessages);
  if (initialMessages !== prevInitialMessages) {
    setPrevInitialMessages(initialMessages);
    if (initialMessages) setMessages(initialMessages);
  }

  // Filters & sorting (initialized from URL query params)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialUrlFilters.statusFilter);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>(initialUrlFilters.feedFilter);
  const [trackFilter, setTrackFilter] = useState<TrackFilter>(initialUrlFilters.trackFilter);
  const [selectedTag, setSelectedTag] = useState<string | null>(initialUrlFilters.selectedTag);
  const [pinnedOnly, setPinnedOnly] = useState(initialUrlFilters.pinnedOnly);
  const [myAgentsView, setMyAgentsView] = useState<MyAgentsView>(initialUrlFilters.myAgentsView);
  const [searchQuery, setSearchQuery] = useState(initialUrlFilters.searchQuery);
  const [sortBy, setSortBy] = useState<SortOption>(initialUrlFilters.sortBy);
  const [userVotes] = useState<Record<string, "up" | "down">>({});

  // Sync active filters & sort to URL query params in list view without triggering RSC reloads
  const currentUrlQuery = searchParams?.toString() ?? "";
  useEffect(() => {
    if (view !== "list") return;
    const activePath =
      typeof window !== "undefined" ? window.location.pathname : pathname;
    if (!activePath) return;
    const nextQuery = buildForumSearchParams({
      trackFilter,
      feedFilter,
      statusFilter,
      pinnedOnly,
      myAgentsView,
      selectedTag,
      searchQuery,
      sortBy,
    });
    const currentSearch =
      typeof window !== "undefined"
        ? window.location.search.replace(/^\?/, "")
        : currentUrlQuery;
    if (nextQuery === currentSearch) return;
    const nextUrl = nextQuery ? `${activePath}?${nextQuery}` : activePath;
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", nextUrl);
    } else if (router) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [
    view,
    router,
    pathname,
    currentUrlQuery,
    trackFilter,
    feedFilter,
    statusFilter,
    pinnedOnly,
    myAgentsView,
    selectedTag,
    searchQuery,
    sortBy,
  ]);

  // Scope hierarchy
  const initialScopeConfig: SelectedScope = React.useMemo(() => {
    if (scope === "org" && orgSlug) {
      return { type: "org", orgId: orgSlug, name: orgName ?? orgSlug };
    }
    if (scope === "project" && orgSlug && projectSlug) {
      return {
        type: "project",
        orgId: orgSlug,
        projectId: projectSlug,
        name: projectName ?? `${orgName ?? orgSlug} / ${projectSlug}`,
      };
    }
    return { type: "global", name: "Global Ziki Forum" };
  }, [scope, orgSlug, orgName, projectSlug, projectName]);

  const [selectedScope, setSelectedScope] = useState<SelectedScope>(initialScopeConfig);
  const [prevScopeConfig, setPrevScopeConfig] = useState(initialScopeConfig);
  if (initialScopeConfig !== prevScopeConfig) {
    setPrevScopeConfig(initialScopeConfig);
    setSelectedScope(initialScopeConfig);
  }

  const [isScopeLoading, setIsScopeLoading] = useState(false);
  const activeRequestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const selectedScopeRef = useRef<SelectedScope>(selectedScope);
  useEffect(() => {
    selectedScopeRef.current = selectedScope;
  }, [selectedScope]);

  // Seed client SWR cache with SSR initialMessages
  useEffect(() => {
    if (initialMessages) {
      setCachedForumScope(
        getForumScopeCacheKey(currentUserId, initialScopeConfig),
        initialMessages,
      );
    }
  }, [currentUserId, initialScopeConfig, initialMessages]);

  // Abort any in-flight scope fetch on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const [expandedOrgs, setExpandedOrgs] = useState<Record<string, boolean>>({
    zedu: true,
    acme: false,
    ...(orgSlug ? { [orgSlug]: true } : {}),
  });

  const toggleOrgExpanded = (orgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedOrgs((prev) => ({ ...prev, [orgId]: !prev[orgId] }));
  };

  const effectiveOrgs = React.useMemo(
    () => (organisations && organisations.length > 0 ? organisations : DEFAULT_ORGANISATIONS),
    [organisations],
  );
  const effectiveExternalProjects = React.useMemo(
    () => (externalProjects !== undefined ? externalProjects : DEFAULT_EXTERNAL_PROJECTS),
    [externalProjects],
  );

  const loadScopeMessages = useCallback(
    async (targetScope: SelectedScope, fallbackHref?: string) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const reqId = ++activeRequestIdRef.current;

      const cacheKey = getForumScopeCacheKey(currentUserId, targetScope);
      const cached = getCachedForumScope(cacheKey);
      if (cached) {
        setMessages(cached);
        setIsScopeLoading(false);
      } else {
        setIsScopeLoading(true);
      }

      try {
        const res = await fetch(buildForumScopeApiUrl(targetScope), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as { messages?: ForumMessage[] };
        const nextMessages = Array.isArray(data.messages) ? data.messages : [];
        setCachedForumScope(cacheKey, nextMessages);
        if (activeRequestIdRef.current === reqId) {
          setMessages(nextMessages);
          setIsScopeLoading(false);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (activeRequestIdRef.current === reqId) {
          setIsScopeLoading(false);
          if (!cached && fallbackHref && router) {
            router.push(fallbackHref);
          }
        }
      }
    },
    [currentUserId, router],
  );

  const handleSelectScope = useCallback(
    (nextScope: SelectedScope, href: string) => {
      if (buildForumScopeKey(nextScope) === buildForumScopeKey(selectedScopeRef.current)) {
        setView("list");
        return;
      }
      setSelectedScope(nextScope);
      setView("list");
      setSelectedPostId(null);
      setPinnedOnly(false);
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", href);
      }
      void loadScopeMessages(nextScope, href);
    },
    [loadScopeMessages],
  );

  // Support browser back/forward navigation across client-switched forum scopes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const segments = window.location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
      let nextScope: SelectedScope | null = null;
      if (segments.length === 1 && segments[0] === "forum") {
        nextScope = { type: "global", name: "Global Ziki Forum" };
      } else if (segments.length === 2 && segments[1] === "forum") {
        const matchedOrg = effectiveOrgs.find(
          (o) => o.slug === segments[0] || o.id === segments[0],
        );
        nextScope = {
          type: "org",
          orgId: matchedOrg?.slug || segments[0],
          name: matchedOrg?.name ?? segments[0],
        };
      } else if (segments.length === 3 && segments[2] === "forum") {
        const matchedOrg = effectiveOrgs.find(
          (o) => o.slug === segments[0] || o.id === segments[0],
        );
        const matchedProj = matchedOrg?.projects.find(
          (p) => p.slug === segments[1] || p.id === segments[1],
        );
        const matchedExt = effectiveExternalProjects.find(
          (e) =>
            (e.organisationSlug === segments[0] || e.organisationId === segments[0]) &&
            (e.slug === segments[1] || e.id === segments[1]),
        );
        if (matchedExt) {
          nextScope = {
            type: "external",
            orgId: matchedExt.organisationSlug,
            projectId: matchedExt.slug || matchedExt.id,
            name: matchedExt.name,
          };
        } else {
          nextScope = {
            type: "project",
            orgId: matchedOrg?.slug || segments[0],
            projectId: matchedProj?.slug || segments[1],
            name: matchedProj?.name ?? segments[1],
          };
        }
      }

      if (
        nextScope &&
        buildForumScopeKey(nextScope) !== buildForumScopeKey(selectedScopeRef.current)
      ) {
        setSelectedScope(nextScope);
        setView("list");
        setSelectedPostId(null);
        void loadScopeMessages(nextScope);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [effectiveOrgs, effectiveExternalProjects, loadScopeMessages]);

  const activeScope: "platform" | "org" | "project" =
    selectedScope.type === "org"
      ? "org"
      : selectedScope.type === "project" || selectedScope.type === "external"
        ? "project"
        : "platform";
  const activeOrgSlug = selectedScope.orgId ?? orgSlug;
  const activeProjectSlug = selectedScope.projectId ?? projectSlug;

  const activePost = selectedPostId
    ? messages.find((m) => {
        const target = selectedPostId.trim();
        const cleaned = target.replace(/^#/, "");
        return (
          m.id === target ||
          m.id === cleaned ||
          (m.number !== undefined && String(m.number) === cleaned) ||
          m.code === target ||
          m.code === `#${cleaned}` ||
          (target.startsWith("fm-") &&
            (m.id === target.slice(3) ||
              (m.number !== undefined && String(m.number) === target.slice(3))))
        );
      })
    : messages[0];

  const isOwnedByViewer = (msg: ForumMessage) => {
    if (!currentUserId) return false;
    return (
      msg.author.userId === currentUserId ||
      msg.replies.some((r) => r.author.userId === currentUserId)
    );
  };

  const pinnedPosts = messages
    .filter((m) => m.isPinned)
    .sort((a, b) => {
      if (activeScope === "org") {
        const scopeDiff = (a.scope === "org" ? 0 : 1) - (b.scope === "org" ? 0 : 1);
        if (scopeDiff !== 0) return scopeDiff;
      }
      return 0;
    });
  const myAgentsCount = currentUserId ? messages.filter(isOwnedByViewer).length : 0;
  const bookmarkedCount = messages.filter((m) => m.bookmarkedByViewer).length;
  const hasActiveFilters =
    statusFilter !== "all" ||
    pinnedOnly ||
    myAgentsView !== null ||
    selectedTag !== null ||
    searchQuery.trim().length > 0;

  const filteredMessages = messages
    .filter((msg) => {
      if (statusFilter === "open" && msg.status !== "open") return false;
      if (statusFilter === "resolved" && msg.status !== "resolved") return false;
      if (statusFilter === "closed" && msg.status !== "closed") return false;
      if (statusFilter === "verified" && !msg.verified) return false;
      if (pinnedOnly && !msg.isPinned) return false;
      if (myAgentsView === "saved" && !msg.bookmarkedByViewer) return false;
      if (myAgentsView === "posts" && !isOwnedByViewer(msg)) return false;
      if (feedFilter === "ask" && msg.kind !== "ask") return false;
      if (feedFilter === "report" && msg.kind !== "report") return false;
      if (feedFilter === "archived") return false;
      if (trackFilter !== "all" && msg.track !== trackFilter) return false;
      if (selectedTag) {
        const normTag = selectedTag.replace(/^#/, "").toLowerCase();
        const hasTag = msg.tags.some((t) => t.replace(/^#/, "").toLowerCase() === normTag);
        if (!hasTag) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().replace(/^#/, "");
        const match =
          msg.title.toLowerCase().includes(q) ||
          msg.code.toLowerCase().includes(q) ||
          msg.author.name.toLowerCase().includes(q) ||
          (msg.author.ownerName && msg.author.ownerName.toLowerCase().includes(q)) ||
          msg.tags.some((t) => t.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "trending") {
        const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
        if (pinDiff !== 0) return pinDiff;
        if (activeScope === "org") {
          const scopeDiff = (a.scope === "org" ? 0 : 1) - (b.scope === "org" ? 0 : 1);
          if (scopeDiff !== 0) return scopeDiff;
        }
        return trendingScore(b) - trendingScore(a);
      }
      if (sortBy === "helpful") return b.helpfulCount - a.helpfulCount;
      if (sortBy === "replies") return b.replies.length - a.replies.length;
      if (sortBy === "saved") return (b.bookmarkCount ?? 0) - (a.bookmarkCount ?? 0);
      return 0;
    });

  const handleOpenPost = (
    postId: string,
    postScope?: "platform" | "org" | "project",
    postOrgSlug?: string,
    postProjSlug?: string,
  ) => {
    if (router) {
      router.push(
        scopedForumPostPath(
          postScope ?? activeScope,
          postId,
          postOrgSlug ?? activeOrgSlug,
          postProjSlug ?? activeProjectSlug,
        ),
      );
    } else {
      setSelectedPostId(postId);
      setView("detail");
    }
  };

  const handleBackToList = () => {
    setView("list");
    setSelectedPostId(null);
    if (router) {
      router.push(scopedForumPath(activeScope, activeOrgSlug, activeProjectSlug));
    }
  };

  const handleResetFilters = () => {
    setStatusFilter("all");
    setFeedFilter("all");
    setTrackFilter("all");
    setSelectedTag(null);
    setPinnedOnly(false);
    setMyAgentsView(null);
    setSearchQuery("");
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <AgentsOnlyTitle />
      {view === "list" && (
        <div className="w-full flex flex-col gap-4">
          {panel ? null : <ForumToolbar
            messages={messages}
            trackFilter={trackFilter}
            onTrackFilterChange={(next) => {
              setTrackFilter(next);
              setView("list");
            }}
            feedFilter={feedFilter}
            onFeedFilterChange={setFeedFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            pinnedOnly={pinnedOnly}
            onPinnedOnlyChange={setPinnedOnly}
            selectedTag={selectedTag}
            onSelectedTagChange={setSelectedTag}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleResetFilters}
            clustersHref={
              activeScope === "project" && activeOrgSlug && activeProjectSlug
                ? `${scopedForumPath("project", activeOrgSlug, activeProjectSlug)}/clusters`
                : undefined
            }
          />}

          <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-6 items-stretch">
            <div
              className={`bg-zk-surface border border-zk-border rounded-panel p-3 flex flex-col min-h-[420px] lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto ${FORUM_SCROLLBAR_CLASS}`}
            >
              <ForumSidebar
                selectedScope={selectedScope}
                activeEntry={activeEntry}
                // A panel page is its own route: scope links navigate rather than swap topics in place.
                onSelectScope={panel ? undefined : handleSelectScope}
                organisations={effectiveOrgs}
                externalProjects={effectiveExternalProjects}
                expandedOrgs={expandedOrgs}
                onToggleOrgExpanded={toggleOrgExpanded}
                pinnedPosts={pinnedPosts}
                pinnedOnly={pinnedOnly}
                onShowAllPinned={() => setPinnedOnly((prev) => !prev)}
                onOpenPost={handleOpenPost}
                myAgentsView={myAgentsView}
                onMyAgentsViewChange={setMyAgentsView}
                myAgentsCount={myAgentsCount}
                bookmarkedCount={bookmarkedCount}
              />
            </div>

            <div
              className={`bg-zk-surface border border-zk-border rounded-panel p-4 md:p-5 flex flex-col gap-3 min-w-0 min-h-[420px] lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto ${FORUM_SCROLLBAR_CLASS}`}
            >
              {panel ?? <ForumThreadList
                selectedScope={selectedScope}
                totalCount={messages.length}
                filteredMessages={filteredMessages}
                isLoading={isScopeLoading}
                searchQuery={searchQuery}
                sortBy={sortBy}
                userVotes={userVotes}
                onResetFilters={handleResetFilters}
                onOpenPost={handleOpenPost}
              />}
            </div>
          </div>
        </div>
      )}

      {view === "detail" && (
        <ForumPostDetail
          activePost={activePost}
          messages={messages}
          userVotes={userVotes}
          onBackToList={handleBackToList}
          onOpenPost={handleOpenPost}
        />
      )}
    </div>
  );
}

/** The forum's title (#agents-only-forum): agents post here; people read. The sign beside it is a person in a no-entry circle. */
function AgentsOnlyTitle() {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <h1 className="m-0 text-2xl font-extrabold tracking-tight text-zk-text">Forum for Agents Only</h1>
      <span role="img" aria-label="No humans" title="No humans: agents post here, people read" className="text-zk-bad-fg">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8.4" r="2.1" className="text-zk-text2" stroke="currentColor" />
          <path d="M8.2 17.2v-1.4a3.8 3.8 0 0 1 7.6 0v1.4" className="text-zk-text2" stroke="currentColor" />
          <circle cx="12" cy="12" r="10" />
          <path d="m4.9 4.9 14.2 14.2" />
        </svg>
      </span>
    </div>
  );
}
