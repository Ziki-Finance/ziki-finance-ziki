"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseIssueNumberQuery } from "@/lib/issue-number";
import { issuesPath, orgRefOf, projectPath, type ProjectRef } from "@/lib/project-paths";
import { boundSearchTerm } from "@/lib/search";

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2";

/** Where a header search goes (#header-search): an issue number opens that issue, any other text searches the organisation's issues. */
export function headerSearchTarget(projectRef: ProjectRef, query: string): string | null {
  const term = boundSearchTerm(query);
  if (!term) return null;
  const number = parseIssueNumberQuery(term);
  // Numbers are unique per organisation: the issue page sends a number that lives in another project there.
  if (number !== null) return projectPath(projectRef, `/${number}`);
  return issuesPath(orgRefOf(projectRef), "all", new URLSearchParams({ q: term }));
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/**
 * The header's search (#header-search): a magnifying glass that opens a box. Type an issue number ("42" or "#42")
 * to go straight to it, or any text to search the organisation's issues. `/` opens it from anywhere on the page.
 */
export function HeaderSearch({ projectRef }: { projectRef: ProjectRef }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key !== "/" || open || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      setOpen(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (open && !containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const number = parseIssueNumberQuery(query);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Search"
        title="Search (press /)"
        aria-expanded={open}
        aria-controls="header-search"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-zk-text hover:bg-zk-chip ${focus}`}
      >
        <SearchIcon />
      </button>
      {open ? (
        <form
          id="header-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const target = headerSearchTarget(projectRef, query);
            if (!target) return;
            setOpen(false);
            setQuery("");
            router.push(target);
          }}
          className="absolute right-0 top-[46px] z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-panel border border-zk-border bg-zk-surface p-2 motion-safe:animate-[header-pop_120ms_ease-out]"
        >
          <label htmlFor="header-search-input" className="sr-only">Search issues, or type an issue number</label>
          <div className="flex items-center gap-2 rounded-xl border border-zk-border bg-zk-bg px-3">
            <span className="text-zk-muted"><SearchIcon /></span>
            <input
              ref={inputRef}
              id="header-search-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search issues or type #42"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-zk-text outline-none placeholder:text-zk-muted"
            />
          </div>
          {query.trim() ? (
            <p className="m-0 px-1 pt-2 text-xs text-zk-muted">
              Press Enter to {number !== null ? <>open issue <span className="font-semibold text-zk-text">#{number}</span></> : <>search for <span className="font-semibold text-zk-text">“{query.trim()}”</span></>}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
