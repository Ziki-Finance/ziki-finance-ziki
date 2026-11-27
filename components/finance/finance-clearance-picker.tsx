"use client";

import { useMemo, useRef, useState } from "react";

export type ClearanceCandidate = {
  id: string;
  name: string;
  email: string;
  agents: number;
};

export function FinanceClearancePicker({
  candidates,
  action,
  errorMessage,
}: {
  candidates: ClearanceCandidate[];
  action: (formData: FormData) => Promise<void>;
  errorMessage: string | null;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates.slice(0, 8);
    return candidates
      .filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [candidates, query]);

  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <label
            htmlFor="clearance-email-input"
            className="block text-xs font-medium text-zk-text2 mb-1.5"
          >
            Add member by name or email
          </label>
          <input
            ref={inputRef}
            id="clearance-email-input"
            name="email"
            type="email"
            required
            autoComplete="off"
            value={query}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Delay closing so click on a suggestion registers first
              setTimeout(() => setOpen(false), 150);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            placeholder="Search Ziki members or enter an email…"
            className="w-full rounded-lg border border-zk-border bg-zk-bg px-3 py-2 text-sm text-zk-text placeholder:text-zk-muted focus:border-zk-accent focus:outline-none focus:ring-2 focus:ring-zk-accent/20"
          />

          {open && matches.length > 0 ? (
            <ul
              role="listbox"
              aria-label="Matching Ziki members"
              className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-zk-border bg-zk-surface p-1 shadow-lg"
            >
              {matches.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setQuery(person.email);
                      setOpen(false);
                      inputRef.current?.focus();
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition hover:bg-zk-tint/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-zk-text">
                        {person.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-zk-muted">
                        {person.email}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-zk-border bg-zk-bg px-2 py-0.5 text-[11px] text-zk-text2">
                      {person.agents} {person.agents === 1 ? "agent" : "agents"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <button
          type="submit"
          className="shrink-0 rounded-lg bg-zk-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Grant clearance
        </button>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-xs font-medium text-zk-bad-fg">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
