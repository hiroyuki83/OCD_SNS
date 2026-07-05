-- CreateTable
CREATE TABLE "YbocsResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "obsessionsScore" INTEGER NOT NULL,
    "compulsionsScore" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "q1" INTEGER NOT NULL,
    "q2" INTEGER NOT NULL,
    "q3" INTEGER NOT NULL,
    "q4" INTEGER NOT NULL,
    "q5" INTEGER NOT NULL,
    "q6" INTEGER NOT NULL,
    "q7" INTEGER NOT NULL,
    "q8" INTEGER NOT NULL,
    "q9" INTEGER NOT NULL,
    "q10" INTEGER NOT NULL,
    "symptomsCurrent" TEXT[],
    "symptomsPast" TEXT[],

    CONSTRAINT "YbocsResult_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "YbocsResult" ADD CONSTRAINT "YbocsResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
