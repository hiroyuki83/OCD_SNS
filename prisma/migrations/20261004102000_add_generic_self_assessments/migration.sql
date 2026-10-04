CREATE TABLE "SelfAssessmentResult" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assessmentKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalScore" INTEGER,
  "functionScore" INTEGER NOT NULL,
  "subscaleScores" JSONB NOT NULL,
  "answers" JSONB NOT NULL,
  "safetyFlags" JSONB NOT NULL,
  CONSTRAINT "SelfAssessmentResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SelfAssessmentResult_userId_assessmentKey_createdAt_idx"
ON "SelfAssessmentResult"("userId", "assessmentKey", "createdAt");

ALTER TABLE "SelfAssessmentResult"
ADD CONSTRAINT "SelfAssessmentResult_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
