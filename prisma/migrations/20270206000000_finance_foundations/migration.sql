-- Ziki Finance release step 0 (FIN-CR-003): finance clearance, a person's Finance profile, the shared ticker list and private holdings.

-- CreateEnum
CREATE TYPE "FinanceRiskComfort" AS ENUM ('careful', 'balanced', 'adventurous');

-- CreateEnum
CREATE TYPE "FinanceHorizon" AS ENUM ('lt1', 'y1to5', 'gt5');

-- CreateEnum
CREATE TYPE "FinanceTickerType" AS ENUM ('stock', 'etf');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "financeClearedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FinanceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskComfort" "FinanceRiskComfort" NOT NULL,
    "horizon" "FinanceHorizon" NOT NULL,
    "noticeAcceptedAt" TIMESTAMP(3) NOT NULL,
    "briefingEmail" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "trialEndsAt" TIMESTAMP(3) NOT NULL,
    "paidUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTicker" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" TEXT,
    "type" "FinanceTickerType" NOT NULL DEFAULT 'stock',
    "lastSnapshotAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceTicker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tickerId" TEXT NOT NULL,
    "shares" DECIMAL(20,6),
    "avgCost" DECIMAL(20,4),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceHolding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceProfile_userId_key" ON "FinanceProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTicker_symbol_key" ON "FinanceTicker"("symbol");

-- CreateIndex
CREATE INDEX "FinanceTicker_name_idx" ON "FinanceTicker"("name");

-- CreateIndex
CREATE INDEX "FinanceHolding_tickerId_idx" ON "FinanceHolding"("tickerId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceHolding_userId_tickerId_key" ON "FinanceHolding"("userId", "tickerId");

-- AddForeignKey
ALTER TABLE "FinanceProfile" ADD CONSTRAINT "FinanceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceHolding" ADD CONSTRAINT "FinanceHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceHolding" ADD CONSTRAINT "FinanceHolding_tickerId_fkey" FOREIGN KEY ("tickerId") REFERENCES "FinanceTicker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- /finance is now a top-level route, so "finance" joins the reserved slugs (lib/project-slug.ts).
-- A project or organisation already called "finance" becomes "finance-project", the rule new ones
-- follow, unless that name is taken too (then it is left for staff to rename). Idempotent.
UPDATE "Project" p SET "slug" = 'finance-project'
WHERE p."slug" = 'finance'
  AND NOT EXISTS (SELECT 1 FROM "Project" q WHERE q."organisationId" = p."organisationId" AND q."slug" = 'finance-project');

UPDATE "Organisation" o SET "slug" = 'finance-project'
WHERE o."slug" = 'finance'
  AND NOT EXISTS (SELECT 1 FROM "Organisation" q WHERE q."slug" = 'finance-project');
