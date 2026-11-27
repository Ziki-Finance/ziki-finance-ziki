"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBugAction } from "@/app/actions/issues";
import { ownerAcceptIdeaAction } from "@/app/actions/owner-moves";

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2";

/**
 * The small + beside Todo (#quick-todo): a tiny box to jot down something to do. It is filed like anything typed into
 * the project, so Ziki's LLM writes it up (a title and the standard headings, lib/idea-structuring.ts); for an owner or
 * admin it is then accepted at once and lands in Todo, otherwise it waits under New Tickets for approval.
 */
export function QuickTodo({ projectId, canAccept }: { projectId: string; canAccept: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!pending && !text.trim() && !boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, pending, text]);

  const add = () => {
    const body = text.trim();
    if (body.length < 10) {
      setError("Say a little more: at least 10 characters.");
      return;
    }
    setError(null);
    const data = new FormData();
    data.set("title", body.split("\n")[0].slice(0, 200));
    data.set("description", body);
    data.set("proofLinks", "");
    data.set("projectId", projectId);
    data.set("isReport", "true");
    data.set("stay", "true");
    start(async () => {
      try {
        const filed = await createBugAction(data);
        if (filed?.error || !filed?.ideaId) {
          setError(filed?.error ?? "Could not add it. Try again.");
          return;
        }
        if (canAccept) {
          const accepted = await ownerAcceptIdeaAction(filed.ideaId);
          if ("error" in accepted) {
            setError(`Added as a new ticket, but it couldn't go straight to Todo: ${accepted.error}`);
            router.refresh();
            return;
          }
        }
        setText("");
        setOpen(false);
        router.refresh();
      } catch {
        setError("Could not add it. Try again.");
      }
    });
  };

  return (
    <div ref={boxRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="Add a todo"
        title="Add a todo"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-zk-muted transition hover:bg-zk-chip hover:text-zk-accent ${focus}`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      {open ? (
        <div role="dialog" aria-label="Add a todo" className="absolute left-0 top-8 z-40 w-[320px] max-w-[calc(100vw-2rem)] rounded-panel border border-zk-border bg-zk-surface p-3 shadow-lg">
          <label htmlFor="quick-todo-input" className="sr-only">What needs doing?</label>
          <textarea
            ref={inputRef}
            id="quick-todo-input"
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) add();
            }}
            disabled={pending}
            placeholder="What needs doing? Ziki writes it up."
            className="w-full resize-none rounded-xl border border-zk-border bg-zk-bg px-3 py-2 text-sm text-zk-text outline-none placeholder:text-zk-muted focus:border-zk-accent"
          />
          {error ? <p className="m-0 mt-1.5 text-xs text-zk-bad-fg">{error}</p> : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-zk-muted">{pending ? "Ziki is writing it up…" : "Ctrl+Enter to add"}</span>
            <button
              type="button"
              onClick={add}
              disabled={pending || !text.trim()}
              className={`inline-flex h-8 items-center rounded-full bg-zk-text px-3.5 text-[13px] font-semibold text-zk-surface transition disabled:opacity-50 ${focus}`}
            >
              {pending ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
