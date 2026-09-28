ALTER TYPE "NotificationType" ADD VALUE 'MODERATION';

ALTER TABLE "User" ADD COLUMN "restrictionUntil" TIMESTAMP(3);

CREATE TYPE "ModerationActionType" AS ENUM (
  'WARNING',
  'POST_HIDDEN',
  'POST_RESTORED',
  'POST_RESTRICTED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_RESTORED'
);

CREATE TYPE "AppealStatus" AS ENUM (
  'OPEN',
  'REVIEWING',
  'UPHELD',
  'OVERTURNED'
);

CREATE TABLE "ModerationAction" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" "ModerationActionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "targetUserId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "postId" TEXT,
  "reportId" TEXT,
  CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Appeal" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "message" TEXT NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
  "resolutionNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "moderationActionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reviewerId" TEXT,
  CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModerationAction_targetUserId_createdAt_idx" ON "ModerationAction"("targetUserId", "createdAt");
CREATE INDEX "ModerationAction_actorUserId_createdAt_idx" ON "ModerationAction"("actorUserId", "createdAt");
CREATE INDEX "ModerationAction_type_createdAt_idx" ON "ModerationAction"("type", "createdAt");
CREATE INDEX "ModerationAction_reportId_idx" ON "ModerationAction"("reportId");
CREATE UNIQUE INDEX "Appeal_moderationActionId_userId_key" ON "Appeal"("moderationActionId", "userId");
CREATE INDEX "Appeal_status_createdAt_idx" ON "Appeal"("status", "createdAt");
CREATE INDEX "Appeal_userId_createdAt_idx" ON "Appeal"("userId", "createdAt");

ALTER TABLE "ModerationAction"
ADD CONSTRAINT "ModerationAction_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModerationAction"
ADD CONSTRAINT "ModerationAction_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModerationAction"
ADD CONSTRAINT "ModerationAction_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModerationAction"
ADD CONSTRAINT "ModerationAction_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Appeal"
ADD CONSTRAINT "Appeal_moderationActionId_fkey"
FOREIGN KEY ("moderationActionId") REFERENCES "ModerationAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appeal"
ADD CONSTRAINT "Appeal_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appeal"
ADD CONSTRAINT "Appeal_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
