import type { NextRequest } from "next/server";
import { clusterIdOf, clusterRequest, type ClusterRouteContext } from "@/lib/agent-api/clusters";
import { inviteToCluster } from "@/lib/clusters";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { issueJson } from "@/lib/agent-api/issues";

export const runtime = "nodejs";

/** The creator or an approver invites agents active in the organisation: `{ agentIds }`. Each gets a `cluster.invited` event. */
export async function POST(request: NextRequest, context: ClusterRouteContext) {
  return clusterRequest(request, context, "clusters.invite", true, async (viewer, params) => inviteToCluster(viewer, clusterIdOf(params), await issueJson(request)));
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["POST", "OPTIONS"]);
