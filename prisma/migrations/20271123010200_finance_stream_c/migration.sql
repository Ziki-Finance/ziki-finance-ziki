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

-- Preserve legacy positions as explicit opening entries, never invented balances.
INSERT INTO "FinanceTrade" ("id","userId","tickerId","side","shares","price","tradedAt","requestId","actorId","actorLabel","createdAt")
 SELECT 'legacy-buy-' || "id", "userId", "tickerId", 'bought', "shares", COALESCE("avgCost","addedPrice"), "addedAt",
 'legacy-buy-' || "id", "userId", 'Legacy holding import', "addedAt"
 FROM "FinanceHolding" WHERE "shares" > 0;
INSERT INTO "FinanceTrade" ("id","userId","tickerId","side","shares","price","tradedAt","requestId","actorId","actorLabel","createdAt")
 SELECT 'legacy-sell-' || "id", "userId", "tickerId", 'sold', "shares", NULL, "soldAt",
 'legacy-sell-' || "id", "userId", 'Legacy holding import', "soldAt"
 FROM "FinanceHolding" WHERE "shares" > 0 AND "soldAt" IS NOT NULL;
INSERT INTO "FinanceChange" ("id","userId","tickerId","kind","actorId","actorLabel","detail","createdAt")
 SELECT 'import-' || "id", "userId", "tickerId", 'trade', "actorId", "actorLabel",
 jsonb_build_object('tradeId',"id",'side',"side",'shares',"shares"::text,'price',"price"::text,'date',"tradedAt"::date::text,'legacy',true), "createdAt"
 FROM "FinanceTrade";

-- Audit facts cannot be edited, deleted or truncated through normal SQL writes.
CREATE FUNCTION finance_refuse_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Finance history is append-only; record a compensating entry'; END;
$$;
CREATE TRIGGER "FinanceTrade_append_only" BEFORE UPDATE OR DELETE ON "FinanceTrade" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceTrade_no_truncate" BEFORE TRUNCATE ON "FinanceTrade" FOR EACH STATEMENT EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceReview_append_only" BEFORE UPDATE OR DELETE ON "FinanceReview" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceReview_no_truncate" BEFORE TRUNCATE ON "FinanceReview" FOR EACH STATEMENT EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceDecision_append_only" BEFORE UPDATE OR DELETE ON "FinanceDecision" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceDecision_no_truncate" BEFORE TRUNCATE ON "FinanceDecision" FOR EACH STATEMENT EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceReasonPoint_append_only" BEFORE UPDATE OR DELETE ON "FinanceReasonPoint" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceReasonPoint_no_truncate" BEFORE TRUNCATE ON "FinanceReasonPoint" FOR EACH STATEMENT EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceCheckResult_append_only" BEFORE UPDATE OR DELETE ON "FinanceCheckResult" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceCheckResult_no_truncate" BEFORE TRUNCATE ON "FinanceCheckResult" FOR EACH STATEMENT EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceOwnerAction_append_only" BEFORE UPDATE OR DELETE ON "FinanceOwnerAction" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceOwnerAction_no_truncate" BEFORE TRUNCATE ON "FinanceOwnerAction" FOR EACH STATEMENT EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceChange_append_only" BEFORE UPDATE OR DELETE ON "FinanceChange" FOR EACH ROW EXECUTE FUNCTION finance_refuse_history_mutation();
CREATE TRIGGER "FinanceChange_no_truncate" BEFORE TRUNCATE ON "FinanceChange" FOR EACH STATEMENT EXECUTE FUNCTION finance_refuse_history_mutation();
