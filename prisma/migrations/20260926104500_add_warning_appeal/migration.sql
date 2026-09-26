CREATE TABLE "WarningAppeal" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "message" TEXT NOT NULL,
  "warningId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "WarningAppeal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarningAppeal_warningId_key" ON "WarningAppeal"("warningId");
CREATE INDEX "WarningAppeal_userId_createdAt_idx" ON "WarningAppeal"("userId", "createdAt");

ALTER TABLE "WarningAppeal"
ADD CONSTRAINT "WarningAppeal_warningId_fkey"
FOREIGN KEY ("warningId") REFERENCES "ModerationWarning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarningAppeal"
ADD CONSTRAINT "WarningAppeal_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
