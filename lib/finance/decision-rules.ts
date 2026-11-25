import { z } from "zod";

export const reviewBodySchema = z.object({
  call: z.enum(["go", "no_go"]),
  summary: z.string().trim().min(10).max(1500),
  answerAgainst: z.string().trim().min(10).max(1000),
});

export const decisionBodySchema = z.object({
  call: z.enum(["go", "no_go"]),
  sentence: z.string().trim().min(10).max(500),
  reasons: z.array(z.string().trim().min(5).max(500)).min(3).max(5),
  answerAgainst: z.string().trim().min(10).max(1500),
  answerDissent: z.string().trim().min(10).max(1500).optional(),
  changeMind: z.string().trim().min(10).max(1500),
  buyRangeLow: z.number().finite().positive(),
  buyRangeHigh: z.number().finite().positive(),
  reviewIfBelow: z.number().finite().positive(),
  holdDuration: z.string().trim().min(3).max(100),
  reasonPoints: z.array(z.object({ text: z.string().trim().min(5).max(500), main: z.boolean() })).min(2).max(4),
}).refine(v => v.buyRangeHigh >= v.buyRangeLow, { message: "Buy range must be ordered." })
  .refine(v => v.reasonPoints.filter(p => p.main).length === 1, { message: "Exactly one reason point must be the main reason." });

/** Quorum is completed slots, counted by head. Confidence is never an input. */
export function reviewOutcome(votes: readonly { call: string }[], slots: number, goRequired: number) {
  if (!Number.isInteger(slots) || slots < 1 || !Number.isInteger(goRequired) || goRequired < 1 || goRequired > slots) {
    throw new Error("Invalid review thresholds.");
  }
  const go = votes.filter(v => v.call === "go").length;
  return { complete: votes.length === slots, go, total: votes.length, passed: votes.length === slots && go >= goRequired,
    split: go > 0 && go < votes.length };
}

export function assertDeciderVerdict(input: z.infer<typeof decisionBodySchema>, votes: readonly { call: string }[], slots: number, bar: number) {
  const outcome = reviewOutcome(votes, slots, bar);
  if (!outcome.passed) throw new Error("This stock did not pass review; the Decider cannot override it.");
  if (outcome.split && !input.answerDissent) throw new Error("A split decision must answer the dissent in writing.");
  return outcome;
}

export function reasonStatus(points: readonly { status: string; main: boolean }[]): "holds" | "weakening" | "broken" {
  if (points.length < 2 || points.length > 4) throw new Error("A holding needs 2–4 checked reason points.");
  const breaking = points.filter(p => p.status === "breaking");
  return breaking.some(p => p.main) || breaking.length > 1 ? "broken" : breaking.length === 1 ? "weakening" : "holds";
}

/** Always the next Monday, in UTC; no locale-dependent date parsing. */
export function nextWeeklyCheck(now: Date): Date {
  const next = new Date(now);
  next.setUTCHours(0, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % 7 || 7));
  return next;
}
