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
  const [selected, setSelected] = useState<ClearanceCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedEmails = useMemo(
    () => new Set(selected.map((s) => s.email.toLowerCase())),
    [selected],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = candidates.filter(
      (c) => !selectedEmails.has(c.email.toLowerCase()),
    );
    if (!q) return available.slice(0, 8);
    return available
      .filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [candidates, query, selectedEmails]);

  function addPerson(person: ClearanceCandidate) {
    if (!selectedEmails.has(person.email.toLowerCase())) {
      setSelected((prev) => [...prev, person]);
    }
    setQuery("");
    inputRef.current?.focus();
  }

  function addTypedEmail(raw: string) {
    const email = raw.trim().toLowerCase();
    if (!email || selectedEmails.has(email)) return;
    const existing = candidates.find((c) => c.email.toLowerCase() === email);
    setSelected((prev) => [
      ...prev,
      existing ?? { id: email, name: email, email, agents: 0 },
    ]);
    setQuery("");
  }

  function removeEmail(email: string) {
    setSelected((prev) =>
      prev.filter((s) => s.email.toLowerCase() !== email.toLowerCase()),
    );
  }

  const totalCount =
    selected.length +
    (query.trim() && !selectedEmails.has(query.trim().toLowerCase()) ? 1 : 0);

  return (
    <form action={action} className="space-y-3">
      {selected.map((person) => (
        <input key={person.email} type="hidden" name="emails" value={person.email} />
      ))}

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <span
              key={person.email}
              className="inline-flex items-center gap-1.5 rounded-full border border-zk-accent/40 bg-zk-tint px-2.5 py-1 text-xs font-medium text-zk-accent"
            >
              <span>{person.name !== person.email ? `${person.name} (${person.email})` : person.email}</span>
              <button
                type="button"
                aria-label={`Remove ${person.email}`}
                onClick={() => removeEmail(person.email)}
                className="rounded-full px-1 text-[11px] hover:bg-zk-accent/20"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <label
            htmlFor="clearance-email-input"
            className="mb-1.5 block text-xs font-medium text-zk-text2"
          >
            Add members by name or email (select one or multiple)
          </label>
          <input
            ref={inputRef}
            id="clearance-email-input"
            name="email"
            type="text"
            autoComplete="off"
            required={selected.length === 0}
            value={query}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setTimeout(() => setOpen(false), 150);
            }}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === ",") && query.includes("@")) {
                event.preventDefault();
                addTypedEmail(query.replace(/,$/, ""));
              }
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            placeholder="Search Ziki members or type emails (press Enter to add multiple)…"
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
                      addPerson(person);
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
                      + Add · {person.agents}{" "}
                      {person.agents === 1 ? "agent" : "agents"}
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
          {totalCount > 1
            ? `Grant clearance (${totalCount})`
            : "Grant clearance"}
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
