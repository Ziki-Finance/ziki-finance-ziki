"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ZikiMark } from "@/components/ziki-mark";
import { Avatar } from "@/components/avatar";
import { PAGE_CONTAINER_CLASS } from "@/components/page-container";
import { avatarTone } from "@/lib/avatar";
import { orgHomePath } from "@/lib/project-paths";
import { publicOrgFeedbackPath } from "@/lib/public-project-paths";
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2";
export function FeedbackPortalNav({ orgSlug, orgName, name }: { orgSlug: string | null; orgName?: string | null; name?: string | null }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const path = usePathname();
  useSearchParams();
  const portal = orgSlug ? publicOrgFeedbackPath(orgSlug) : "/";
  const inSubmissions = path.startsWith("/my-submissions");
  const active = inSubmissions ? "submissions" : "feedback";
  const tabs = [{ id: "feedback", label: "Feedback", href: portal }];
  return <header className="relative z-40 border-b border-zk-border bg-zk-surface lg:sticky lg:top-0"><div className={`${PAGE_CONTAINER_CLASS} flex flex-wrap items-center gap-x-3 gap-y-2 py-3 lg:py-1.5 max-sm:gap-x-2 max-sm:py-2 sm:px-6`}>
    <div className="flex min-w-0 items-center gap-2">
      <Link href="/" aria-label="Ziki" className={`flex shrink-0 items-center rounded-full ${focus}`}><ZikiMark className="h-8 w-auto text-zk-text max-sm:h-7" /></Link>
      <span aria-hidden="true" className="h-[18px] w-px shrink-0 bg-zk-border max-sm:hidden" />
      <Link href={orgSlug ? orgHomePath(orgSlug) : "/"} aria-label={`${orgName ?? "Organisation"} main page`} className={`inline-flex h-[30px] max-w-44 items-center gap-2 rounded-control px-1.5 text-[13px] font-medium text-zk-text hover:bg-zk-chip ${focus}`}>
        <span aria-hidden="true" className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-chip text-xs font-bold ${avatarTone(orgName)}`}>{orgName?.trim().charAt(0).toUpperCase() || "?"}</span><span className="truncate">{orgName ?? "Feedback portal"}</span>
      </Link>
    </div>
    <nav aria-label="Feedback portal" className="order-3 flex w-full items-center gap-7 sm:order-none sm:ml-8 sm:w-auto">{tabs.map(tab => <Link key={tab.id} href={tab.href} aria-current={active === tab.id ? "page" : undefined} className={`relative inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md text-[14px] ${focus} ${active === tab.id ? "font-semibold text-zk-accent after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-zk-accent" : "font-medium text-zk-text2 hover:text-zk-accent"}`}>{tab.label}</Link>)}</nav>
    <details open={accountOpen} onToggle={event => setAccountOpen(event.currentTarget.open)} className="relative ml-auto">
      <summary className={`flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-zk-border bg-zk-surface py-0.5 pl-0.5 pr-3 text-zk-text [&::-webkit-details-marker]:hidden ${focus}`} aria-label={name ? `Account for ${name}` : "Sign in options"}>
        {name ? <><Avatar name={name} size="md" variant="solid" /><span className="max-w-40 truncate text-[13px] font-medium max-sm:sr-only">{name}</span></> : <span className="px-3 text-sm font-medium">Sign in</span>}
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      {accountOpen ? <div className="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-1rem)] rounded-panel border border-zk-border bg-zk-surface p-2 shadow-lg">
        {name ? <Link href="/my-submissions" onClick={() => setAccountOpen(false)} className={`flex min-h-10 items-center rounded-control px-3 text-sm text-zk-text hover:bg-zk-chip ${focus}`}>My submissions</Link> : <><p className="px-3 py-2 text-xs leading-5 text-zk-muted">You can send feedback as a guest.</p><Link href="/login?callbackUrl=%2Fmy-submissions" className={`flex min-h-10 items-center rounded-control px-3 text-sm text-zk-accent hover:bg-zk-chip ${focus}`}>Sign in to view your submissions</Link></>}
      </div> : null}
    </details>
  </div></header>;
}

