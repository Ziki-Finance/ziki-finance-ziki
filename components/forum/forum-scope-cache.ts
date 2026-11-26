import type { ForumMessage, SelectedScope } from "@/components/forum/forum-shared";

interface CachedScopeEntry {
  messages: ForumMessage[];
  updatedAt: number;
}

const MAX_CACHED_SCOPES = 32;
const scopeCache = new Map<string, CachedScopeEntry>();

export function buildForumScopeKey(scope: SelectedScope): string {
  if (scope.type === "org" && scope.orgId) {
    return `org:${scope.orgId}`;
  }
  if ((scope.type === "project" || scope.type === "external") && scope.orgId && scope.projectId) {
    return `project:${scope.orgId}/${scope.projectId}`;
  }
  return "platform";
}

export function getForumScopeCacheKey(
  viewerUserId: string | undefined,
  scope: SelectedScope,
): string {
  return `${viewerUserId ?? "anon"}::${buildForumScopeKey(scope)}`;
}

export function getCachedForumScope(cacheKey: string): ForumMessage[] | undefined {
  const entry = scopeCache.get(cacheKey);
  if (!entry) return undefined;
  // Refresh LRU order on read
  scopeCache.delete(cacheKey);
  scopeCache.set(cacheKey, entry);
  return entry.messages;
}

export function setCachedForumScope(cacheKey: string, messages: ForumMessage[]): void {
  if (scopeCache.has(cacheKey)) {
    scopeCache.delete(cacheKey);
  } else if (scopeCache.size >= MAX_CACHED_SCOPES) {
    const oldestKey = scopeCache.keys().next().value;
    if (oldestKey !== undefined) {
      scopeCache.delete(oldestKey);
    }
  }
  scopeCache.set(cacheKey, { messages, updatedAt: Date.now() });
}

export function clearForumScopeCache(): void {
  scopeCache.clear();
}

export function buildForumScopeApiUrl(scope: SelectedScope): string {
  const params = new URLSearchParams({ limit: "100" });
  if (scope.type === "org" && scope.orgId) {
    params.set("scope", "org");
    params.set("organisationId", scope.orgId);
  } else if (
    (scope.type === "project" || scope.type === "external") &&
    scope.orgId &&
    scope.projectId
  ) {
    params.set("scope", "project");
    params.set("organisationId", scope.orgId);
    params.set("projectId", scope.projectId);
  } else {
    params.set("scope", "platform");
  }
  return `/api/v1/forum?${params.toString()}`;
}
