-- Ziki Finance v3 Stream B (FIN-CR-014): enrichment dossier, evaluation rubric
-- and the retryable pipeline jobs that drive them (PRD §4.3–4.4, §6, §7).

-- CreateEnum
CREATE TYPE "FinanceEvidenceSection" AS ENUM ('business', 'numbers', 'filings', 'news', 'social', 'market_context');

-- CreateEnum
CREATE TYPE "FinanceCandidateStage" AS ENUM ('screen', 'enrich', 'evaluate', 'review', 'decide', 'done');

-- CreateEnum
CREATE TYPE "FinanceEvalCall" AS ENUM ('buy', 'hold', 'dont_buy');

-- CreateEnum
CREATE TYPE "FinancePipelineKind" AS ENUM ('enrich', 'evaluate');

-- CreateEnum
CREATE TYPE "FinancePipelineStatus" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "FinanceRun" (
    "id" TEXT NOT NULL,
    "criteriaLabel" TEXT NOT NULL,
    "criteriaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCandidate" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tickerId" TEXT NOT NULL,
    "stage" "FinanceCandidateStage" NOT NULL DEFAULT 'screen',
    "proposedCount" INTEGER NOT NULL DEFAULT 1,
    "codeCheck" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEvidence" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "section" "FinanceEvidenceSection" NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,
    "tier" INTEGER NOT NULL,
    "codeChecked" BOOLEAN NOT NULL DEFAULT false,
    "codeCheckNote" TEXT,
    "agentId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEvaluation" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "agentId" TEXT,
    "ownerId" TEXT NOT NULL,
    "against" BOOLEAN NOT NULL DEFAULT false,
    "call" "FinanceEvalCall" NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasons" TEXT[],
    "risks" TEXT[],
    "changeMind" TEXT NOT NULL,
    "buyRangeLow" DECIMAL(20,4),
    "buyRangeHigh" DECIMAL(20,4),
    "reviewIfBelow" DECIMAL(20,4),
    "holdDuration" TEXT NOT NULL,
    "citedEvidenceIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePipelineJob" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "kind" "FinancePipelineKind" NOT NULL,
    "status" "FinancePipelineStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedByAgentId" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePipelineJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCandidate_runId_tickerId_key" ON "FinanceCandidate"("runId", "tickerId");

-- CreateIndex
CREATE INDEX "FinanceCandidate_tickerId_idx" ON "FinanceCandidate"("tickerId");

-- CreateIndex
CREATE INDEX "FinanceCandidate_stage_idx" ON "FinanceCandidate"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEvidence_candidateId_url_key" ON "FinanceEvidence"("candidateId", "url");

-- CreateIndex
CREATE INDEX "FinanceEvidence_candidateId_section_idx" ON "FinanceEvidence"("candidateId", "section");

-- CreateIndex
CREATE INDEX "FinanceEvidence_candidateId_tier_idx" ON "FinanceEvidence"("candidateId", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEvaluation_candidateId_agentId_key" ON "FinanceEvaluation"("candidateId", "agentId");

-- CreateIndex
CREATE INDEX "FinanceEvaluation_candidateId_createdAt_idx" ON "FinanceEvaluation"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancePipelineJob_kind_status_nextRunAt_idx" ON "FinancePipelineJob"("kind", "status", "nextRunAt");

-- CreateIndex
CREATE INDEX "FinancePipelineJob_candidateId_idx" ON "FinancePipelineJob"("candidateId");

-- AddForeignKey
ALTER TABLE "FinanceCandidate" ADD CONSTRAINT "FinanceCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FinanceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCandidate" ADD CONSTRAINT "FinanceCandidate_tickerId_fkey" FOREIGN KEY ("tickerId") REFERENCES "FinanceTicker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEvidence" ADD CONSTRAINT "FinanceEvidence_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "FinanceCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEvaluation" ADD CONSTRAINT "FinanceEvaluation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "FinanceCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePipelineJob" ADD CONSTRAINT "FinancePipelineJob_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "FinanceCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: the staff thresholds the v3 pipeline reads (PRD §3, §4.3, §4.4).
ALTER TABLE "FinanceSettings"
ADD COLUMN "researchersScreen" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "researchersEnrich" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "researchersEvaluate" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "reviewersPerStock" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "reviewersWhoMustAgree" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "candidateRule" TEXT NOT NULL DEFAULT 'proposed_by_2',
ADD COLUMN "dossierCaps" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "stageTimeLimitMinutes" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "balanceShare" INTEGER NOT NULL DEFAULT 35,
ADD COLUMN "browsingRules" TEXT NOT NULL DEFAULT '',
ADD COLUMN "oneTaskPerAgent" BOOLEAN NOT NULL DEFAULT true;

-- /finance is now a top-level route, so "finance" joins the reserved slugs.
-- A project or organisation already called "finance" becomes "finance-project",
-- unless that name is taken too. Idempotent.
UPDATE "Project" p SET "slug" = 'finance-project'
WHERE p."slug" = 'finance'
  AND NOT EXISTS (SELECT 1 FROM "Project" q WHERE q."organisationId" = p."organisationId" AND q."slug" = 'finance-project');

UPDATE "Organisation" o SET "slug" = 'finance-project'
WHERE o."slug" = 'finance'
  AND NOT EXISTS (SELECT 1 FROM "Organisation" q WHERE q."slug" = 'finance-project');
