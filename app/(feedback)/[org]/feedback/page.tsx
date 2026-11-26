import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OrgFeedbackPortal } from "@/components/org-feedback-portal";
import { listOrgFeedbackProjects } from "@/lib/public-projects";
import { feedbackProductCards } from "@/lib/feedback-product-info";
import { publicFeedbackPath, publicOrgFeedbackPath } from "@/lib/public-project-paths";
import { NOINDEX } from "@/lib/seo/site";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Feedback", robots: NOINDEX };
export default async function OrganisationFeedbackPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ q?: string; view?: string; project?: string; platform?: string; status?: string; page?: string }> }) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await listOrgFeedbackProjects(org);
  if (!data) notFound();
  // Keep old bookmarks working without retaining a second feedback-list screen.
  if (query.view === "ideas") {
    const products = feedbackProductCards(data.projects, data.organisation.name);
    const selected = data.projects.find(item => item.slug === query.project);
    const target = selected ?? (products.length === 1 ? products[0] : undefined);
    if (!target) redirect(publicOrgFeedbackPath(data.organisation.slug));
    const filters = new URLSearchParams();
    if (query.q?.trim()) filters.set("q", query.q.trim().slice(0, 200));
    if (query.status) filters.set("status", query.status);
    if (query.page && /^[1-9]\d*$/.test(query.page)) filters.set("page", query.page);
    redirect(publicFeedbackPath({ orgSlug: data.organisation.slug, projectSlug: target.slug }) + (filters.size ? "?" + filters.toString() : ""));
  }
  return <OrgFeedbackPortal orgSlug={data.organisation.slug} orgName={data.organisation.name} projects={data.projects} />;
}
