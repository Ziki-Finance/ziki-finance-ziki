-- Merge · Awaiting release (#release-step): merged into another branch, not yet released. Its own migration: Postgres
-- cannot use an enum value in the transaction that adds it.
ALTER TYPE "Substatus" ADD VALUE IF NOT EXISTS 'awaiting_release' AFTER 'error';
