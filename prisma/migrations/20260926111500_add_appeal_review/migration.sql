CREATE TYPE "WarningAppealStatus" AS ENUM ('PENDING', 'UPHELD', 'OVERTURNED');

ALTER TABLE "ModerationWarning"
ADD COLUMN "revokedAt" TIMESTAMP(3);

ALTER TABLE "WarningAppeal"
ADD COLUMN "status" "WarningAppealStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewerId" TEXT;

CREATE INDEX "WarningAppeal_status_createdAt_idx"
ON "WarningAppeal"("status", "createdAt");

CREATE INDEX "WarningAppeal_reviewerId_createdAt_idx"
ON "WarningAppeal"("reviewerId", "createdAt");

ALTER TABLE "WarningAppeal"
ADD CONSTRAINT "WarningAppeal_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
