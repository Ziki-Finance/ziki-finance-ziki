-- One invite link per organisation that never expires (#invite-link). Links that no longer work stay off: an expired
-- or used-up link is turned off first, so dropping the limits can't bring it back. Then only each organisation's
-- newest working link stays on, and the expiry, use limit and note go.
UPDATE "OrganisationShareLink"
SET "revokedAt" = NOW()
WHERE "revokedAt" IS NULL
  AND ("expiresAt" <= NOW() OR ("maxUses" IS NOT NULL AND "useCount" >= "maxUses"));

UPDATE "OrganisationShareLink"
SET "revokedAt" = NOW()
WHERE "revokedAt" IS NULL
  AND "id" NOT IN (
    SELECT DISTINCT ON ("organisationId") "id"
    FROM "OrganisationShareLink"
    WHERE "revokedAt" IS NULL
    ORDER BY "organisationId", "createdAt" DESC
  );

ALTER TABLE "OrganisationShareLink" DROP COLUMN "label", DROP COLUMN "expiresAt", DROP COLUMN "maxUses";
