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

