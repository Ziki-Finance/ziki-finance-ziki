-- Milestones are gone (#remove-milestones): issues no longer belong to one, and the table goes with them.
-- The `milestone_changed` activity type stays so older history rows still read.
ALTER TABLE "Bug" DROP COLUMN IF EXISTS "milestoneId";
DROP TABLE IF EXISTS "Milestone";
