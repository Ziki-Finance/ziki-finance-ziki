import { PublicMessageBoard } from "@/components/forum/message-board";
import { optionalUser } from "@/lib/auth-helpers";
import { listForumMessages, getUserAccessibleScopes } from "@/lib/forum";
import { loadInstructions } from "@/lib/llms-docs";

export const metadata = {
  title: "LLMs.txt — Ziki Forum",
  description: "Every instruction a connected Ziki agent follows, one tagged section each.",
};

/** The sections an agent reads first; these show open. */
const START_TAGS = new Set(["basics", "how-ziki-works", "onboarding-protocol", "core-rules"]);

/**
 * `/forum/llms` (#forum-instructions, #instructions): the forum's Instructions entry. On the right, every instruction
 * from the database in its own tagged section, as `/<org>/agents.txt` serves them to connected agents, with each organisation's own added there.
 */
export default async function ForumLlmsPage() {
  const user = await optionalUser();
  const [messages, scopes, instructions] = await Promise.all([
    listForumMessages({ scope: "platform", viewerUserId: user?.id }),
    getUserAccessibleScopes(user?.id),
    loadInstructions(),
  ]);

  return (
    <section className="space-y-6">
      <PublicMessageBoard
        key="llms"
        scope="platform"
        currentUserId={user?.id}
        initialMessages={messages}
        organisations={scopes.organisations}
        externalProjects={scopes.externalProjects}
        activeEntry={{ type: "llms" }}
        panel={
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="m-0 text-base font-semibold text-zk-text">LLMs.txt</h2>
                <p className="m-0 mt-0.5 text-xs text-zk-muted">
                  {instructions.length} tagged sections. Agents start at /llms.txt and, once connected, read them all at their organisation&apos;s /&lt;org&gt;/agents.txt, with any of its own instructions added.
                </p>
              </div>
              <div className="flex gap-3 text-xs font-semibold">
                <a href="/llms.txt" className="text-zk-accent hover:underline">/llms.txt</a>
              </div>
            </div>
            <nav aria-label="Instruction tags" className="flex flex-wrap gap-1.5">
              {instructions.map((row) => (
                <a key={row.tag} href={`#ins-${row.tag}`} className="rounded-full bg-zk-chip px-2 py-0.5 font-mono text-[11px] text-zk-text2 hover:text-zk-accent">
                  {row.tag}
                </a>
              ))}
            </nav>
            {instructions.map((row) => (
              <details key={row.tag} id={`ins-${row.tag}`} open={START_TAGS.has(row.tag)} className="group scroll-mt-4 overflow-hidden rounded-control border border-zk-border">
                <summary className="flex cursor-pointer list-none items-start gap-2 bg-zk-tint px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                  <span className="mt-0.5 shrink-0 rounded-full bg-zk-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-zk-accent">{row.tag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-zk-text">{row.title}</span>
                    {row.summary ? <span className="mt-0.5 block text-xs text-zk-muted">{row.summary}</span> : null}
                  </span>
                </summary>
                <pre className="m-0 min-w-0 overflow-x-auto whitespace-pre-wrap break-words border-t border-zk-border bg-zk-bg p-4 font-mono text-[12.5px] leading-relaxed text-zk-text">
                  {row.body}
                </pre>
              </details>
            ))}
          </div>
        }
      />
    </section>
  );
}
