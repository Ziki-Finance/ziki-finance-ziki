/**
 * "Org With Projects" (slug org-with-projects): an organisation with several
 * projects (Web, Desktop, Mobile), to see how the organisation-wide lists tag
 * each row with its project. The Demo owner (demo@fixtures.local) owns it.
 *
 * Each project has a few issues in different states and a few open ideas.
 * Like the other fixture organisations it touches only its own rows (ids
 * `fx-op-*`) and a rerun recreates it.
 */
import type { PrismaClient, Status, Substatus } from "@prisma/client";

const MINUTE = 60_000;
const ORGANISATION_ID = "fx-op-organisation";
const SLUG = "org-with-projects";
const NAME = "Org With Projects";

type IssueSpec = { title: string; summary: string; status: Status; substatus: Substatus };
type ProjectSpec = { key: string; slug: string; name: string; issues: IssueSpec[]; ideas: { title: string; summary: string }[] };

const PROJECTS: ProjectSpec[] = [
  {
    key: "web",
    slug: "web",
    name: "Web",
    issues: [
      { title: "[Bug] Sign-in page loops after the session expires", summary: "An expired session sends the browser back and forth between sign-in and the dashboard.", status: "open", substatus: "requires_confirmation" },
      { title: "[Feature] Remember the last opened tab", summary: "The issue list should reopen on the tab you were on.", status: "open", substatus: "open" },
      { title: "[Bug] Search box loses focus while typing", summary: "Results refresh and steal focus from the search box.", status: "done", substatus: "requires_review" },
      { title: "[Improvement] Faster first load on the dashboard", summary: "The dashboard takes four seconds to show anything.", status: "resolved", substatus: "on_dev" },
    ],
    ideas: [
      { title: "Show unread comments on each issue row", summary: "A small dot on rows with comments you haven't read." },
      { title: "Let people pin projects to the top of the sidebar", summary: "Pinned projects stay above the rest." },
    ],
  },
  {
    key: "desktop",
    slug: "desktop",
    name: "Desktop",
    issues: [
      { title: "[Bug] Windows: login fails on clean PCs without the root certificate", summary: "The API's root certificate is missing on fresh Windows installs, so sign-in fails.", status: "open", substatus: "requires_confirmation" },
      { title: "[Bug] macOS: window forgets its size on restart", summary: "The app always opens at the default size.", status: "open", substatus: "open" },
      { title: "[Feature] Tray icon with unread count", summary: "Show how many notifications are waiting in the system tray.", status: "done", substatus: "requires_review" },
      { title: "[Bug] Auto-update downloads the same version twice", summary: "The updater fetches the installer again after installing it.", status: "resolved", substatus: "on_staging" },
    ],
    ideas: [
      { title: "Windows: login fails on clean PCs because the API's root certificate is missing", summary: "Bundle the certificate chain with the installer." },
      { title: "Login and API errors should say what actually went wrong", summary: "Show the real reason instead of a generic failure." },
    ],
  },
  {
    key: "mobile",
    slug: "mobile",
    name: "Mobile",
    issues: [
      { title: "[Bug] Android: back button closes the app from the issue page", summary: "Back should return to the list, not exit.", status: "open", substatus: "requires_confirmation" },
      { title: "[Feature] Pull to refresh on the Work Feed", summary: "Pulling down on the feed should reload it.", status: "open", substatus: "open" },
      { title: "[Bug] iOS: keyboard covers the comment box", summary: "The comment field is hidden behind the keyboard.", status: "done", substatus: "requires_review" },
    ],
    ideas: [{ title: "Push notifications for offers to accept", summary: "Tell people on their phone when their agent gets an offer." }],
  },
];

export async function loadProjectsOrganisation(db: PrismaClient, ownerId: string, now: number): Promise<void> {
  const existing = await db.organisation.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (existing && existing.id !== ORGANISATION_ID) throw new Error(`A "${SLUG}" organisation exists that the fixtures didn't make; not touching it.`);
  if (existing) {
    // Issues and ideas restrict deleting the organisation; everything else cascades.
    await db.bug.deleteMany({ where: { organisationId: ORGANISATION_ID } });
    await db.idea.deleteMany({ where: { organisationId: ORGANISATION_ID } });
    await db.organisation.delete({ where: { id: ORGANISATION_ID } });
  }

  await db.organisation.create({
    data: {
      id: ORGANISATION_ID,
      slug: SLUG,
      name: NAME,
      description: "Local fixtures: one organisation with several projects (scripts/dev/fixtures/projects-organisation.ts).",
      nextNumber: 1,
      memberships: { create: { userId: ownerId, role: "owner" } },
      projects: { create: PROJECTS.map((p) => ({ id: `fx-op-${p.key}-project`, slug: p.slug, name: p.name, workflow: { create: {} } })) },
    },
  });

  // Interleave the projects so the newest-first lists mix them. In number order: triggers number issues and ideas.
  const issues = PROJECTS.flatMap((p) => p.issues.map((issue, i) => ({ p, issue, i })));
  issues.sort((a, b) => a.i - b.i);
  for (const [index, { p, issue }] of issues.entries()) {
    const bugId = `fx-op-${p.key}-bug-${index + 1}`;
    await db.bug.create({
      data: {
        id: bugId,
        organisationId: ORGANISATION_ID,
        projectId: `fx-op-${p.key}-project`,
        title: issue.title,
        summary: issue.summary,
        description: `## Summary\n\n${issue.summary}\n`,
        status: issue.status,
        substatus: issue.substatus,
        reporterId: ownerId,
        beneficiaryUserId: ownerId,
        createdAt: new Date(now - (issues.length - index) * 90 * MINUTE),
      },
    });
  }

  const ideas = PROJECTS.flatMap((p) => p.ideas.map((idea, i) => ({ p, idea, i })));
  ideas.sort((a, b) => a.i - b.i);
  for (const [index, { p, idea }] of ideas.entries()) {
    await db.idea.create({
      data: {
        id: `fx-op-${p.key}-idea-${index + 1}`,
        organisationId: ORGANISATION_ID,
        projectId: `fx-op-${p.key}-project`,
        title: idea.title,
        summary: idea.summary,
        description: `## Summary\n\n${idea.summary}\n`,
        reporterId: ownerId,
        beneficiaryUserId: ownerId,
        createdAt: new Date(now - (ideas.length - index) * 45 * MINUTE),
      },
    });
  }
}
