# Project Continuity Protocol (PCP)

Instructions for every AI agent and every person working on this project, whatever the tool or model. This file is meant to be copied unchanged into any project.

**Why it exists:** a conversation is an expensive and fragile place to keep a project's memory. It is lost when the session ends, cannot be handed to another person or model, and costs more with every turn. So the project's memory lives in files: small, current, unambiguous, and committed with the code. Any agent should be able to pick the project up cold from a few short files.

## 1. Setup (once per project)

If `.project-memory/` does not exist, create it with the files in section 3, using the templates in section 9. Record anything you do not know as unknown. Never invent history or decisions.

Make sure the project's tools load this file:
- `CLAUDE.md` (Claude Code) contains the line `@PCP.md`.
- `AGENTS.md` (Codex, Cursor, OpenCode, Copilot and others) has, near the top (a heading may come first): `Before anything else, read and follow PCP.md. It applies in full.`

Create either file if it is missing, and add the line if it is missing. Do not otherwise change a project's own `CLAUDE.md` or `AGENTS.md`.

If memory files already exist, keep them and adapt: archive what section 3 says to archive; do not delete history.

## 2. Starting a session

Read only these, in order:
1. `PROJECT.md`: what the project is and its constraints.
2. `.project-memory/CURRENT_STATE.md`: where things stand.
3. `.project-memory/HANDOFF.md`: what to do next.

Then check the repository (branch, uncommitted changes, recent commits) against what they say. If they disagree, report the difference before changing anything.

Open the other memory files only for the entries the task needs (search for the ID, do not read whole files). Never read `.project-memory/archive/` at start-up; open it only to answer a specific question about history.

Do not restart completed work without a reason. Do not assume a task marked done was verified or approved.

## 3. The memory files

| File | Holds | How it changes | Read |
| --- | --- | --- | --- |
| `PROJECT.md` | Purpose, scope, stack, constraints | Edited when they change | Every session |
| `CURRENT_STATE.md` | What exists and works now | **Replaced** (archive first) | Every session |
| `HANDOFF.md` | Next action and open questions | **Replaced** (archive first) | Every session |
| `DECISIONS.md` | Decisions and recommendations | Add-only | When needed |
| `TASKS.md` | Tasks and their status | Add-only (status cells may be updated) | When needed |
| `CHANGELOG.md` | Change records | Add-only | When needed |
| `ISSUES_AND_BLOCKERS.md` | Bugs, blockers, risks | Add-only | When needed |
| `IDEA_BACKLOG.md` | Ideas for later | Add-only | When needed |
| `archive/` | Old versions of replaced files | Add-only | Only on purpose |

**Replace, don't stack.** `CURRENT_STATE.md` and `HANDOFF.md` must always read as one current picture, never as a series of updates. To change them: copy the old text, word for word, to the end of `archive/<FILE>_ARCHIVE.md` under a dated heading (create `archive/` the first time), then rewrite the file. Small edits within the same session need no archive copy; archive once per session, before the first rewrite. Never write "this supersedes the section above" in these two files.

**Add, don't rewrite** everywhere else. Add new entries at the end. Change only status fields of existing entries. Never renumber, never reuse an ID, never rewrite a whole file. When something is replaced, mark the old entry SUPERSEDED and point to the new ID.

**Size guides, not limits.** `HANDOFF.md` and `CURRENT_STATE.md` about one page each (2–3 KB). Everything read at start-up together well under 8k tokens (about 32 KB). If a file grows past its guide, archive older content. The test: could a stranger read the start-up files in a minute and know what to do next?

## 4. Working in sessions

- **One deliverable per session.** A deliverable is something you can name and check: a PR, a fix, a document, a decision.
- **Checkpoint.** Stop and run the checkpoint as soon as any of these happens:
  1. the deliverable is done;
  2. the tool shows the context about two-thirds full, or warns that it will compact or summarise the conversation soon;
  3. the conversation has already been compacted or summarised (stop at once: detail may be lost);
  4. a usage limit is near.

  The checkpoint: update `CURRENT_STATE.md` and `HANDOFF.md`, commit them with the work if the project uses git, then end your reply with the **next-chat prompt** below. Do not start the next deliverable in the same conversation.
- **Next-chat prompt.** A short block the user copies into a new chat, in any tool. It names the task, its complexity, and where to resume. Make it the very end of your reply: the line **"Start a new chat and paste this:"**, then the block in a code fence, so it can be copied in one go. Never fold it into a paragraph.

  ```text
  Next task: <one line: the next deliverable>
  Complexity: <low | medium | high>
  Resume: read PCP.md, then follow HANDOFF.md (<workstream section>). Start with: <first concrete step>.
  ```

  The same task and complexity also go into the next action in `HANDOFF.md`, so "continue from the handoff" works even if the prompt is lost.
- **Complexity sets the model.** The user picks a model of matching strength in whatever tool they use. This file names no models.

  | Complexity | Typical work | Model to pick |
  | --- | --- | --- |
  | low | Docs, small edits, running tests, lookups, memory updates | The tool's small, fast model |
  | medium | Normal features and fixes with a clear plan | The tool's standard model |
  | high | Planning, architecture, unclear bugs, reviews, risky changes | The tool's strongest model |

  If you find the task harder or easier than its stated complexity, say so at the start, before doing much work.

## 5. Changes

Record every meaningful change in `CHANGELOG.md` before implementing it. A change record has: ID, date, title, problem, **BEFORE**, **PROPOSED AFTER**, reason, benefits, risks and dependencies, acceptance criteria, files affected, and three statuses (approval, implementation, verification).

Lifecycle: **PROPOSED → APPROVED → IN PROGRESS → COMPLETED → VERIFIED**. Other statuses: REJECTED, ON HOLD, BLOCKED, SUPERSEDED.

- Do not skip approval. A request for an explanation, recommendation or exploration is not approval to build. When the user approves, record their words and stay within the approved scope.
- Never erase the original state. Keep BEFORE, APPROVED AFTER, ACTUAL AFTER and VERIFIED RESULT distinct. If what was built differs from what was approved, record the difference and ask when it changes scope.
- Never claim something works because code was written. Record the tests run and their actual results.
- If the user changes their mind, add the change to the record; keep the earlier decision visible.

## 6. Decisions

Record every significant decision in `DECISIONS.md`: ID, date, context, options considered, decision, reason, consequences, who approved it, related records. Mark each as confirmed, a recommendation awaiting approval, an assumption awaiting validation, or rejected. Do not silently reverse a decision: propose a new one that references the old one.

## 7. IDs and parallel work

- Stable IDs by kind: `D` decision, `R` recommendation, `CR` change record, `T` task, `I` issue, `B` blocker, `RISK` risk, `IDEA` idea. Example: `D-004`, `CR-012`.
- Other memory files: one entry per ID, with the fields from sections 5 and 6 where they apply; a table or a headed list.
- Dates in ISO format (YYYY-MM-DD).
- **One line of work:** plain IDs and one section in `HANDOFF.md`.
- **Several lines of work in parallel** (different people, sessions or areas): give each a short prefix (`FIN-D-012`, `INF-CR-006`), list the prefixes in `.project-memory/README.md`, and give each its own section in `HANDOFF.md` and `CURRENT_STATE.md`. Each workstream numbers and edits only its own entries and sections. When a second workstream starts, archive the handoff and state, rewrite them with one section per workstream, and keep existing plain IDs as they are (new ones get prefixes).
- Never run two sessions in the same folder at once. Give parallel sessions their own git worktree and branch, so clashes show up as merge conflicts instead of silent overwrites.
- Re-read a memory file right before editing it.

## 8. Quality

Memory files are concise, plain Markdown, structured for quick navigation, free of invented facts or unsupported claims, and independent of any AI tool or provider. Keep credentials, API keys, passwords and private personal data out of them. Do not claim a commit exists unless it was created.

## 9. Templates

**HANDOFF.md** (one section per workstream; about a page):

```markdown
# Handoff
_Updated YYYY-MM-DD_

## <Workstream or project name>
**Now:** what is done, in progress, not started (3–6 lines).
**Next action (complexity: low | medium | high):** the exact next step, its expected result, how to verify it.
**Open decisions:** IDs awaiting the user, one line each.
**Blockers and risks:** one line each, with IDs.
**Constraints:** rules the next agent must not break.
**Git:** branch, last commit, uncommitted work.
**Details:** links to the records and documents to open if needed.
```

**CURRENT_STATE.md** (one section per workstream; about a page): what exists and works, where it runs, what is unverified, known gaps. Facts only, with IDs for details.

**Archive heading:** `## Archived YYYY-MM-DD from HANDOFF.md` followed by the old text unchanged.

## 10. The principle

Never let important project knowledge exist only in a conversation. When in doubt, write it down, record the uncertainty, and leave a clear handoff.
