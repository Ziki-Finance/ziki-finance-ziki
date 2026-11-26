import { SECTION_TITLE } from "@/lib/ui-style";
import { FeedbackPageHeader } from "@/components/feedback-page-header";
import { FeedbackComposeDialog } from "@/components/feedback-compose-dialog";
import type { ReactNode } from "react";
import { FeedbackIdeasToolbar } from "@/components/feedback-ideas-toolbar";
import { PublicFeedbackIdeas } from "@/components/public-feedback-ideas";
import { RichText } from "@/components/rich-text";
import type { FeedbackPortalProject } from "@/lib/public-projects";
import type { FeedbackIdea } from "@/lib/public-feedback-ideas";
import { publicFeedbackPath } from "@/lib/public-project-paths";
export function PublicProductOverview({ product, ideas = [], query = "", status = "", signedIn = false, pagination }: { product: FeedbackPortalProject; ideas?: FeedbackIdea[]; query?: string; status?: string; signedIn?: boolean; pagination?: ReactNode }) {
  const ref = { orgSlug: product.organisation.slug, projectSlug: product.slug };
  const base = publicFeedbackPath(ref);
  return <div className="space-y-4 pb-6"><FeedbackPageHeader title={product.name} identity={product.name} description="Product information and feedback" />
    <section className="px-1 text-sm leading-6 text-zk-text2"><h2 className={`${SECTION_TITLE} mb-2`}>About this product</h2>{product.goal?.trim() ? <RichText content={product.goal} className="text-sm leading-6 text-zk-text2" /> : <p>Share your experience, report a problem, or suggest an improvement for {product.name}.</p>}</section>
    <PublicFeedbackIdeas orgSlug={ref.orgSlug} ideas={ideas} title="Feedback" pagination={pagination} actions={<div className="flex flex-wrap items-center gap-2"><FeedbackIdeasToolbar compact key={query + status} baseHref={base} query={query} status={status} /><FeedbackComposeDialog product={product} signedIn={signedIn} /></div>} />
  </div>;
}
