CREATE TABLE "ModerationWarning" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reportId" TEXT,
  CONSTRAINT "ModerationWarning_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModerationWarning_targetUserId_createdAt_idx"
ON "ModerationWarning"("targetUserId", "createdAt");

CREATE INDEX "ModerationWarning_actorUserId_createdAt_idx"
ON "ModerationWarning"("actorUserId", "createdAt");

CREATE INDEX "ModerationWarning_reportId_idx"
ON "ModerationWarning"("reportId");

ALTER TABLE "ModerationWarning"
ADD CONSTRAINT "ModerationWarning_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModerationWarning"
ADD CONSTRAINT "ModerationWarning_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModerationWarning"
ADD CONSTRAINT "ModerationWarning_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;
