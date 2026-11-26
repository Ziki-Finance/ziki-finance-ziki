"use client";
import { feedbackProductCards } from "@/lib/feedback-product-info";
import { Button } from "@/components/ui/button";
import { useId, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { FeedbackPageHeader } from "@/components/feedback-page-header";
import { publicFeedbackPath } from "@/lib/public-project-paths";
import { TILE_TONES, toneForName } from "@/lib/pill-tones";
export type OrgFeedbackProjectCardItem = { id: string; slug: string; name: string; description: string; platforms?: string[] };
export function OrgFeedbackPortal({ orgSlug, orgName, projects }: { orgSlug: string; orgName: string; projects: OrgFeedbackProjectCardItem[]; initialQuery?: string; returnHref?: string }) {
  const [tab, setTab] = useState<"products" | "guide">("products");
  const products = feedbackProductCards(projects, orgName);
  const [visibleCount, setVisibleCount] = useState(7);
  const id = useId();
  function moveTab(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "products" : event.key === "End" ? "guide" : tab === "products" ? "guide" : "products";
    setTab(next);
    document.getElementById(`${id}-${next}-tab`)?.focus();
  }
  return <div className="space-y-4 pb-6"><FeedbackPageHeader title="Feedback portal" identity={orgName} description="Share feedback and follow progress." />
    <section className="overflow-hidden rounded-panel border border-zk-border bg-zk-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zk-divider pb-4">
        <div role="tablist" aria-label="Products and help" className="inline-flex items-center rounded-full bg-zk-bg p-1">
          {([{ key: "products", label: "Products" }, { key: "guide", label: "How it works" }] as const).map(item => <button key={item.key} type="button" role="tab" id={`${id}-${item.key}-tab`} aria-selected={tab === item.key} aria-controls={`${id}-${item.key}-panel`} tabIndex={tab === item.key ? 0 : -1} onClick={() => setTab(item.key)} onKeyDown={moveTab} className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-zk-accent ${tab === item.key ? "bg-zk-surface text-zk-accent shadow-sm" : "text-zk-text2 hover:text-zk-text"}`}>
            {item.key === "products" ? <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8" /></svg> : <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg>}{item.label}
          </button>)}
        </div>
      </div>
      <div role="tabpanel" id={`${id}-products-panel`} aria-labelledby={`${id}-products-tab`} hidden={tab !== "products"} tabIndex={0}>
        {products.length ? <ul className="divide-y divide-zk-divider">{products.slice(0, visibleCount).map(project => <li key={project.id}><Link href={publicFeedbackPath({ orgSlug, projectSlug: project.slug })} aria-label={`Open ${project.name}`} className="flex items-center gap-3 rounded-control px-2 py-5 transition-colors hover:bg-zk-chip focus-visible:outline-2 focus-visible:outline-zk-accent"><span aria-hidden="true" style={TILE_TONES[toneForName(project.name)]} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-sm font-medium">{project.name.charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1"><h2 className="text-[15px] font-medium text-zk-text">{project.name}</h2><p className="mt-1 line-clamp-2 text-sm leading-5 text-zk-muted">{project.description}</p></div><span aria-hidden="true" className="text-lg text-zk-muted">›</span></Link></li>)}</ul> : <p className="px-2 py-6 text-sm text-zk-muted">No products are available right now.</p>}
        {visibleCount < products.length ? <div className="mt-3 flex justify-center"><Button variant="secondary" onClick={() => setVisibleCount(count => count + 7)}>Show more</Button></div> : null}
      </div>
      <div role="tabpanel" id={`${id}-guide-panel`} aria-labelledby={`${id}-guide-tab`} hidden={tab !== "guide"} tabIndex={0} className="px-2 py-5">
        <ol className="space-y-4">{[{ title: "Open a product", detail: "Choose the product you use." }, { title: "Send an idea", detail: "Describe a problem or suggest an improvement." }, { title: "Follow progress", detail: "Keep your tracking link for updates." }].map((step, index) => <li key={step.title} className="flex items-start gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zk-bg text-xs text-zk-muted">{index + 1}</span><div><h2 className="text-sm font-medium">{step.title}</h2><p className="mt-1 text-sm text-zk-muted">{step.detail}</p></div></li>)}</ol>
      </div>
    </section>
  </div>;
}
