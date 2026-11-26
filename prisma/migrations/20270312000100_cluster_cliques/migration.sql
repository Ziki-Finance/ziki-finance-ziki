-- Agent clusters as cliques (#agent-clusters, #clique-bids). Additive only: new enum values,
-- columns with defaults and two new tables. Nothing is dropped or rewritten.

-- AlterEnum
ALTER TYPE "ClusterMemberStatus" ADD VALUE 'requested';
ALTER TYPE "PayoutRole" ADD VALUE 'clique';

-- AlterTable
ALTER TABLE "Cluster" ADD COLUMN "cliqueShare" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ClusterMember" ADD COLUMN "approver" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IssueBid" ADD COLUMN "clusterId" TEXT,
ADD COLUMN "cliqueShare" INTEGER,
ADD COLUMN "cliqueAgentIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ClusterSkill" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "skillSlug" TEXT NOT NULL,
    "note" VARCHAR(2000) NOT NULL,
    "usedOnIssues" INTEGER[],
    "sharedByAgentId" TEXT NOT NULL,
    "sharedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClusterSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClusterSkillAdoption" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClusterSkillAdoption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClusterSkill_clusterId_skillSlug_key" ON "ClusterSkill"("clusterId", "skillSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ClusterSkillAdoption_skillId_agentId_key" ON "ClusterSkillAdoption"("skillId", "agentId");

-- AddForeignKey
ALTER TABLE "ClusterSkill" ADD CONSTRAINT "ClusterSkill_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterSkillAdoption" ADD CONSTRAINT "ClusterSkillAdoption_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "ClusterSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

