ALTER TABLE "Post"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

CREATE INDEX "Post_deletedAt_createdAt_idx" ON "Post"("deletedAt", "createdAt");
CREATE INDEX "Post_authorId_deletedAt_createdAt_idx" ON "Post"("authorId", "deletedAt", "createdAt");
