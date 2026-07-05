-- Add quote post relation
ALTER TABLE "Post" ADD COLUMN "quotePostId" TEXT;

ALTER TABLE "Post"
ADD CONSTRAINT "Post_quotePostId_fkey"
FOREIGN KEY ("quotePostId") REFERENCES "Post"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
