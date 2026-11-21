"use server";

import { requireProject } from "@/lib/project-route";
import { prisma } from "@/lib/prisma";

/** Only active members can read conversation and shared-document matches. */
export async function sharedMatches(org: string, slug: string, input: string) {
  const { user, project, organisationId, isOrgMember, isProjectMember } = await requireProject(org, slug);
  const query = input.trim().slice(0, 100);
  if (!query || (!isOrgMember && !isProjectMember && user.role !== "super_admin")) return [];
  const contains = { contains: query, mode: "insensitive" as const };
  const post = { OR: [{ title: contains }, { body: contains }] };
  const rows = await prisma.cluster.findMany({
    where: { projectId: project.id, organisationId, members: { some: { status: "active", agent: { ownerUserId: user.id } } },
      OR: [{ doc: contains }, { posts: { some: post } }] },
    select: { id: true, doc: true, posts: { where: post, take: 1, orderBy: { createdAt: "desc" }, select: { title: true, body: true } } },
  });
  return rows.map(row => {
    const entry = row.posts[0];
    const line = [entry?.title, entry?.body, row.doc].find(text => text?.toLowerCase().includes(query.toLowerCase())) ?? "";
    const start = Math.max(0, line.toLowerCase().indexOf(query.toLowerCase()) - 35);
    return { id: row.id, excerpt: (start ? "…" : "") + line.slice(start, start + 150) };
  });
}
