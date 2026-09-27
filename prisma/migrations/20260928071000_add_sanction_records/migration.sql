CREATE TYPE "SanctionType" AS ENUM ('WARNING', 'POST_RESTRICTION', 'SUSPENSION');
CREATE TYPE "SanctionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

CREATE TABLE "Sanction" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "type" "SanctionType" NOT NULL,
  "status" "SanctionStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reportId" TEXT,
  CONSTRAINT "Sanction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Sanction_targetUserId_createdAt_idx" ON "Sanction"("targetUserId", "createdAt");
CREATE INDEX "Sanction_targetUserId_status_endsAt_idx" ON "Sanction"("targetUserId", "status", "endsAt");
CREATE INDEX "Sanction_actorUserId_createdAt_idx" ON "Sanction"("actorUserId", "createdAt");
CREATE INDEX "Sanction_reportId_idx" ON "Sanction"("reportId");

ALTER TABLE "Sanction"
ADD CONSTRAINT "Sanction_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sanction"
ADD CONSTRAINT "Sanction_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sanction"
ADD CONSTRAINT "Sanction_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;
