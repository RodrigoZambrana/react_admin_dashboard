import { Injectable } from '@nestjs/common';
import {
  TestCenterEvaluationStatus as PrismaEvaluationStatus,
  TestCenterScenarioSourceKind as PrismaScenarioSourceKind,
} from '@prisma/client';

import type {
  TestCenterConversationEvaluation,
  TestCenterTurnEvaluation,
} from '../../api/test-center.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TestCenterEvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByConversationId(
    conversationId: string,
  ): Promise<TestCenterConversationEvaluation | null> {
    const record = await this.prisma.testCenterConversationEvaluation.findUnique({
      where: {
        conversationId,
      },
      include: {
        turnEvaluations: {
          orderBy: {
            turnIndex: 'asc',
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      scenarioId: record.scenarioId ?? null,
      scenarioLabel: record.scenarioLabel,
      scenarioSourceKind: mapScenarioSourceKindFromPrisma(record.scenarioSourceKind),
      locale: record.locale ?? null,
      overallScore: record.overallScore,
      correctnessScore: record.correctnessScore,
      coherenceScore: record.coherenceScore,
      fluencyScore: record.fluencyScore,
      writingQualityScore: record.writingQualityScore,
      status: mapEvaluationStatusFromPrisma(record.status),
      summaryLines: asStringArray(record.summary, 'summaryLines'),
      turns: record.turnEvaluations.map((turn) => ({
        turnIndex: turn.turnIndex,
        traceId: turn.traceId ?? null,
        userMessage: turn.userMessage,
        assistantMessage: turn.assistantMessage,
        overallScore: turn.overallScore,
        correctnessScore: turn.correctnessScore,
        coherenceScore: turn.coherenceScore,
        fluencyScore: turn.fluencyScore,
        writingQualityScore: turn.writingQualityScore,
        status: mapEvaluationStatusFromPrisma(turn.status),
        issues: asStringArray(turn.summary, 'issues'),
        matchedSignals: asStringArray(turn.summary, 'matchedSignals'),
      })),
    };
  }

  async upsertConversationEvaluation(input: {
    conversationId: string;
    scenarioId?: string | null;
    scenarioLabel: string;
    scenarioSourceKind: TestCenterConversationEvaluation['scenarioSourceKind'];
    locale?: string | null;
    tenantId: string;
    evaluation: TestCenterConversationEvaluation;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.testCenterConversationEvaluation.findUnique({
        where: {
          conversationId: input.conversationId,
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        await tx.testCenterTurnEvaluation.deleteMany({
          where: {
            evaluationId: existing.id,
          },
        });
      }

      const record = existing
        ? await tx.testCenterConversationEvaluation.update({
            where: {
              conversationId: input.conversationId,
            },
            data: buildEvaluationMutation(input),
          })
        : await tx.testCenterConversationEvaluation.create({
            data: {
              ...buildEvaluationMutation(input),
              tenantId: input.tenantId,
              conversationId: input.conversationId,
            },
          });

      if (input.evaluation.turns.length > 0) {
        await tx.testCenterTurnEvaluation.createMany({
          data: input.evaluation.turns.map((turn) => ({
            tenantId: input.tenantId,
            evaluationId: record.id,
            turnIndex: turn.turnIndex,
            traceId: turn.traceId ?? null,
            userMessage: turn.userMessage,
            assistantMessage: turn.assistantMessage,
            overallScore: turn.overallScore,
            correctnessScore: turn.correctnessScore,
            coherenceScore: turn.coherenceScore,
            fluencyScore: turn.fluencyScore,
            writingQualityScore: turn.writingQualityScore,
            status: mapEvaluationStatusToPrisma(turn.status),
            summary: {
              issues: turn.issues,
              matchedSignals: turn.matchedSignals,
            },
          })),
        });
      }

      return record;
    });
  }
}

function buildEvaluationMutation(input: {
  scenarioId?: string | null;
  scenarioLabel: string;
  scenarioSourceKind: TestCenterConversationEvaluation['scenarioSourceKind'];
  locale?: string | null;
  evaluation: TestCenterConversationEvaluation;
}) {
  return {
    scenarioId: input.scenarioId ?? null,
    scenarioLabel: input.scenarioLabel,
    scenarioSourceKind: mapScenarioSourceKindToPrisma(input.scenarioSourceKind),
    locale: input.locale ?? null,
    overallScore: input.evaluation.overallScore,
    correctnessScore: input.evaluation.correctnessScore,
    coherenceScore: input.evaluation.coherenceScore,
    fluencyScore: input.evaluation.fluencyScore,
    writingQualityScore: input.evaluation.writingQualityScore,
    status: mapEvaluationStatusToPrisma(input.evaluation.status),
    summary: {
      summaryLines: input.evaluation.summaryLines,
    },
  };
}

function mapScenarioSourceKindToPrisma(
  value: TestCenterConversationEvaluation['scenarioSourceKind'],
) {
  return value === 'derived'
    ? PrismaScenarioSourceKind.DERIVED
    : PrismaScenarioSourceKind.CURATED;
}

function mapScenarioSourceKindFromPrisma(
  value: PrismaScenarioSourceKind,
): TestCenterConversationEvaluation['scenarioSourceKind'] {
  return value === PrismaScenarioSourceKind.DERIVED ? 'derived' : 'curated';
}

function mapEvaluationStatusToPrisma(
  value: TestCenterConversationEvaluation['status'] | TestCenterTurnEvaluation['status'],
) {
  switch (value) {
    case 'fail':
      return PrismaEvaluationStatus.FAIL;
    case 'warn':
      return PrismaEvaluationStatus.WARN;
    case 'pass':
    default:
      return PrismaEvaluationStatus.PASS;
  }
}

function mapEvaluationStatusFromPrisma(
  value: PrismaEvaluationStatus,
): TestCenterConversationEvaluation['status'] {
  switch (value) {
    case PrismaEvaluationStatus.FAIL:
      return 'fail';
    case PrismaEvaluationStatus.WARN:
      return 'warn';
    case PrismaEvaluationStatus.PASS:
    default:
      return 'pass';
  }
}

function asStringArray(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const candidate = (value as Record<string, unknown>)[key];

  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
}
