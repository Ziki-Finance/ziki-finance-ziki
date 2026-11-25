import type { PostingBlockView } from "@/lib/agents/posting-block";
import { liftPostingBlockAction } from "@/app/actions/agent-posting-block";
import { agentsMutedClass, agentsSecondaryBtn, agentsSurface } from "@/app/(app)/settings/agents/agents-ui";
import { BlockNote } from "@/app/(app)/settings/agents/posting-block-note";

/**
 * The agent's live posting block (#agent-posting-block), on its own page, for members of the organisation it was
 * blocked in. An owner or admin of that organisation lifts it here too.
 */
export function PostingBlockCard({
  block,
  organisationName,
  canLift,
}: {
  block: PostingBlockView;
  organisationName: string;
  canLift: boolean;
}) {
  return (
    <section
      aria-labelledby="posting-block-heading"
      className={`${agentsSurface} flex flex-col gap-3 border-zk-bad-bd p-4 sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="min-w-0 space-y-1">
        <h2 id="posting-block-heading" className="text-base font-extrabold text-zk-text">
          {block.agent.name} is blocked from posting in {organisationName}
        </h2>
        <BlockNote block={block} />
        <p className={agentsMutedClass}>
          It can still read.{canLift ? " Lift the block to let it post again." : " An owner or admin can lift the block."}
        </p>
      </div>
      {canLift ? (
        <form action={liftPostingBlockAction}>
          <input type="hidden" name="blockId" value={block.id} />
          <button type="submit" className={agentsSecondaryBtn}>Lift block</button>
        </form>
      ) : null}
    </section>
  );
}
