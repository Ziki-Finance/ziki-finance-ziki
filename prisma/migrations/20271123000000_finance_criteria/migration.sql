-- CreateEnum
CREATE TYPE "FinanceCriteriaPreset" AS ENUM ('steady_dividend_growers', 'quality_at_a_fair_price', 'long_term_growth_leaders', 'own_words');

-- CreateEnum
CREATE TYPE "FinanceCompanySize" AS ENUM ('any', 'small', 'mid', 'large');

-- CreateEnum
CREATE TYPE "FinanceRunStage" AS ENUM ('screen', 'enrich', 'evaluate', 'review', 'decide', 'done');

-- CreateEnum
CREATE TYPE "FinanceScreenStage" AS ENUM ('proposed', 'issue', 'dropped');

-- CreateEnum
CREATE TYPE "FinanceCodeCheckStatus" AS ENUM ('not_checked', 'matched', 'failed', 'unavailable');

-- CreateEnum
CREATE TYPE "FinanceSignalKind" AS ENUM ('proposed', 'confirmed');

-- CreateTable
CREATE TABLE "FinanceCriteria" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "preset" "FinanceCriteriaPreset" NOT NULL DEFAULT 'own_words',
    "words" TEXT NOT NULL,
    "companySize" "FinanceCompanySize" NOT NULL DEFAULT 'any',
    "industries" TEXT[],
    "leaveOut" TEXT[],
    "howManyStocks" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCriteriaVersion" (
    "id" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "preset" "FinanceCriteriaPreset" NOT NULL,
    "words" TEXT NOT NULL,
    "companySize" "FinanceCompanySize" NOT NULL,
    "industries" TEXT[],
    "leaveOut" TEXT[],
    "howManyStocks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCriteriaVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable FinanceRun
ALTER TABLE "FinanceRun"
    ALTER COLUMN "criteriaLabel" SET DEFAULT '',
    ADD COLUMN "ownerId" TEXT,
    ADD COLUMN "criteriaId" TEXT,
    ADD COLUMN "criteriaVersionId" TEXT,
    ADD COLUMN "stage" "FinanceRunStage" NOT NULL DEFAULT 'screen',
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable FinanceCandidate
ALTER TABLE "FinanceCandidate"
    ALTER COLUMN "tickerId" DROP NOT NULL,
    ADD COLUMN "tickerSymbol" TEXT,
    ADD COLUMN "companyName" TEXT,
    ADD COLUMN "screenStage" "FinanceScreenStage" NOT NULL DEFAULT 'proposed',
    ADD COLUMN "codeCheckStatus" "FinanceCodeCheckStatus" NOT NULL DEFAULT 'not_checked',
    ADD COLUMN "codeCheckDetail" JSONB,
    ADD COLUMN "confirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FinanceCandidateSignal" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "kind" "FinanceSignalKind" NOT NULL,
    "whyItFits" JSONB,
    "sources" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCandidateSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceCriteria_ownerId_createdAt_idx" ON "FinanceCriteria"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceCriteriaVersion_criteriaId_createdAt_idx" ON "FinanceCriteriaVersion"("criteriaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCriteriaVersion_criteriaId_version_key" ON "FinanceCriteriaVersion"("criteriaId", "version");

-- CreateIndex
CREATE INDEX "FinanceRun_ownerId_createdAt_idx" ON "FinanceRun"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceRun_stage_idx" ON "FinanceRun"("stage");

-- CreateIndex
CREATE INDEX "FinanceRun_criteriaId_idx" ON "FinanceRun"("criteriaId");

-- CreateIndex
CREATE INDEX "FinanceCandidate_runId_screenStage_idx" ON "FinanceCandidate"("runId", "screenStage");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCandidate_runId_tickerSymbol_key" ON "FinanceCandidate"("runId", "tickerSymbol");

-- CreateIndex
CREATE INDEX "FinanceCandidateSignal_candidateId_idx" ON "FinanceCandidateSignal"("candidateId");

-- CreateIndex
CREATE INDEX "FinanceCandidateSignal_agentId_idx" ON "FinanceCandidateSignal"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCandidateSignal_candidateId_agentId_kind_key" ON "FinanceCandidateSignal"("candidateId", "agentId", "kind");

-- AddForeignKey
ALTER TABLE "FinanceCriteria" ADD CONSTRAINT "FinanceCriteria_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCriteriaVersion" ADD CONSTRAINT "FinanceCriteriaVersion_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "FinanceCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRun" ADD CONSTRAINT "FinanceRun_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRun" ADD CONSTRAINT "FinanceRun_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "FinanceCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRun" ADD CONSTRAINT "FinanceRun_criteriaVersionId_fkey" FOREIGN KEY ("criteriaVersionId") REFERENCES "FinanceCriteriaVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCandidateSignal" ADD CONSTRAINT "FinanceCandidateSignal_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "FinanceCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCandidateSignal" ADD CONSTRAINT "FinanceCandidateSignal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
