import { Prisma } from "@prisma/client";
import { z } from "zod";

const quantity = z.string().trim().regex(/^\d{1,9}(\.\d{1,6})?$/, "Use a positive share count, up to six decimal places.")
  .refine(v => new Prisma.Decimal(v).gt(0) && new Prisma.Decimal(v).lte(100_000_000));
const price = z.string().trim().regex(/^\d{1,8}(\.\d{1,4})?$/, "Use a price with up to four decimal places.")
  .refine(v => new Prisma.Decimal(v).gt(0) && new Prisma.Decimal(v).lte(10_000_000));
export const tradeBodySchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z]{1,5}([.-][A-Z]{1,2})?$/),
  side: z.enum(["bought", "sold"]), shares: quantity,
  price: price.optional(),
  date: z.iso.date(),
  decisionId: z.string().min(1).max(191).optional(),
  requestId: z.uuid(),
});

type DecimalInput = Prisma.Decimal | string | number;
export type LedgerTrade = { side: string; shares: DecimalInput; price: DecimalInput | null; benchmarkPrice?: DecimalInput | null };

/** Average-cost accounting; selling removes cost proportionally, not at sale price. */
export function holdingFromTrades(trades: readonly LedgerTrade[]) {
  let shares = new Prisma.Decimal(0);
  let cost = new Prisma.Decimal(0);
  let realized = new Prisma.Decimal(0);
  let benchmarkUnits = new Prisma.Decimal(0);
  let costKnown = true;
  let realizedKnown = true;
  let benchmarkKnown = true;
  for (const trade of trades) {
    const amount = new Prisma.Decimal(trade.shares);
    if (!Number.isFinite(amount.toNumber()) || amount.lte(0)) throw new Error("Shares must be positive.");
    if (trade.price !== null) {
      const unitPrice = new Prisma.Decimal(trade.price);
      if (!Number.isFinite(unitPrice.toNumber()) || unitPrice.lte(0)) throw new Error("Price must be positive.");
    }
    if (trade.side === "bought") {
      if (trade.price === null) costKnown = false;
      else cost = cost.add(amount.mul(trade.price));
      if (trade.benchmarkPrice == null || new Prisma.Decimal(trade.benchmarkPrice).lte(0) || trade.price === null) benchmarkKnown = false;
      else benchmarkUnits = benchmarkUnits.add(amount.mul(trade.price).div(trade.benchmarkPrice));
      shares = shares.add(amount);
    } else if (trade.side === "sold") {
      if (amount.gt(shares)) throw new Error("This sale exceeds the shares held on its trade date.");
      const fraction = amount.div(shares);
      const removedCost = cost.mul(fraction);
      if (trade.price === null || !costKnown) realizedKnown = false;
      if (trade.price === null) costKnown = false;
      else realized = realized.add(amount.mul(trade.price).sub(removedCost));
      cost = cost.sub(removedCost);
      benchmarkUnits = benchmarkUnits.mul(new Prisma.Decimal(1).sub(fraction));
      shares = shares.sub(amount);
      if (shares.isZero()) { cost = new Prisma.Decimal(0); benchmarkUnits = new Prisma.Decimal(0); costKnown = true; benchmarkKnown = true; }
    } else throw new Error("Unknown trade side.");
  }
  return { shares, cost: costKnown ? cost : null, averageCost: shares.gt(0) && costKnown ? cost.div(shares) : null,
    realized: realizedKnown ? realized : null, benchmarkUnits: benchmarkKnown ? benchmarkUnits : null };
}

export function industryWarning(positions: readonly { industry: string | null; value: number | null }[], threshold: number) {
  if (positions.some(p => p.value === null)) return null;
  const total = positions.reduce((sum, p) => sum + (p.value ?? 0), 0);
  if (total <= 0) return null;
  const industries = new Map<string, number>();
  for (const p of positions) if (p.industry) industries.set(p.industry, (industries.get(p.industry) ?? 0) + (p.value ?? 0));
  const largest = [...industries].sort((a, b) => b[1] - a[1])[0];
  return largest && largest[1] / total * 100 > threshold
    ? `${largest[0]} makes up ${Math.round(largest[1] / total * 100)}% of your portfolio, above the ${threshold}% balance level.` : null;
}
