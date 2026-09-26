ALTER TABLE "ModerationWarning" ADD COLUMN "readAt" TIMESTAMP(3);
CREATE INDEX "ModerationWarning_targetUserId_readAt_idx" ON "ModerationWarning"("targetUserId", "readAt");
