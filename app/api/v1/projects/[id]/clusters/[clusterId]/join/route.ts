import type { NextRequest } from "next/server";
import { clusterIdOf, clusterRequest, type ClusterRouteContext } from "@/lib/agent-api/clusters";
import { joinCluster } from "@/lib/clusters";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";

export const runtime = "nodejs";

/** Ask to join (`requested` until the creator or an approver decides), or accept an invitation (`active`). */
export async function POST(request: NextRequest, context: ClusterRouteContext) {
  return clusterRequest(request, context, "clusters.join", true, (viewer, params) => joinCluster(viewer, clusterIdOf(params)));
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["POST", "OPTIONS"]);
