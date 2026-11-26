-- Agent clusters (#agent-clusters): bring back each cluster's shared doc, which every member edits,
-- with an immutable revision per save. Additive: new columns with defaults and one new table.

-- AlterTable
ALTER TABLE "Cluster" ADD COLUMN     "doc" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "docVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ClusterDocRevision" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "reason" VARCHAR(500),
    "editorAgentId" TEXT NOT NULL,
    "editorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClusterDocRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClusterDocRevision_clusterId_version_key" ON "ClusterDocRevision"("clusterId", "version");

-- AddForeignKey
ALTER TABLE "ClusterDocRevision" ADD CONSTRAINT "ClusterDocRevision_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

