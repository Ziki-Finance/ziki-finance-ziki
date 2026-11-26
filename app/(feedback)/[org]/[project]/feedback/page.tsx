import { PaginationControls } from "@/components/pagination-controls";
import { FeedbackProjectJoin } from "@/components/feedback-project-join";
import { optionalUser } from "@/lib/auth-helpers";
import { countPublicFeedbackIdeas, listPublicFeedbackIdeas } from "@/lib/public-feedback-ideas";
import type { FeedbackSearch } from "@/components/project-feedback-portal";
import { PublicProductOverview } from "@/components/public-product-overview";
import { PublicFeedbackIdeaDetail } from "@/components/public-feedback-idea-detail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findFeedbackProject } from "@/lib/public-projects";
import { publicFeedbackPath } from "@/lib/public-project-paths";
import { PublicContributorForm } from "@/components/public-contributor-form";
import { NOINDEX } from "@/lib/seo/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Share feedback", robots: NOINDEX };

export default async function ProjectFeedbackPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; project: string }>;
  searchParams: Promise<FeedbackSearch & { type?: string; idea?: string; view?: string; page?: string }>;
}) {
  const [{ org, project: projectSlug }, query] = await Promise.all([params, searchParams]);
  const ref = { orgSlug: org, projectSlug };
  const project = await findFeedbackProject(ref);
  if (!project) notFound();

  if (query.view === "join") return <FeedbackProjectJoin orgSlug={org} projectSlug={projectSlug} />;
  if (query.idea !== undefined) return <PublicFeedbackIdeaDetail project={ref} number={Number(query.idea)} />;
  if (query.view !== "share" && query.type !== "problem" && query.type !== "improvement") {
    const options = { projectSlug, query: query.q?.trim().slice(0, 200), status: query.status };
    const total = await countPublicFeedbackIdeas(org, options);
    const totalPages = Math.max(1, Math.ceil(total / 30));
    const requestedPage = Number(query.page);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
    const ideas = await listPublicFeedbackIdeas(org, { ...options, skip: (page - 1) * 30, take: 30 });
    const user = await optionalUser();
    const pagination = <div className="pt-4"><PaginationControls page={page} totalPages={totalPages} totalCount={total} from={total ? (page - 1) * 30 + 1 : 0} to={Math.min(page * 30, total)} basePath={publicFeedbackPath(ref)} queryParams={{ q: options.query, status: query.status }} itemLabel="feedback item" /></div>;
    return <PublicProductOverview product={project} ideas={ideas} query={query.q} status={query.status} signedIn={Boolean(user)} pagination={pagination} />;
  }
  const orgFeedbackHref = publicFeedbackPath(ref);

  return (
    <div className="w-full pb-6">
      <PublicContributorForm
        project={project}
        orgSlug={project.organisation.slug}
        projectSlug={project.slug}
        kind={query.type === "problem" || query.type === "improvement" ? query.type : undefined}
        returnHref={orgFeedbackHref}
      />
    </div>
  );
}
