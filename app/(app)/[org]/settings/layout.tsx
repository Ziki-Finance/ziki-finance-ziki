import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/project-route";
import { loadOrg } from "./org-context";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/organisations";
import { Badge } from "@/components/ui/badge";
import { SettingsNav } from "@/components/settings-nav";
import { prisma } from "@/lib/prisma";
import "@/app/(app)/settings/settings-design.css";

/**
 * The organisation's settings (/<org>/settings, #org-settings): everything an organisation's owners and admins
 * manage, each in one place. They belong to the organisation, so no project is in the address. It always shows the organisation this
 * device is working in. A project's outside contributors don't get it. Every member can open it; only owners and admins (and
 * the site super admin) see controls. Site-wide staff pages stay under /superadmin.
 */
export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org: orgParam } = await params;
  // The address picks the organisation, checks access and makes it current (lib/project-route.ts).
  const { organisation } = await requireOrg(orgParam);
  if (!organisation) notFound();
  const { org } = await loadOrg();

  if (!org || org.id !== organisation.id) {
    notFound();
  }

  const pendingJoinCount = org.admin
    ? await prisma.projectJoinRequest.count({
        where: { project: { organisationId: org.id }, status: "pending" },
      })
    : 0;

  return (
    <div className="settings-page mx-auto max-w-5xl space-y-6">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.06em] text-zk-muted">Organisation</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate text-2xl font-extrabold tracking-tight text-zk-text">{org.name}</h1>
            <Badge className="rounded-full bg-zk-chip text-zk-text2">
              <span className="sr-only">Your role: </span>
              {MEMBERSHIP_ROLE_LABELS[org.role]}
            </Badge>
          </div>
          <p className="text-sm text-zk-text2">
            <span className="font-mono">{org.slug}</span>
            {" · "}
            <Link href="/organisations" className="font-medium text-zk-accent hover:underline">
              Switch organisation
            </Link>
          </p>
        </div>
      </div>
      {/* One Settings area: your settings and the organisation's share this sidebar (components/settings-nav.tsx). */}
      <div className="settings-layout">
        <Suspense fallback={<nav aria-label="Settings sections" className="settings-navigation" />}>
          <SettingsNav orgRef={org.slug} pendingJoinCount={pendingJoinCount} owner={org.owner} />
        </Suspense>
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
