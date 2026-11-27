-- === 20270206000000_finance_foundations ===
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

-- === 20270207000000_finance_research ===
-- Ziki Finance release step 1 (FIN-CR-004): daily snapshots, review jobs, agents' views and verdicts, agreed views.
-- Nothing here links to a person's holdings.
-- CreateEnum
CREATE TYPE "FinanceJobReason" AS ENUM ('first', 'news', 'move', 'earnings', 'weekly');

-- CreateEnum
CREATE TYPE "FinanceJobStatus" AS ENUM ('open', 'agreed', 'no_agreement');

-- CreateEnum
CREATE TYPE "FinanceCall" AS ENUM ('buy_keep', 'consider_selling', 'sell');

-- CreateEnum
CREATE TYPE "FinanceRisk" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "FinanceVerdictKind" AS ENUM ('agree', 'disagree', 'unsure');

-- CreateEnum
CREATE TYPE "FinanceViewOutcome" AS ENUM ('open', 'agreed', 'not_agreed');

-- CreateTable
CREATE TABLE "FinanceSnapshot" (
    "id" TEXT NOT NULL,
    "tickerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "close" DECIMAL(20,4),
    "changePct" DOUBLE PRECISION,
    "headlines" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceJob" (
    "id" TEXT NOT NULL,
    "tickerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reason" "FinanceJobReason" NOT NULL,
    "status" "FinanceJobStatus" NOT NULL DEFAULT 'open',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceView" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "tickerId" TEXT NOT NULL,
    "agentId" TEXT,
    "ownerId" TEXT NOT NULL,
    "call" "FinanceCall" NOT NULL,
    "risk" "FinanceRisk" NOT NULL,
    "reasons" TEXT[],
    "changeMind" TEXT NOT NULL,
    "sources" TEXT[],
    "outcome" "FinanceViewOutcome" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceVerdict" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "agentId" TEXT,
    "ownerId" TEXT NOT NULL,
    "verdict" "FinanceVerdictKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceVerdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAgreedView" (
    "id" TEXT NOT NULL,
    "tickerId" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "agreedAt" TIMESTAMP(3) NOT NULL,
    "priceAtAgreement" DECIMAL(20,4),
    "agentsAgree" INTEGER NOT NULL,
    "agentsTotal" INTEGER NOT NULL,
    "divided" BOOLEAN NOT NULL DEFAULT false,
    "score30" DOUBLE PRECISION,
    "score90" DOUBLE PRECISION,

    CONSTRAINT "FinanceAgreedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCycle" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSnapshot_tickerId_date_key" ON "FinanceSnapshot"("tickerId", "date");

-- CreateIndex
CREATE INDEX "FinanceJob_status_createdAt_idx" ON "FinanceJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceJob_tickerId_date_key" ON "FinanceJob"("tickerId", "date");

-- CreateIndex
CREATE INDEX "FinanceView_tickerId_createdAt_idx" ON "FinanceView"("tickerId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceView_outcome_idx" ON "FinanceView"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceView_jobId_agentId_key" ON "FinanceView"("jobId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVerdict_viewId_agentId_key" ON "FinanceVerdict"("viewId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAgreedView_viewId_key" ON "FinanceAgreedView"("viewId");

-- CreateIndex
CREATE INDEX "FinanceAgreedView_tickerId_agreedAt_idx" ON "FinanceAgreedView"("tickerId", "agreedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCycle_date_step_key" ON "FinanceCycle"("date", "step");

-- AddForeignKey
ALTER TABLE "FinanceSnapshot" ADD CONSTRAINT "FinanceSnapshot_tickerId_fkey" FOREIGN KEY ("tickerId") REFERENCES "FinanceTicker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJob" ADD CONSTRAINT "FinanceJob_tickerId_fkey" FOREIGN KEY ("tickerId") REFERENCES "FinanceTicker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceView" ADD CONSTRAINT "FinanceView_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "FinanceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceView" ADD CONSTRAINT "FinanceView_tickerId_fkey" FOREIGN KEY ("tickerId") REFERENCES "FinanceTicker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceView" ADD CONSTRAINT "FinanceView_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVerdict" ADD CONSTRAINT "FinanceVerdict_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "FinanceView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVerdict" ADD CONSTRAINT "FinanceVerdict_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAgreedView" ADD CONSTRAINT "FinanceAgreedView_tickerId_fkey" FOREIGN KEY ("tickerId") REFERENCES "FinanceTicker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAgreedView" ADD CONSTRAINT "FinanceAgreedView_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "FinanceView"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === 20270208000000_finance_briefing ===
-- Ziki Finance release step 2 (FIN-CR-005): one daily briefing per person per local day.
-- CreateTable
CREATE TABLE "FinanceBriefing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "headline" TEXT NOT NULL,
    "needsLook" BOOLEAN NOT NULL DEFAULT false,
    "hasViews" BOOLEAN NOT NULL DEFAULT false,
    "inboxAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceBriefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceBriefing_userId_createdAt_idx" ON "FinanceBriefing"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBriefing_userId_date_key" ON "FinanceBriefing"("userId", "date");

-- AddForeignKey
ALTER TABLE "FinanceBriefing" ADD CONSTRAINT "FinanceBriefing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- === 20270209000000_finance_settings ===
-- Ziki Finance release step 2b (FIN-CR-006, idea 19, FIN-D-022): the agreement
-- numbers staff set on /superadmin/finance, and an audit row per change.

-- CreateTable
CREATE TABLE "FinanceSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "agreementNeeded" INTEGER NOT NULL DEFAULT 3,
    "managerVoteWeight" INTEGER NOT NULL DEFAULT 3,
    "sellAgreementNeeded" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSettingsChange" (
    "id" TEXT NOT NULL,
    "changedById" TEXT,
    "beforeAgreementNeeded" INTEGER NOT NULL,
    "beforeManagerVoteWeight" INTEGER NOT NULL,
    "beforeSellAgreementNeeded" INTEGER NOT NULL,
    "agreementNeeded" INTEGER NOT NULL,
    "managerVoteWeight" INTEGER NOT NULL,
    "sellAgreementNeeded" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceSettingsChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceSettingsChange_createdAt_idx" ON "FinanceSettingsChange"("createdAt");

-- AddForeignKey
ALTER TABLE "FinanceSettingsChange" ADD CONSTRAINT "FinanceSettingsChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === 20270210100000_finance_holding_cost ===
-- Ziki Finance release step 2b, PR B (FIN-CR-006, idea 27): what a holding cost
-- the person, and what it was worth when they added it.

-- AlterTable
ALTER TABLE "FinanceHolding" ADD COLUMN "avgCostAsOf" TIMESTAMP(3),
ADD COLUMN "addedPrice" DECIMAL(20,4);

-- === 20270221000000_finance_stream_b ===
-- Ziki Finance v3 Stream B (FIN-CR-014): enrichment dossier, evaluation rubric
-- and the retryable pipeline jobs that drive them (PRD §4.3–4.4, §6, §7).

-- CreateEnum
CREATE TYPE "FinanceEvidenceSection" AS ENUM ('business', 'numbers', 'filings', 'news', 'social', 'market_context');

-- CreateEnum
CREATE TYPE "FinanceCandidateStage" AS ENUM ('screen', 'enrich', 'evaluate', 'review', 'decide', 'done');

-- CreateEnum
CREATE TYPE "FinanceEvalCall" AS ENUM ('buy', 'hold', 'dont_buy');

-- CreateEnum
CREATE TYPE "FinancePipelineKind" AS ENUM ('enrich', 'evaluate', 'review', 'decide');

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

-- === 20271123000000_finance_criteria ===
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

-- === 20271123010200_finance_stream_c ===
-- AlterTable
ALTER TABLE "FinanceTicker" ADD COLUMN     "industry" TEXT;

-- AlterTable
ALTER TABLE "FinanceCandidate" ADD COLUMN     "reviewGoRequired" INTEGER,
ADD COLUMN     "reviewSlots" INTEGER;

-- CreateTable
CREATE TABLE "FinanceReview" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "call" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "answerAgainst" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDecision" (
    "id" TEXT NOT NULL,
    "tickerId" TEXT NOT NULL,
    "candidateId" TEXT,
    "checkId" TEXT,
    "call" TEXT NOT NULL,
    "sentence" TEXT NOT NULL,
    "reasons" TEXT[],
    "reasonPoints" JSONB NOT NULL DEFAULT '[]',
    "answerAgainst" TEXT NOT NULL,
    "answerDissent" TEXT,
    "changeMind" TEXT NOT NULL,
    "buyRangeLow" DECIMAL(20,4),
    "buyRangeHigh" DECIMAL(20,4),
    "reviewIfBelow" DECIMAL(20,4),
    "holdDuration" TEXT,
    "agentId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "reviewGo" INTEGER NOT NULL,
    "reviewTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tickerId" TEXT NOT NULL,
    "decisionId" TEXT,
    "side" TEXT NOT NULL,
    "shares" DECIMAL(20,6) NOT NULL,
    "price" DECIMAL(20,4),
    "benchmarkPrice" DECIMAL(20,4),
    "tradedAt" TIMESTAMP(3) NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReasonPoint" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "main" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceReasonPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCheck" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "researcherAgentId" TEXT,
    "reviewerAgentId" TEXT,
    "deciderAgentId" TEXT,
    "claimedByAgentId" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "reasonStatus" TEXT,
    "reviewSummary" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCheckResult" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "reasonPointId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sources" TEXT[],
    "actorId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceOwnerAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "actorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceOwnerAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tickerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReview_candidateId_agentId_key" ON "FinanceReview"("candidateId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDecision_candidateId_key" ON "FinanceDecision"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDecision_checkId_key" ON "FinanceDecision"("checkId");

-- CreateIndex
CREATE INDEX "FinanceDecision_tickerId_createdAt_idx" ON "FinanceDecision"("tickerId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceTrade_userId_tickerId_tradedAt_createdAt_idx" ON "FinanceTrade"("userId", "tickerId", "tradedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTrade_userId_requestId_key" ON "FinanceTrade"("userId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCheck_dedupeKey_key" ON "FinanceCheck"("dedupeKey");

-- CreateIndex
CREATE INDEX "FinanceCheck_status_createdAt_idx" ON "FinanceCheck"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCheckResult_checkId_reasonPointId_key" ON "FinanceCheckResult"("checkId", "reasonPointId");

-- CreateIndex
CREATE INDEX "FinanceOwnerAction_userId_decisionId_createdAt_idx" ON "FinanceOwnerAction"("userId", "decisionId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceChange_userId_tickerId_createdAt_idx" ON "FinanceChange"("userId", "tickerId", "createdAt");

-- AddForeignKey
ALTER TABLE "FinanceReview" ADD CONSTRAINT "FinanceReview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "FinanceCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDecision" ADD CONSTRAINT "FinanceDecision_tickerId_fkey" FOREIGN KEY ("tickerId") REFERENCES "FinanceTicker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDecision" ADD CONSTRAINT "FinanceDecision_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "FinanceCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDecision" ADD CONSTRAINT "FinanceDecision_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "FinanceCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTrade" ADD CONSTRAINT "FinanceTrade_tickerId_fkey" FOREIGN KEY ("tickerId") REFERENCES "FinanceTicker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTrade" ADD CONSTRAINT "FinanceTrade_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "FinanceDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReasonPoint" ADD CONSTRAINT "FinanceReasonPoint_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "FinanceHolding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCheck" ADD CONSTRAINT "FinanceCheck_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "FinanceHolding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCheckResult" ADD CONSTRAINT "FinanceCheckResult_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "FinanceCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCheckResult" ADD CONSTRAINT "FinanceCheckResult_reasonPointId_fkey" FOREIGN KEY ("reasonPointId") REFERENCES "FinanceReasonPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceOwnerAction" ADD CONSTRAINT "FinanceOwnerAction_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "FinanceDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ledger invariants. Unknown price is retained only for legacy imports.
ALTER TABLE "FinanceTrade" ADD CONSTRAINT "FinanceTrade_valid" CHECK
 ("side" IN ('bought','sold') AND "shares" > 0 AND ("price" IS NULL OR "price" > 0)
  AND ("benchmarkPrice" IS NULL OR "benchmarkPrice" > 0));
ALTER TABLE "FinanceReview" ADD CONSTRAINT "FinanceReview_valid_call" CHECK ("call" IN ('go','no_go'));
ALTER TABLE "FinanceDecision" ADD CONSTRAINT "FinanceDecision_valid_call" CHECK ("call" IN ('go','no_go','keep','trim','sell'));
ALTER TABLE "FinanceDecision" ADD CONSTRAINT "FinanceDecision_one_source" CHECK (("candidateId" IS NULL) <> ("checkId" IS NULL));
ALTER TABLE "FinanceCheckResult" ADD CONSTRAINT "FinanceCheckResult_valid_status" CHECK ("status" IN ('holding','breaking'));
CREATE UNIQUE INDEX "FinanceReasonPoint_one_main" ON "FinanceReasonPoint" ("holdingId") WHERE "main";

-- Audit facts cannot be edited or deleted through normal SQL writes.
-- (TRUNCATE is left allowed so test/e2e DB resets like e2e/seed.ts can wipe all tables.)
CREATE FUNCTION finance_refuse_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Finance history is append-only; record a compensating entry'; END;
$$;
CREATE TRIGGER "FinanceTrade_append_only" BEFORE UPDATE OR DELETE ON "FinanceTrade" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceReview_append_only" BEFORE UPDATE OR DELETE ON "FinanceReview" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceDecision_append_only" BEFORE UPDATE OR DELETE ON "FinanceDecision" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceReasonPoint_append_only" BEFORE UPDATE OR DELETE ON "FinanceReasonPoint" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceCheckResult_append_only" BEFORE UPDATE OR DELETE ON "FinanceCheckResult" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceOwnerAction_append_only" BEFORE UPDATE OR DELETE ON "FinanceOwnerAction" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceChange_append_only" BEFORE UPDATE OR DELETE ON "FinanceChange" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();

-- Seed primary Finance super_admin
UPDATE "User" SET "role" = 'super_admin' WHERE LOWER("email") = 'abdulsamad200591133@gmail.com';
