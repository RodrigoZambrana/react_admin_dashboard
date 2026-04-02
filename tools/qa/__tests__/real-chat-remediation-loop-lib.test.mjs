import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLoopIterationReport,
  normalizeBaseline
} from "../real-chat-remediation-loop-lib.mjs";

test("normalizeBaseline requires explicit real-run artifacts and ignores structural plans as baseline", () => {
  const baseline = normalizeBaseline({
    structuralPlan: {
      baseline: {
        findings: 95,
        failedTurns: 12,
        topCategories: [{ category: "topic_loss", count: 23 }],
        topLayers: [{ layer: "turn interpretation", count: 23 }]
      }
    }
  });

  assert.equal(baseline.sourceType, "none");
  assert.equal(baseline.replay, null);
});

test("buildLoopIterationReport asks to freeze current real run when no explicit baseline exists", () => {
  const report = buildLoopIterationReport({
    loopRunId: "loop-1",
    generatedAt: "2026-04-01T23:59:00.000Z",
    iteration: 1,
    replay: {
      summary: {
        runId: "replay-1",
        totalConversations: 10,
        totalEvaluatedTurns: 20,
        totalFindings: 5,
        failedTurns: 1,
        completedConversations: 10,
        completedTurns: 20
      },
      diagnostic: {
        countsByCategory: {
          topic_loss: 3,
          quote_intake_reopened: 2
        },
        countsByLayer: {
          "turn interpretation": 3,
          "resolution readiness": 2
        }
      }
    },
    review: {
      summary: {
        totalProcessedConversations: 10,
        processedWithFindings: 3,
        processedWithoutFindings: 7,
        totalFindings: 5
      }
    },
    probe: {
      summary: {
        runId: "probe-1",
        totalConversations: 2,
        totalEvaluatedTurns: 4,
        totalFindings: 1,
        failedTurns: 0
      },
      diagnostic: {
        countsByCategory: {
          loop_reentry: 1
        },
        countsByLayer: {
          "loop prevention": 1
        }
      },
      providerAudit: {
        llmResponseTurns: 1,
        deterministicTurns: 3
      }
    },
    baseline: normalizeBaseline({})
  });

  assert.equal(report.baseline.sourceType, "none");
  assert.match(report.nextAction, /Congelar esta corrida real como baseline/);
  assert.deepEqual(report.recommendedScope.slice(0, 3), ["WS1", "WS2", "WS3"]);
  assert.ok(Array.isArray(report.architecturalGuardrails.hardConstraints));
  assert.ok(
    report.architecturalGuardrails.hardConstraints.some((entry) =>
      /heuristicas sueltas en el core/i.test(entry)
    )
  );
  assert.ok(
    report.architecturalGuardrails.allowedModelParticipation.some((entry) =>
      /naturalidad/i.test(entry)
    )
  );
});
