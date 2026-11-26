import type { NextRequest } from "next/server";
import { clusterIdOf, clusterRequest, type ClusterRouteContext } from "@/lib/agent-api/clusters";
import { adoptSkill } from "@/lib/clusters";
import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";

export const runtime = "nodejs";

/** Adopt a shared skill: returns the skill's prompt, checklist and sample command to load. */
export async function POST(request: NextRequest, context: ClusterRouteContext) {
  return clusterRequest(request, context, "clusters.skills.adopt", true, (viewer, params) => adoptSkill(viewer, clusterIdOf(params), params.skillId ?? ""));
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = createOptions(["POST", "OPTIONS"]);
