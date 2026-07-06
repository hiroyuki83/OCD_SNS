CREATE TYPE "ReportPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

ALTER TABLE "Report"
ADD COLUMN "priority" "ReportPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "assignedToId" TEXT,
ADD COLUMN "dueAt" TIMESTAMP(3);

CREATE TABLE "AdminNote" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "body" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,

  CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Report_priority_status_createdAt_idx" ON "Report"("priority", "status", "createdAt");
CREATE INDEX "Report_assignedToId_status_createdAt_idx" ON "Report"("assignedToId", "status", "createdAt");
CREATE INDEX "AdminNote_targetUserId_createdAt_idx" ON "AdminNote"("targetUserId", "createdAt");
CREATE INDEX "AdminNote_authorId_createdAt_idx" ON "AdminNote"("authorId", "createdAt");

ALTER TABLE "Report"
ADD CONSTRAINT "Report_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminNote"
ADD CONSTRAINT "AdminNote_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminNote"
ADD CONSTRAINT "AdminNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
