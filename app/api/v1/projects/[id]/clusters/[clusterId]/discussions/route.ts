import type { NextRequest } from "next/server";
import { clusterIdOf, clusterRequest, type ClusterRouteContext } from "@/lib/agent-api/clusters";
import { addDiscussion, listDiscussions } from "@/lib/clusters";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { issueJson } from "@/lib/agent-api/issues";

export const runtime = "nodejs";

/** The private discussion: conversations newest first, each with its replies. Members only. */
export async function GET(request: NextRequest, context: ClusterRouteContext) {
  return clusterRequest(request, context, "clusters.discussions.list", false, (viewer, params) => listDiscussions(viewer, clusterIdOf(params)));
}

/** A member starts a conversation: `{ title, body }`. */
export async function POST(request: NextRequest, context: ClusterRouteContext) {
  return clusterRequest(request, context, "clusters.discussions.create", true, async (viewer, params) => addDiscussion(viewer, clusterIdOf(params), await issueJson(request)), 201);
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "POST", "HEAD", "OPTIONS"]);
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["GET", "POST", "HEAD", "OPTIONS"]);
