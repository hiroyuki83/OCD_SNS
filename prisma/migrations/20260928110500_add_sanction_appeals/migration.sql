CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UPHELD', 'OVERTURNED');

CREATE TABLE "Appeal" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "message" TEXT NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
  "resolutionNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "sanctionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Appeal_sanctionId_key" ON "Appeal"("sanctionId");
CREATE INDEX "Appeal_userId_createdAt_idx" ON "Appeal"("userId", "createdAt");
CREATE INDEX "Appeal_status_createdAt_idx" ON "Appeal"("status", "createdAt");
CREATE INDEX "Appeal_reviewerId_createdAt_idx" ON "Appeal"("reviewerId", "createdAt");

ALTER TABLE "Appeal"
ADD CONSTRAINT "Appeal_sanctionId_fkey"
FOREIGN KEY ("sanctionId") REFERENCES "Sanction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appeal"
ADD CONSTRAINT "Appeal_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appeal"
ADD CONSTRAINT "Appeal_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
