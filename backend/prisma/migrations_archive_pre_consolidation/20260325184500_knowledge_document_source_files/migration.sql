ALTER TABLE "KnowledgeDocument"
ADD COLUMN "sourceFileName" TEXT,
ADD COLUMN "sourceFilePath" TEXT,
ADD COLUMN "sourceFileMime" TEXT,
ADD COLUMN "sourceFileSize" INTEGER;
