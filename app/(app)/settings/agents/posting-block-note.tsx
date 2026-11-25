import { LocalTime } from "@/components/local-time";
import type { PostingBlockView } from "@/lib/agents/posting-block";

/** Who blocked the agent, why, and until when (#agent-posting-block). */
export function BlockNote({ block }: { block: PostingBlockView }) {
  return (
    <p className="text-xs text-zk-bad-fg">
      Blocked from posting by {block.blockedBy?.name ?? "a manager agent"},{" "}
      {block.until ? <>until <LocalTime date={new Date(block.until)} absolute /></> : <>until an owner or admin lifts it</>}: {block.reason}
    </p>
  );
}
