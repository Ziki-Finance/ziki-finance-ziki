import Link from "next/link";
import { DocsLlmsCallout } from "@/components/docs-llms-callout";
import { DocsSectionPage } from "@/components/docs-section-page";
import { DOCS_SECTIONS } from "@/lib/docs-nav";

export const metadata = {
  title: "Docs for AI agents",
  description: "Ziki agent index at /llms.txt with every instruction at /<org>/agents.txt, one file per organisation with a tagged section for each topic.",
};

const section = DOCS_SECTIONS.find((item) => item.id === "agents")!;

export default function AgentsDocsPage() {
  return (
    <DocsSectionPage
      section={section}
      intro="AI agents start at /llms.txt, then read their organisation's /<org>/agents.txt: one file, each section tagged with its topic."
    >
      <DocsLlmsCallout />

      <section className="space-y-4">
        <h2 className="border-b border-zk-divider pb-2 text-xl font-extrabold text-zk-text">
          What is /llms.txt?
        </h2>
        <p className="text-sm text-zk-muted">
          <code className="rounded bg-zk-chip px-1.5 py-0.5 font-mono text-xs text-zk-text">/llms.txt</code> is
          Ziki&apos;s short agent entry point: what Ziki is and how to connect. A connected agent then reads{" "}
          <code className="rounded bg-zk-chip px-1.5 py-0.5 font-mono text-xs text-zk-text">/&lt;org&gt;/agents.txt</code>
          , its organisation&apos;s instructions: every instruction in one file, each section tagged with its topic,
          including any the organisation added.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b border-zk-divider pb-2 text-xl font-extrabold text-zk-text">
          Setting up an agent
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-zk-muted">
          <li>
            Give your AI tool this address to read:{" "}
            <code className="rounded bg-zk-chip px-1.5 py-0.5 font-mono text-xs text-zk-text">https://ziki.dev/llms.txt</code>
          </li>
          <li>
            Connect the agent to your account in{" "}
            <Link href="/settings/agents/connect" className="font-semibold text-zk-accent hover:underline">
              Connect an agent
            </Link>{" "}
            or{" "}
            <Link href="/settings/agents/pair" className="font-semibold text-zk-accent hover:underline">
              Pair an agent
            </Link>
            .
          </li>
          <li>
            Developers who want the details in readable pages can use the{" "}
            <Link href="/docs/developers/api-reference" className="font-semibold text-zk-accent hover:underline">
              API reference
            </Link>
            .
          </li>
        </ol>
      </section>
    </DocsSectionPage>
  );
}
