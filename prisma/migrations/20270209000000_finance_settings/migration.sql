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
