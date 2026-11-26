import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPayer } from "@/lib/coins/payers";
import { projectFunding, type ProjectFunding } from "@/lib/coins/budget-view";
import type { FundingLevel } from "@/lib/coins/budget-states";
import { formatZikShort } from "@/lib/coins/math";
import { ZikSymbol } from "@/components/zik-symbol";

/** Each level's colours and words: green keeps going, amber is running low, red has run out, grey is paused. */
const LEVEL: Record<FundingLevel, { label: string; tone: string; dot: string }> = {
  healthy: { label: "Funded", tone: "border-zk-ok-fg/30 bg-zk-ok-bg text-zk-ok-fg hover:border-zk-ok-fg/60", dot: "bg-zk-ok-fg" },
  low: { label: "Running low", tone: "border-zk-warn-bd bg-zk-warn-bg text-zk-warn-fg hover:border-zk-warn-fg/60", dot: "bg-zk-warn-fg" },
  out: { label: "Out of funds", tone: "border-zk-bad-bd bg-zk-bad-bg text-zk-bad-fg hover:border-zk-bad-fg/60", dot: "bg-zk-bad-fg" },
  paused: { label: "Paused", tone: "border-zk-border bg-zk-chip text-zk-text2 hover:border-zk-text2/50", dot: "bg-zk-muted" },
};

/**
 * The project's funding button (#funding-button), in the project's header beside Share: what the budget holds, in short
 * form, coloured by how well it keeps work going, and a link to the Budget page to fund it. Only the people who pay
 * (#payers) see it, and only once an issue in the project has a price; a Solo project has no funding, so it has none.
 * This reads what it shows, or null when it isn't shown.
 */
export async function payerProjectFunding(userId: string, organisationId: string, projectId: string): Promise<ProjectFunding | null> {
  // Most viewers don't pay, so the project is read only for those who do.
  if (!(await isPayer(prisma, userId, organisationId))) return null;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { solo: true } });
  if (!project || project.solo) return null;
  return projectFunding(projectId);
}

/** The button itself, drawn from what payerProjectFunding read. */
export function ProjectFundingButton({ funding, budgetHref }: { funding: ProjectFunding; budgetHref: string }) {
  const { label, tone, dot } = LEVEL[funding.level];
  // The tooltip just names it; a screen reader, which can't see the number or the colour, also hears both.
  const spoken = `Project budget: ${funding.available.toLocaleString("en-US")} ${funding.available === 1 ? "Zik" : "Ziks"}, ${label.toLowerCase()}`;

  return (
    <Link
      href={`${budgetHref}?section=fund`}
      aria-label={spoken}
      title="Project budget"
      data-testid="project-funding-button"
      data-level={funding.level}
      className={`inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-[13px] font-semibold tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue ${tone}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span aria-hidden="true" className="inline-flex items-baseline gap-[0.12em] font-bold">
        <ZikSymbol />
        {formatZikShort(funding.available)}
      </span>
    </Link>
  );
}
