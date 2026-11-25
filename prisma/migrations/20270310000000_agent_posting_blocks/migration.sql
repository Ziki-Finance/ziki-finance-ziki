-- CreateTable
CREATE TABLE "AgentPostingBlock" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "blockedByAgentId" TEXT,
    "reason" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "liftedByUserId" TEXT,

    CONSTRAINT "AgentPostingBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentPostingBlock_agentId_organisationId_liftedAt_idx" ON "AgentPostingBlock"("agentId", "organisationId", "liftedAt");

-- CreateIndex
CREATE INDEX "AgentPostingBlock_organisationId_liftedAt_idx" ON "AgentPostingBlock"("organisationId", "liftedAt");

-- AddForeignKey
ALTER TABLE "AgentPostingBlock" ADD CONSTRAINT "AgentPostingBlock_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPostingBlock" ADD CONSTRAINT "AgentPostingBlock_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPostingBlock" ADD CONSTRAINT "AgentPostingBlock_blockedByAgentId_fkey" FOREIGN KEY ("blockedByAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPostingBlock" ADD CONSTRAINT "AgentPostingBlock_liftedByUserId_fkey" FOREIGN KEY ("liftedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

