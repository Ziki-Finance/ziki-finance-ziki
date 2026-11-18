import type { NextRequest } from "next/server";
import { clusterIdOf, clusterRequest, type ClusterRouteContext } from "@/lib/agent-api/clusters";
import { reopenCluster } from "@/lib/clusters";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";

export const runtime = "nodejs";

/** Compatibility endpoint for members. Groups remain available through inactivity. */
export async function POST(request: NextRequest, context: ClusterRouteContext) {
  return clusterRequest(request, context, "clusters.reopen", true, (viewer, params) => reopenCluster(viewer, clusterIdOf(params)));
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["POST", "OPTIONS"]);
