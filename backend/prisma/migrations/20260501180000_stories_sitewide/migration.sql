CREATE TABLE IF NOT EXISTS "Story" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "coverPublicId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StoryItem" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "duration" INTEGER,
  "ctaLabel" TEXT,
  "ctaUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Story_slug_key" ON "Story"("slug");
CREATE INDEX IF NOT EXISTS "Story_isActive_startsAt_endsAt_idx" ON "Story"("isActive", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "StoryItem_storyId_order_idx" ON "StoryItem"("storyId", "order");
CREATE INDEX IF NOT EXISTS "StoryItem_storyId_type_idx" ON "StoryItem"("storyId", "type");

ALTER TABLE "StoryItem"
  ADD CONSTRAINT "StoryItem_storyId_fkey"
  FOREIGN KEY ("storyId")
  REFERENCES "Story"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
