import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/agents/audit";
import { hasLevel } from "@/lib/agents/levels";
import { IssueApiError } from "@/lib/agent-api/errors";
import { invalidateWorkflow } from "@/lib/workflow";
import {
  canonicalGitHubRepoUrl,
  PROJECT_EXTRA_REPOSITORIES_MAX,
  projectRepositorySchema,
  projectSettingsSchema,
} from "@/app/(app)/projects/validation";
import type { AgentLevel } from "@prisma/client";

/**
 * A manager or merger agent changes a project's settings for its owner (#agent-project-settings),
 * `PATCH /api/v1/projects/{id}`: the main repository, the other repositories it lists, its name, goal, staging
 * and live site addresses, and its contributor and human approval guidelines, with the same rules as Project
 * Settings on the website. Visibility, rewards, budget and the workflow gates stay with the organisation's owners
 * and admins. Each change is recorded in the project's audit log as the agent's owner's, and in the agent's.
 */

const settings = projectSettingsSchema.pick({ name: true, goal: true, repoUrl: true, stagingUrl: true, siteUrl: true, contributorGuidelines: true, humanApprovalGuidelines: true });
const repositoryInput = z.object({ url: z.string(), label: z.string().optional().default(""), branch: z.string().optional().default("") });

export const projectSettingsPatchSchema = z
  .object({
    name: z.string().optional(),
    goal: z.string().optional(),
    repoUrl: z.string().optional(),
    stagingUrl: z.string().optional(),
    siteUrl: z.string().optional(),
    contributorGuidelines: z.string().optional(),
    humanApprovalGuidelines: z.string().optional(),
    addRepositories: z.array(repositoryInput).max(PROJECT_EXTRA_REPOSITORIES_MAX).optional(),
    removeRepositories: z.array(z.string().trim().min(1)).max(PROJECT_EXTRA_REPOSITORIES_MAX).optional(),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();

const FIELDS = ["name", "goal", "repoUrl", "stagingUrl", "siteUrl", "contributorGuidelines", "humanApprovalGuidelines"] as const;

function refuse(status: number, error: string, message: string): never {
  throw new IssueApiError(status, message, { error, message });
}

function canonical(url: string | null): string | null {
  if (!url) return null;
  try {
    return canonicalGitHubRepoUrl(url);
  } catch {
    return null;
  }
}

export async function agentUpdateProjectSettings(
  agent: { agentId: string; ownerId: string; organisationId: string; level: AgentLevel },
  projectId: string,
  raw: unknown,
): Promise<{ projectId: string; changed: string[] }> {
  if (!hasLevel(agent.level, "manager")) refuse(403, "insufficient_level", "Only a manager or merger agent can change project settings.");
  const body = projectSettingsPatchSchema.safeParse(raw);
  if (!body.success) {
    refuse(400, "invalid_body", `Send any of ${FIELDS.join(", ")}, addRepositories and removeRepositories, with a reason. ${body.error.issues[0]?.message ?? ""}`.trim());
  }
  const { reason, addRepositories = [], removeRepositories = [], ...given } = body.data;

  const project = await prisma.project.findFirst({
    where: { id: projectId, organisationId: agent.organisationId },
    select: { id: true, name: true, goal: true, repoUrl: true, stagingUrl: true, siteUrl: true, contributorGuidelines: true, humanApprovalGuidelines: true, repositories: { select: { id: true, url: true, label: true, branch: true } } },
  });
  if (!project) refuse(404, "not_found", "Project not found.");

  // Each field given is checked as the settings form checks it; fields left out stay as they are.
  const parsed = settings.partial().safeParse(given);
  if (!parsed.success) refuse(422, "invalid_settings", parsed.error.issues[0]?.message ?? "Check the project settings.");
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const data: Prisma.ProjectUpdateInput = {};
  for (const field of FIELDS) {
    const value = parsed.data[field];
    if (value === undefined || (project[field] ?? null) === (value ?? null)) continue;
    changes[field] = { from: project[field] ?? null, to: value ?? null };
    (data as Record<string, unknown>)[field] = value ?? null;
  }

  const mainRepo = canonical((data.repoUrl as string | null | undefined) === undefined ? project.repoUrl : (data.repoUrl as string | null));
  const toAdd: z.infer<typeof projectRepositorySchema>[] = [];
  for (const repository of addRepositories) {
    const checked = projectRepositorySchema.safeParse(repository);
    if (!checked.success) refuse(422, "invalid_repository", checked.error.issues[0]?.message ?? "Check the repository details.");
    if (checked.data.url === mainRepo) continue;
    if (project.repositories.some((r) => r.url.toLowerCase() === checked.data.url)) continue;
    if (toAdd.some((r) => r.url === checked.data.url)) continue;
    toAdd.push(checked.data);
  }
  const toRemove = removeRepositories.map((url) => {
    const want = canonical(url) ?? url.toLowerCase();
    const listed = project.repositories.find((r) => r.url.toLowerCase() === want);
    if (!listed) refuse(404, "repository_not_listed", `${url} is not one of the project's other repositories.`);
    return listed;
  });
  if (project.repositories.length - toRemove.length + toAdd.length > PROJECT_EXTRA_REPOSITORIES_MAX) {
    refuse(422, "too_many_repositories", `A project can list at most ${PROJECT_EXTRA_REPOSITORIES_MAX} more repositories.`);
  }
  // As on the website: an open issue whose fix is in a repository keeps the repository listed until that work is done.
  for (const repository of toRemove) {
    const linked = await prisma.bug.count({
      where: { projectId: project.id, isDeleted: false, status: { notIn: ["resolved", "closed"] }, pullRequestUrl: { startsWith: `${repository.url}/pull/`, mode: "insensitive" } },
    });
    if (linked > 0) refuse(409, "repository_in_use", `${linked} open issue(s) link pull requests in ${repository.url}. Remove it once they are done.`);
  }

  const changed = [...Object.keys(changes), ...(toAdd.length ? ["repositories.added"] : []), ...(toRemove.length ? ["repositories.removed"] : [])];
  if (changed.length === 0) return { projectId: project.id, changed: [] };

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.project.update({ where: { id: project.id }, data });
      await tx.projectAuditEvent.create({
        data: { organisationId: agent.organisationId, projectId: project.id, actorUserId: agent.ownerId, action: "settings.updated", changes: { ...changes, byAgent: { from: null, to: agent.agentId }, reason: { from: null, to: reason } } as Prisma.InputJsonValue },
      });
    }
    for (const repository of toAdd) {
      const created = await tx.projectRepository.create({ data: { projectId: project.id, ...repository }, select: { id: true } });
      await tx.projectAuditEvent.create({
        data: { organisationId: agent.organisationId, projectId: project.id, actorUserId: agent.ownerId, action: "repository.added", changes: { repository: { from: null, to: { id: created.id, ...repository } }, byAgent: { from: null, to: agent.agentId } } },
      });
    }
    for (const repository of toRemove) {
      await tx.projectRepository.delete({ where: { id: repository.id } });
      await tx.projectAuditEvent.create({
        data: { organisationId: agent.organisationId, projectId: project.id, actorUserId: agent.ownerId, action: "repository.removed", changes: { repository: { from: repository, to: null }, byAgent: { from: null, to: agent.agentId } } },
      });
    }
  });
  invalidateWorkflow(project.id);
  await audit({ agentId: agent.agentId, organisationId: agent.organisationId }, "project.settings_updated", `project:${project.id}`, { changed, reason });
  return { projectId: project.id, changed };
}
