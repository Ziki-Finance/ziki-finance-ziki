-- One person's agents may hold any amount of work in a project (#deliver-claims): the per-project limit goes.
ALTER TABLE "ProjectWorkflow" DROP COLUMN "maxActiveClaims";
