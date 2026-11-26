import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  organisation: { findFirst: vi.fn() },
  project: { findFirst: vi.fn() },
  membership: { findUnique: vi.fn() },
  projectMembership: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  createForumMessage,
  listForumMessages,
  resolveReadableForumScope,
} from "@/lib/forum";

describe("Forum Org Rollup & API Read Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organisation.findFirst.mockResolvedValue({ id: "org-1" });
    mockPrisma.membership.findUnique.mockResolvedValue(null);
    mockPrisma.projectMembership.findUnique.mockResolvedValue(null);
  });

  it("rolls up org and project posts under scope='org' with org-level posts ordered first", async () => {
    mockPrisma.membership.findUnique.mockResolvedValue({ id: "mem-1" });
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "proj-1",
      organisationId: "org-1",
      visibility: "private",
    });

    const projectPost = await createForumMessage(
      {
        name: "Project Agent",
        handle: "proj-1",
        isAgent: true,
        role: "Agent Worker",
        userId: "user-org-member",
        agentId: "agent-1",
      },
      {
        title: "Project Web build cache tip",
        content: "Cache turbo output.",
        category: "announcement",
        kind: "report",
        track: "product",
        scope: "project",
        organisationId: "org-1",
        projectId: "proj-1",
      }
    );

    const orgPost = await createForumMessage(
      {
        name: "Org Agent",
        handle: "org-1",
        isAgent: true,
        role: "Agent Worker",
        userId: "user-org-member",
        agentId: "agent-1",
      },
      {
        title: "Org-wide Node 22 upgrade policy",
        content: "All projects must use Node 22.",
        category: "announcement",
        kind: "report",
        track: "product",
        scope: "org",
        organisationId: "org-1",
      }
    );

    const rollup = await listForumMessages({
      scope: "org",
      organisationId: "org-1",
      sort: "trending",
    });

    const ids = rollup.map((m) => m.id);
    expect(ids).toContain(orgPost.id);
    expect(ids).toContain(projectPost.id);
    expect(ids.indexOf(orgPost.id)).toBeLessThan(ids.indexOf(projectPost.id));
  });

  it("enforces org membership for scope='org' and blocks external project-only contributors", async () => {
    // Unauthenticated outsider is rejected with Unauthorized
    await expect(
      resolveReadableForumScope({
        scope: "org",
        organisationId: "org-1",
      })
    ).rejects.toThrow(/Unauthorized:/i);

    // Project-only contributor (has ProjectMembership but no org Membership) is rejected with Forbidden
    mockPrisma.membership.findUnique.mockResolvedValue(null);
    mockPrisma.projectMembership.findUnique.mockResolvedValue({ id: "pm-1" });
    await expect(
      resolveReadableForumScope({
        scope: "org",
        organisationId: "org-1",
        actorUserId: "external-user",
      })
    ).rejects.toThrow(/Forbidden:/i);

    // Org member is allowed
    mockPrisma.membership.findUnique.mockResolvedValue({ id: "mem-1" });
    const allowed = await resolveReadableForumScope({
      scope: "org",
      organisationId: "org-1",
      actorUserId: "org-member",
    });
    expect(allowed).toEqual({ scope: "org", organisationId: "org-1" });
  });

  it("allows read-only outsider access on public projects while protecting private projects", async () => {
    // Public project is readable by unauthenticated outsiders
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "proj-pub",
      organisationId: "org-1",
      visibility: "public",
    });
    const pubRes = await resolveReadableForumScope({
      scope: "project",
      projectId: "proj-pub",
    });
    expect(pubRes).toEqual({
      scope: "project",
      organisationId: "org-1",
      projectId: "proj-pub",
    });

    // Private project rejects unauthenticated outsider
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "proj-priv",
      organisationId: "org-1",
      visibility: "private",
    });
    await expect(
      resolveReadableForumScope({
        scope: "project",
        projectId: "proj-priv",
      })
    ).rejects.toThrow(/Unauthorized:/i);

    // Private project rejects non-member user
    await expect(
      resolveReadableForumScope({
        scope: "project",
        projectId: "proj-priv",
        actorUserId: "outsider-user",
      })
    ).rejects.toThrow(/Forbidden:/i);

    // Private project allows direct ProjectMembership contributor
    mockPrisma.projectMembership.findUnique.mockResolvedValue({ id: "pm-1" });
    const memberRes = await resolveReadableForumScope({
      scope: "project",
      projectId: "proj-priv",
      actorUserId: "external-contributor",
    });
    expect(memberRes).toEqual({
      scope: "project",
      organisationId: "org-1",
      projectId: "proj-priv",
    });
  });
});
