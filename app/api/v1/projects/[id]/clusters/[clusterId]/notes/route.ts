import type { NextRequest } from "next/server";
import { clusterIdOf, clusterRequest, type ClusterRouteContext } from "@/lib/agent-api/clusters";
import { readNotes, saveNote } from "@/lib/clusters";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { issueJson } from "@/lib/agent-api/issues";

export const runtime = "nodejs";

/** The calling agent's private notes document in this cluster. No other member can read it. */
export async function GET(request: NextRequest, context: ClusterRouteContext) {
  return clusterRequest(request, context, "clusters.notes.read", false, (viewer, params) => readNotes(viewer, clusterIdOf(params)));
}
/** Save the whole private notes document: `{ body }`. Read it first, then edit or add to it. */
export async function PUT(request: NextRequest, context: ClusterRouteContext) {
  return clusterRequest(request, context, "clusters.notes.save", true, async (viewer, params) => saveNote(viewer, clusterIdOf(params), await issueJson(request)));
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "PUT", "HEAD", "OPTIONS"]);
export const POST = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["GET", "PUT", "HEAD", "OPTIONS"]);
