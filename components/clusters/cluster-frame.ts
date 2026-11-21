/**
 * The messenger frame: the chat list on the left, the open cluster on the right.
 * On phones it is one column (`minmax(0,1fr)`, so long names truncate instead
 * of widening the page) showing one pane at a time, the full screen high.
 */
export const CLUSTER_FRAME = "grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[20px] border border-zk-border bg-zk-surface h-[calc(100dvh-10rem)] min-h-[420px] md:h-[calc(100vh-13rem)] md:min-h-[560px]";

