"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { FinanceClearanceResult } from "@/app/actions/finance";

export type ClearanceCandidate = {
  id: string;
  name: string;
  email: string;
  agents: number;
};

export type ClearedMember = {
  id: string;
  name: string | null;
  email: string;
  agents: number;
};

export function AdminSubmitButton({
  label = "Save",
  pendingLabel = "Saving…",
  className = "rounded-lg bg-zk-accent px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
}: {
  label?: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function FinanceAdminClearanceSection({
  initialCleared,
  initialCandidates,
  grantAction,
  removeAction,
  initialError = null,
}: {
  initialCleared: ClearedMember[];
  initialCandidates: ClearanceCandidate[];
  grantAction: (formData: FormData) => Promise<FinanceClearanceResult>;
  removeAction: (formData: FormData) => Promise<FinanceClearanceResult>;
  initialError?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ClearanceCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [optimisticRemovedIds, setOptimisticRemovedIds] = useState<string[]>(
    [],
  );
  const [optimisticAdded, setOptimisticAdded] = useState<ClearedMember[]>([]);
  const [granting, startGrantTransition] = useTransition();
  const [, startRemoveTransition] = useTransition();

  const clearedMembers = useMemo(() => {
    const removedSet = new Set(optimisticRemovedIds);
    const base = initialCleared.filter((p) => !removedSet.has(p.id));
    const baseEmails = new Set(base.map((p) => p.email.toLowerCase()));
    const added = optimisticAdded.filter(
      (p) => !removedSet.has(p.id) && !baseEmails.has(p.email.toLowerCase()),
    );
    return [...added, ...base];
  }, [initialCleared, optimisticAdded, optimisticRemovedIds]);

  const clearedEmails = useMemo(
    () => new Set(clearedMembers.map((p) => p.email.toLowerCase())),
    [clearedMembers],
  );

  const selectedEmails = useMemo(
    () => new Set(selected.map((s) => s.email.toLowerCase())),
    [selected],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = initialCandidates.filter(
      (c) =>
        !selectedEmails.has(c.email.toLowerCase()) &&
        !clearedEmails.has(c.email.toLowerCase()),
    );
    if (!q) return available.slice(0, 8);
    return available
      .filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [initialCandidates, query, selectedEmails, clearedEmails]);

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
    const existing = initialCandidates.find(
      (c) => c.email.toLowerCase() === email,
    );
    setSelected((prev) => [
      ...prev,
      existing ?? { id: email, name: email, email, agents: 0 },
    ]);
    setQuery("");
  }

  function removeChip(email: string) {
    setSelected((prev) =>
      prev.filter((s) => s.email.toLowerCase() !== email.toLowerCase()),
    );
  }

  function scrollTopWithNotice(message: string) {
    setBannerMessage(message);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleGrantSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setErrorMessage(null);
    setBannerMessage(null);

    startGrantTransition(async () => {
      const result = await grantAction(formData);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      const added: ClearedMember[] = (result.grantedEmails ?? []).map(
        (email) => {
          const match =
            selected.find((s) => s.email.toLowerCase() === email) ??
            initialCandidates.find((c) => c.email.toLowerCase() === email);
          return {
            id: match?.id ?? email,
            name: match?.name ?? email,
            email,
            agents: match?.agents ?? 0,
          };
        },
      );
      if (added.length > 0) {
        setOptimisticAdded((prev) => [...added, ...prev]);
      }
      setSelected([]);
      setQuery("");
      scrollTopWithNotice(result.message);
      router.refresh();
    });
  }

  function handleRemove(person: ClearedMember) {
    setErrorMessage(null);
    setBannerMessage(null);
    setRemovingId(person.id);

    const formData = new FormData();
    formData.set("userId", person.id);

    startRemoveTransition(async () => {
      const result = await removeAction(formData);
      setRemovingId(null);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      setOptimisticRemovedIds((prev) => [...prev, person.id]);
      scrollTopWithNotice(result.message);
      router.refresh();
    });
  }

  const totalCount =
    selected.length +
    (query.trim() && !selectedEmails.has(query.trim().toLowerCase()) ? 1 : 0);

  return (
    <section
      id="clearance"
      aria-labelledby="clearance-heading"
      className="rounded-2xl border border-zk-border bg-zk-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zk-divider px-6 py-4">
        <div>
          <h2
            id="clearance-heading"
            className="text-base font-bold text-zk-text"
          >
            Team Access
          </h2>
          <p className="mt-0.5 text-xs text-zk-muted">
            Only agents belonging to cleared members can run Finance jobs.
          </p>
        </div>
        <span className="rounded-full border border-zk-border bg-zk-bg px-2.5 py-0.5 text-xs font-medium tabular-nums text-zk-text2">
          {clearedMembers.length} cleared
        </span>
      </div>

      <div className="space-y-5 p-6">
        {bannerMessage ? (
          <div
            role="status"
            className="rounded-xl border border-zk-ok-fg/30 bg-zk-ok-bg px-4 py-3 text-xs font-medium text-zk-ok-fg"
          >
            {bannerMessage}
          </div>
        ) : null}

        <form onSubmit={handleGrantSubmit} className="space-y-3">
          {selected.map((person) => (
            <input
              key={person.email}
              type="hidden"
              name="emails"
              value={person.email}
            />
          ))}

          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((person) => (
                <span
                  key={person.email}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zk-accent/40 bg-zk-tint px-2.5 py-1 text-xs font-medium text-zk-accent"
                >
                  <span>
                    {person.name !== person.email
                      ? `${person.name} (${person.email})`
                      : person.email}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${person.email}`}
                    onClick={() => removeChip(person.email)}
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
                disabled={granting}
                required={selected.length === 0}
                value={query}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                  setTimeout(() => setOpen(false), 150);
                }}
                onKeyDown={(event) => {
                  if (
                    (event.key === "Enter" || event.key === ",") &&
                    query.includes("@")
                  ) {
                    event.preventDefault();
                    addTypedEmail(query.replace(/,$/, ""));
                  }
                }}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOpen(true);
                }}
                placeholder="Search Ziki members or type emails (press Enter to add multiple)…"
                className="w-full rounded-lg border border-zk-border bg-zk-bg px-3 py-2 text-sm text-zk-text placeholder:text-zk-muted focus:border-zk-accent focus:outline-none focus:ring-2 focus:ring-zk-accent/20 disabled:opacity-50"
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
              disabled={granting}
              className="shrink-0 rounded-lg bg-zk-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {granting
                ? "Granting…"
                : totalCount > 1
                  ? `Grant access (${totalCount})`
                  : "Grant access"}
            </button>
          </div>

          {errorMessage ? (
            <p role="alert" className="text-xs font-medium text-zk-bad-fg">
              {errorMessage}
            </p>
          ) : null}
        </form>

        <div className="overflow-hidden rounded-xl border border-zk-border">
          <div className="border-b border-zk-divider bg-zk-bg px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zk-muted">
            Cleared members ({clearedMembers.length})
          </div>
          {clearedMembers.length === 0 ? (
            <p className="px-4 py-4 text-xs text-zk-muted">
              No members cleared yet.
            </p>
          ) : (
            <ul className="divide-y divide-zk-divider">
              {clearedMembers.map((person) => {
                const isRemoving = removingId === person.id;
                return (
                  <li
                    key={person.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zk-border bg-zk-bg text-xs font-bold text-zk-accent">
                        {(person.name ?? person.email).slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zk-text">
                          {person.name ?? person.email}
                        </p>
                        <p className="truncate text-xs text-zk-muted">
                          <span className="font-mono">{person.email}</span> ·{" "}
                          {person.agents}{" "}
                          {person.agents === 1 ? "agent" : "agents"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isRemoving}
                      onClick={() => handleRemove(person)}
                      className="rounded-lg border border-zk-border bg-zk-bg px-3 py-1.5 text-xs font-medium text-zk-bad-fg transition hover:border-zk-bad-fg/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRemoving ? "Removing…" : "Remove"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
