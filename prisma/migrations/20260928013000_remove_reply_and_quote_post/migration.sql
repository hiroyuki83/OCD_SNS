-- Remove legacy features that are explicitly out of scope for CoCo.
-- Replies were never part of the current Preview UX.
DROP TABLE IF EXISTS "Reply";

-- Quote posts are also out of scope. Drop the self-reference before the column.
ALTER TABLE "Post"
  DROP CONSTRAINT IF EXISTS "Post_quotePostId_fkey";

ALTER TABLE "Post"
  DROP COLUMN IF EXISTS "quotePostId";
