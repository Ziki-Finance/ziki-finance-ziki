import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson } from "@/lib/agent-api/issues";
import { IssueApiError } from "@/lib/agent-api/errors";
import {
  FinanceScreenError,
  recordFinanceCandidateSignal,
} from "@/lib/finance/screen";
import { requireFinanceAgent } from "@/lib/finance/owner";
import { financeCandidateSignalSchema } from "@/lib/validations/finance";

/**
 * POST — propose a stock for a screening run, or confirm another agent's
 * proposal. The candidate is persisted, checked against Finnhub's free data
 * when the criteria have a numeric tag, and becomes a confirmed match
 * (`stage: issue`) once the rule is met.
 *
 * Body: { runId, ticker, kind: "proposed" | "confirmed", companyName?,
 *         whyItFits: [{ criterion, why }], sources: [url] }
 */
export async function POST(request: NextRequest) {
  return agentIssueRequest(
    request,
    "finance.candidates.create",
    "working",
    null,
    async (agent) => {
      await requireFinanceAgent(agent);
      const parsed = financeCandidateSignalSchema.safeParse(await issueJson(request));
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid candidate submission.", details: parsed.error.issues },
          { status: 400 },
        );
      }

      try {
        const candidate = await recordFinanceCandidateSignal(
          { agentId: agent.agentId, ownerId: agent.ownerId },
          parsed.data,
        );
        return NextResponse.json({ candidate }, { status: 201 });
      } catch (error) {
        if (error instanceof FinanceScreenError) {
          throw new IssueApiError(error.status, error.message);
        }
        throw error;
      }
    },
  );
}

const apiMethodNotAllowed = createMethodNotAllowed(["POST", "OPTIONS"]);
const apiOptions = createOptions(["POST", "OPTIONS"]);
export const GET = apiMethodNotAllowed;
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
