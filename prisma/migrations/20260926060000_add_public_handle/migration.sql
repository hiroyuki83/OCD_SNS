ALTER TABLE "User" ADD COLUMN "handle" TEXT;

UPDATE "User"
SET "handle" = 'u_' || substr(md5("id"), 1, 12)
WHERE "handle" IS NULL;

ALTER TABLE "User" ALTER COLUMN "handle" SET NOT NULL;

CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");
