import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { PermissionBoundary } from "@/components/permission-boundary";
import { FinanceCriteriaManager } from "@/components/finance/finance-criteria-manager";
import { listFinanceCriteria } from "@/lib/finance/criteria";
import { isFinanceOwner } from "@/lib/finance/owner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finance",
  // Unlinked and noindex: reachable only by its URL (FIN-D-011).
  robots: { index: false, follow: false, nocache: true },
};

/**
 * `/finance` — Stream A's criteria entry and list. The rest of the Finance
 * page (pipeline, stock list, decisions, portfolio) belongs to later streams.
 */
export default async function FinancePage() {
  const user = await requireUser();
  const allowed = isFinanceOwner(user);
  const criteria = allowed ? await listFinanceCriteria(user.id) : [];

  return (
    <PermissionBoundary allowed={allowed}>
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-zk-text">
            Finance
          </h1>
          <p className="max-w-2xl text-sm text-zk-muted">
            Tell Ziki what kind of companies you are looking for. Saving
            criteria starts a research run and creates a screening job for your
            agents. Editing writes a new version and starts a new run; a run
            that already started keeps the criteria it used.
          </p>
        </header>

        <FinanceCriteriaManager initialCriteria={criteria} />
      </div>
    </PermissionBoundary>
  );
}
