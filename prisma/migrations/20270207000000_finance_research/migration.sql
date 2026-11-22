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

