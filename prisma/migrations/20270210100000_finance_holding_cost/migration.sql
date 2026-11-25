-- Ziki Finance release step 2b, PR B (FIN-CR-006, idea 27): what a holding cost
-- the person, and what it was worth when they added it.

-- AlterTable
ALTER TABLE "FinanceHolding" ADD COLUMN "avgCostAsOf" TIMESTAMP(3),
ADD COLUMN "addedPrice" DECIMAL(20,4);
