import { formatZik } from "@/lib/coins/math";
import { weeklyPace, type PaceState } from "@/lib/coins/weekly-pace";

const TONE: Record<PaceState, string> = {
  "on-track": "bg-zk-ok-bg text-zk-ok-fg",
  fixable: "bg-zk-warn-bg text-zk-warn-fg",
  short: "bg-zk-bad-bg text-zk-bad-fg",
};

/** Weekly pace bar using the shared theme: earned (solid), in motion (striped), goal mark. */
export function WeeklyPaceBar({ earned, inMotion, target }: { earned: number; inMotion: number; target: number }) {
  const p = weeklyPace(earned, inMotion, target);
  return (
    <div className="relative flex flex-col gap-2.5" data-testid="weekly-pace">
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="font-bold text-zk-muted uppercase tracking-[0.08em] text-xs">This week</span>
        <span className={`rounded-full px-2 py-px font-bold ${TONE[p.state]}`}>{p.headline}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Weekly pace"
        aria-valuemin={0}
        aria-valuemax={p.target}
        aria-valuenow={Math.min(p.earned, p.target)}
        aria-valuetext={`${formatZik(p.earned)} earned, ${formatZik(p.inMotion)} in motion, goal ${formatZik(p.target)}`}
        className="relative h-3.5 overflow-hidden rounded-full bg-zk-chip"
      >
        <div className="flex h-full w-full">
          <div className="h-full bg-electric-blue transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${p.earnedPct}%` }} />
          <div
            className="h-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{
              width: `${p.inMotionPct}%`,
              background: "repeating-linear-gradient(135deg,var(--zk-accent) 0 6px,var(--color-teal-300) 6px 12px)",
            }}
          />
        </div>
        <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-zk-text/80" style={{ left: `${p.goalPct}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zk-text2">
        <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2 w-2 rounded-full bg-electric-blue" />Earned {formatZik(p.earned)}</span>
        <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2 w-2 rounded-full bg-zk-accent" />In motion {formatZik(p.inMotion)}</span>
        <span className="ml-auto font-semibold">Goal {formatZik(p.target)}</span>
      </div>
      <span className="text-[13px] text-zk-text2">{p.detail}</span>
    </div>
  );
}
