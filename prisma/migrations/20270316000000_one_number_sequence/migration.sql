-- #one-number: ideas and issues share one number sequence per organisation, so a
-- number names exactly one thing (idea #2478 and issue #2478 can't both exist).
--
-- Issues keep their numbers: they are quoted in pull requests and commits. An
-- idea whose number an issue of its organisation already has gets a new number
-- after everything the organisation has numbered, in the order they were.

WITH taken AS (
  SELECT i."id", i."organisationId", i."number"
  FROM "Idea" AS i
  WHERE EXISTS (SELECT 1 FROM "Bug" AS b WHERE b."organisationId" = i."organisationId" AND b."number" = i."number")
),
top AS (
  SELECT o."id" AS "organisationId",
         GREATEST(
           COALESCE((SELECT MAX(b."number") FROM "Bug" AS b WHERE b."organisationId" = o."id"), 0),
           COALESCE((SELECT MAX(i."number") FROM "Idea" AS i WHERE i."organisationId" = o."id"), 0)
         ) AS "highest"
  FROM "Organisation" AS o
),
renumbered AS (
  SELECT t."id", top."highest" + ROW_NUMBER() OVER (PARTITION BY t."organisationId" ORDER BY t."number") AS "number"
  FROM taken AS t JOIN top ON top."organisationId" = t."organisationId"
)
UPDATE "Idea" AS i SET "number" = r."number" FROM renumbered AS r WHERE i."id" = r."id";

-- One counter, resuming after the highest number either table holds.
ALTER TABLE "Organisation" RENAME COLUMN "nextIssueNumber" TO "nextNumber";
UPDATE "Organisation" AS o
SET "nextNumber" = GREATEST(
  COALESCE((SELECT MAX(b."number") FROM "Bug" AS b WHERE b."organisationId" = o."id"), 0),
  COALESCE((SELECT MAX(i."number") FROM "Idea" AS i WHERE i."organisationId" = o."id"), 0)
) + 1;
ALTER TABLE "Organisation" DROP COLUMN "nextIdeaNumber";

-- Both triggers take the next value from the same counter, under the
-- organisation row lock, so an idea and an issue filed at once still differ.
CREATE OR REPLACE FUNCTION "assign_organisation_bug_number"() RETURNS trigger AS $$
DECLARE
  assigned integer;
BEGIN
  UPDATE "Organisation"
  SET "nextNumber" = "nextNumber" + 1
  WHERE "id" = NEW."organisationId"
  RETURNING "nextNumber" - 1 INTO assigned;

  NEW."number" := assigned;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assign_organisation_idea_number"() RETURNS trigger AS $$
DECLARE
  assigned integer;
BEGIN
  UPDATE "Organisation"
  SET "nextNumber" = "nextNumber" + 1
  WHERE "id" = NEW."organisationId"
  RETURNING "nextNumber" - 1 INTO assigned;

  NEW."number" := assigned;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
