ALTER TABLE "Follow" ADD COLUMN "acceptedAt" TIMESTAMP(3);

UPDATE "Follow"
SET "acceptedAt" = "createdAt"
WHERE "acceptedAt" IS NULL;

CREATE INDEX "Follow_followingId_acceptedAt_idx"
ON "Follow"("followingId", "acceptedAt");

CREATE INDEX "Follow_followerId_acceptedAt_idx"
ON "Follow"("followerId", "acceptedAt");
