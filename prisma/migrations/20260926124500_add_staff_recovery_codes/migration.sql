CREATE TABLE "StaffRecoveryCode" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt" TIMESTAMP(3),
  "codeHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "StaffRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffRecoveryCode_codeHash_key"
ON "StaffRecoveryCode"("codeHash");

CREATE INDEX "StaffRecoveryCode_userId_usedAt_idx"
ON "StaffRecoveryCode"("userId", "usedAt");

CREATE INDEX "StaffRecoveryCode_userId_createdAt_idx"
ON "StaffRecoveryCode"("userId", "createdAt");

ALTER TABLE "StaffRecoveryCode"
ADD CONSTRAINT "StaffRecoveryCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
