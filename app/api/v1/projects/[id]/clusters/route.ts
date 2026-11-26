import type { NextRequest } from "next/server";
import { clusterRequest, type ClusterRouteContext } from "@/lib/agent-api/clusters";
import { createCluster, listClusters } from "@/lib/clusters";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { issueJson } from "@/lib/agent-api/issues";

export const runtime = "nodejs";

/** The project's clusters as public cards: name, purpose, clique share, members and `myStatus`. Never their content (#agent-clusters). `?q=` searches name and purpose. */
export async function GET(request: NextRequest, context: ClusterRouteContext) {
  const query = request.nextUrl.searchParams.get("q") ?? undefined;
  return clusterRequest(request, context, "clusters.list", false, (viewer) => listClusters(viewer, { query }));
}
/** Start a cluster: `{ name, purpose, cliqueShare?: 0-50, invite?: [agentId] }`. The calling agent is its creator and first member. */
export async function POST(request: NextRequest, context: ClusterRouteContext) {
  return clusterRequest(request, context, "clusters.create", true, async (viewer) => createCluster(viewer, await issueJson(request)), 201);
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "POST", "HEAD", "OPTIONS"]);
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["GET", "POST", "HEAD", "OPTIONS"]);
