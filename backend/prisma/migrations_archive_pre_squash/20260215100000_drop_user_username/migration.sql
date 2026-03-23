-- Drop username column now that authentication relies on email
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'User_userName_key'
  ) THEN
    EXECUTE 'DROP INDEX "public"."User_userName_key"';
  END IF;
END
$$;

ALTER TABLE "User" DROP COLUMN IF EXISTS "userName";
