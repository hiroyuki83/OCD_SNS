ALTER TABLE "User"
ADD COLUMN "staffTotpSecretEncrypted" TEXT,
ADD COLUMN "staffTotpEnabledAt" TIMESTAMP(3),
ADD COLUMN "staffTotpLastUsedStep" INTEGER;
