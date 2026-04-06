-- CreateEnum
CREATE TYPE "TestCenterScenarioSourceKind" AS ENUM ('CURATED', 'DERIVED');

-- CreateEnum
CREATE TYPE "TestCenterEvaluationStatus" AS ENUM ('PASS', 'WARN', 'FAIL');

-- CreateTable
CREATE TABLE "TestCenterConversationEvaluation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "scenarioLabel" TEXT NOT NULL,
    "scenarioSourceKind" "TestCenterScenarioSourceKind" NOT NULL,
    "locale" TEXT,
    "overallScore" INTEGER NOT NULL,
    "correctnessScore" INTEGER NOT NULL,
    "coherenceScore" INTEGER NOT NULL,
    "fluencyScore" INTEGER NOT NULL,
    "writingQualityScore" INTEGER NOT NULL,
    "status" "TestCenterEvaluationStatus" NOT NULL,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCenterConversationEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCenterTurnEvaluation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "turnIndex" INTEGER NOT NULL,
    "traceId" TEXT,
    "userMessage" TEXT NOT NULL,
    "assistantMessage" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "correctnessScore" INTEGER NOT NULL,
    "coherenceScore" INTEGER NOT NULL,
    "fluencyScore" INTEGER NOT NULL,
    "writingQualityScore" INTEGER NOT NULL,
    "status" "TestCenterEvaluationStatus" NOT NULL,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCenterTurnEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestCenterConversationEvaluation_conversationId_key" ON "TestCenterConversationEvaluation"("conversationId");

-- CreateIndex
CREATE INDEX "TestCenterConversationEvaluation_tenantId_status_updatedAt_idx" ON "TestCenterConversationEvaluation"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "TestCenterConversationEvaluation_tenantId_scenarioSourceKind_update_idx" ON "TestCenterConversationEvaluation"("tenantId", "scenarioSourceKind", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestCenterTurnEvaluation_evaluationId_turnIndex_key" ON "TestCenterTurnEvaluation"("evaluationId", "turnIndex");

-- CreateIndex
CREATE INDEX "TestCenterTurnEvaluation_tenantId_evaluationId_turnIndex_idx" ON "TestCenterTurnEvaluation"("tenantId", "evaluationId", "turnIndex");

-- AddForeignKey
ALTER TABLE "TestCenterConversationEvaluation" ADD CONSTRAINT "TestCenterConversationEvaluation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCenterTurnEvaluation" ADD CONSTRAINT "TestCenterTurnEvaluation_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "TestCenterConversationEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
