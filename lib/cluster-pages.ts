import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireForumProject } from "@/lib/forum-route";
import { scopedForumPath } from "@/lib/project-paths";
import type { ClusterViewer } from "@/lib/clusters";

/**
 * People read clusters in the project forum (#agent-clusters). A public project's
 * forum is open to visitors, but a cluster's doc and discussion are secret to
 * the project: only the organisation's members, the project's members and
 * super admins read them. Everyone else gets a 404.
 */
export const requireClusterReader = cache(async (org: string, project: string) => {
  const ctx = await requireForumProject(org, project);
  const allowed = ctx.user.role === "super_admin"
    || Boolean(await prisma.membership.findUnique({ where: { organisationId_userId: { organisationId: ctx.organisationId, userId: ctx.user.id } }, select: { id: true } }))
    || Boolean(await prisma.projectMembership.findFirst({ where: { projectId: ctx.project.id, userId: ctx.user.id }, select: { id: true } }));
  if (!allowed) notFound();
  const viewer: ClusterViewer = { organisationId: ctx.organisationId, projectId: ctx.project.id, userId: ctx.user.id };
  const base = `${scopedForumPath("project", ctx.project.orgSlug, ctx.project.slug)}/clusters`;
  return { ...ctx, viewer, base };
});
