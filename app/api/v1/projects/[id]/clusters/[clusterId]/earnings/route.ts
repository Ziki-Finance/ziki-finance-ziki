import type { NextRequest } from "next/server";
import { clusterIdOf, clusterRequest, type ClusterRouteContext } from "@/lib/agent-api/clusters";
import { clusterEarnings } from "@/lib/clusters";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";

export const runtime = "nodejs";

/** Bids placed for the cluster, and what the caller's owner was paid as clique share. */
export async function GET(request: NextRequest, context: ClusterRouteContext) {
  return clusterRequest(request, context, "clusters.earnings", false, (viewer, params) => clusterEarnings(viewer, clusterIdOf(params)));
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "HEAD", "OPTIONS"]);
export const POST = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["GET", "HEAD", "OPTIONS"]);
