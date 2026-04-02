function toNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function sortEntries(record, keyName) {
  return Object.entries(record || {})
    .map(([key, count]) => ({ [keyName]: key, count: toNumber(count) }))
    .sort((left, right) => right.count - left.count || String(left[keyName]).localeCompare(String(right[keyName])));
}

function recordFromEntries(entries, keyField) {
  const output = {};
  for (const entry of Array.isArray(entries) ? entries : []) {
    const key = typeof entry?.[keyField] === "string" ? entry[keyField] : null;
    if (!key) {
      continue;
    }
    output[key] = toNumber(entry.count);
  }
  return output;
}

export function mergeCountMaps(...records) {
  const output = {};
  for (const record of records) {
    for (const [key, count] of Object.entries(record || {})) {
      output[key] = (output[key] || 0) + toNumber(count);
    }
  }
  return output;
}

export function buildCountDeltaEntries({
  currentCounts = {},
  baselineCounts = {},
  keyName = "key"
} = {}) {
  const keys = new Set([
    ...Object.keys(currentCounts || {}),
    ...Object.keys(baselineCounts || {})
  ]);

  return Array.from(keys)
    .map((key) => {
      const currentCount = toNumber(currentCounts[key]);
      const baselineCount = toNumber(baselineCounts[key]);
      return {
        [keyName]: key,
        currentCount,
        baselineCount,
        delta: currentCount - baselineCount
      };
    })
    .sort((left, right) => {
      const magnitudeDiff = Math.abs(right.delta) - Math.abs(left.delta);
      if (magnitudeDiff !== 0) {
        return magnitudeDiff;
      }
      const currentDiff = right.currentCount - left.currentCount;
      if (currentDiff !== 0) {
        return currentDiff;
      }
      return String(left[keyName]).localeCompare(String(right[keyName]));
    });
}

const CATEGORY_WORKSTREAM_MAP = Object.freeze({
  runtime_error: ["WS0"],
  topic_loss: ["WS1"],
  generic_fallback_overreach: ["WS1", "WS6"],
  measurement_parse_gap: ["WS2"],
  quote_intake_reopened: ["WS2", "WS3"],
  handoff_too_early: ["WS3"],
  loop_reentry: ["WS4"],
  policy_vs_core_leak: ["WS5", "WS6"]
});

const FALLBACK_WORKSTREAMS = Object.freeze([
  {
    id: "WS0",
    name: "Measurement Harness and Auditable Loop",
    priority: "P0"
  },
  {
    id: "WS1",
    name: "Turn Understanding Contract",
    priority: "P1"
  },
  {
    id: "WS2",
    name: "Normalized Quote Seed",
    priority: "P1"
  },
  {
    id: "WS3",
    name: "Readiness and Handoff from Real Blocking Conditions",
    priority: "P1"
  },
  {
    id: "WS4",
    name: "Loop Prevention from Progress Delta",
    priority: "P1"
  },
  {
    id: "WS5",
    name: "Structured Knowledge Facts from DB",
    priority: "P2"
  },
  {
    id: "WS6",
    name: "Outcome Semantics and Policy Registry",
    priority: "P2"
  },
  {
    id: "WS7",
    name: "Probe Factory and Continuous Improvement Loop",
    priority: "P2"
  }
]);

function buildWorkstreamMap(structuralPlan = null) {
  const items = Array.isArray(structuralPlan?.workstreams) && structuralPlan.workstreams.length > 0
    ? structuralPlan.workstreams
    : FALLBACK_WORKSTREAMS;

  return new Map(
    items.map((item) => [
      item.id,
      {
        id: item.id,
        name: item.name || item.id,
        priority: item.priority || "P3",
        problem: item.problem || null,
        implementation: Array.isArray(item.implementation) ? item.implementation : [],
        acceptance: Array.isArray(item.acceptance) ? item.acceptance : []
      }
    ])
  );
}

export function buildPrioritizedWorkstreams({
  combinedCategoryCounts = {},
  structuralPlan = null
} = {}) {
  const workstreamMap = buildWorkstreamMap(structuralPlan);
  const scored = new Map();

  for (const [category, count] of Object.entries(combinedCategoryCounts || {})) {
    const workstreamIds = CATEGORY_WORKSTREAM_MAP[category] || [];
    for (const workstreamId of workstreamIds) {
      const previous = scored.get(workstreamId) || {
        workstreamId,
        score: 0,
        evidenceCategories: []
      };
      previous.score += toNumber(count);
      previous.evidenceCategories.push({ category, count: toNumber(count) });
      scored.set(workstreamId, previous);
    }
  }

  return Array.from(scored.values())
    .map((entry) => {
      const definition = workstreamMap.get(entry.workstreamId) || {
        id: entry.workstreamId,
        name: entry.workstreamId,
        priority: "P3",
        problem: null,
        implementation: [],
        acceptance: []
      };
      return {
        ...definition,
        score: entry.score,
        evidenceCategories: entry.evidenceCategories.sort(
          (left, right) => right.count - left.count || left.category.localeCompare(right.category)
        )
      };
    })
    .sort((left, right) => {
      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return left.id.localeCompare(right.id);
    });
}

export function normalizeBaseline({
  baselineLoopReport = null,
  baselineReplaySummary = null,
  baselineReplayDiagnostic = null,
  baselineProbeSummary = null,
  baselineProbeDiagnostic = null
} = {}) {
  if (baselineLoopReport && typeof baselineLoopReport === "object") {
    return {
      sourceType: "loop_iteration",
      replay: baselineLoopReport.consolidatedMetrics?.replay || null,
      probe: baselineLoopReport.consolidatedMetrics?.probe || null
    };
  }

  if (baselineReplaySummary || baselineReplayDiagnostic || baselineProbeSummary || baselineProbeDiagnostic) {
    return {
      sourceType: "explicit_runs",
      replay: baselineReplaySummary || baselineReplayDiagnostic
        ? {
            totalFindings: toNumber(
              baselineReplaySummary?.totalFindings ?? baselineReplayDiagnostic?.summary?.totalFindings
            ),
            failedTurns: toNumber(
              baselineReplaySummary?.failedTurns ?? baselineReplayDiagnostic?.summary?.failedTurns
            ),
            countsByCategory: baselineReplayDiagnostic?.countsByCategory || {},
            countsByLayer: baselineReplayDiagnostic?.countsByLayer || {}
          }
        : null,
      probe: baselineProbeSummary || baselineProbeDiagnostic
        ? {
            totalFindings: toNumber(
              baselineProbeSummary?.totalFindings ?? baselineProbeDiagnostic?.summary?.totalFindings
            ),
            failedTurns: toNumber(
              baselineProbeSummary?.failedTurns ?? baselineProbeDiagnostic?.summary?.failedTurns
            ),
            countsByCategory: baselineProbeDiagnostic?.countsByCategory || {},
            countsByLayer: baselineProbeDiagnostic?.countsByLayer || {}
          }
        : null
    };
  }

  return {
    sourceType: "none",
    replay: null,
    probe: null
  };
}

function buildStabilityGate({
  label,
  category,
  currentCounts,
  baselineCounts,
  targetRatio
}) {
  const current = toNumber(currentCounts?.[category]);
  const baseline = toNumber(baselineCounts?.[category]);
  const target = baseline > 0 ? Math.floor(baseline * targetRatio * 1000) / 1000 : null;
  const passed = target === null ? current === 0 : current <= target;
  return {
    label,
    category,
    baseline,
    current,
    target,
    passed
  };
}

export function evaluateStabilityGates({ currentReplayCounts = {}, baselineReplayCounts = {} } = {}) {
  return [
    buildStabilityGate({
      label: "topic_loss <= 40% baseline",
      category: "topic_loss",
      currentCounts: currentReplayCounts,
      baselineCounts: baselineReplayCounts,
      targetRatio: 0.4
    }),
    buildStabilityGate({
      label: "loop_reentry <= 30% baseline",
      category: "loop_reentry",
      currentCounts: currentReplayCounts,
      baselineCounts: baselineReplayCounts,
      targetRatio: 0.3
    }),
    buildStabilityGate({
      label: "handoff_too_early <= 30% baseline",
      category: "handoff_too_early",
      currentCounts: currentReplayCounts,
      baselineCounts: baselineReplayCounts,
      targetRatio: 0.3
    }),
    buildStabilityGate({
      label: "quote_intake_reopened <= 20% baseline",
      category: "quote_intake_reopened",
      currentCounts: currentReplayCounts,
      baselineCounts: baselineReplayCounts,
      targetRatio: 0.2
    }),
    {
      label: "runtime_error = 0",
      category: "runtime_error",
      baseline: toNumber(baselineReplayCounts?.runtime_error),
      current: toNumber(currentReplayCounts?.runtime_error),
      target: 0,
      passed: toNumber(currentReplayCounts?.runtime_error) === 0
    }
  ];
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildArchitecturalGuardrails() {
  return {
    hardConstraints: [
      "No resolver hallazgos metiendo heuristicas sueltas en el core runtime.",
      "No introducir logica tenant-specific dentro del runtime general.",
      "No hardcodear palabras o frases de un idioma como source of truth del comportamiento.",
      "No corregir problemas estructurales desde render-outcome, wording final o policy superficial.",
      "No usar la IA como dueña de estado, readiness, topic continuity, quote seed o facts de negocio."
    ],
    allowedModelParticipation: [
      "Mejorar naturalidad y estilo sobre un outcome ya estructurado.",
      "Rewrite liviano sin cambiar contrato, facts ni siguiente paso.",
      "Aclarar ambiguedad real cuando el contrato estructural no alcanza por si solo.",
      "Generar probes o variantes realistas para ampliar la muestra de pruebas.",
      "Resumir y clusterizar hallazgos a partir de corridas reales."
    ],
    separationOfConcerns: {
      core: [
        "Contratos estructurales del runtime",
        "Turn interpretation",
        "Quote seed",
        "Readiness",
        "Loop prevention",
        "Outcome semantics"
      ],
      tenantPolicy: [
        "Topic taxonomy",
        "Quote profiles",
        "Business facts",
        "Wording registry",
        "Aliases y ontologia"
      ],
      model: [
        "Naturalidad",
        "Reformulacion controlada",
        "Clarificacion puntual",
        "Generacion de probes",
        "Resumen de hallazgos"
      ]
    },
    acceptanceRules: [
      "Un fix solo vale si baja el hallazgo real en el chat y no degrada la arquitectura objetivo.",
      "No reemplazar contratos estructurales por prompting libre o respuestas ad hoc.",
      "Toda mejora debe dejar trazabilidad de por que el chat respondio asi.",
      "El mismo pack real debe poder rerunearse y mostrar progreso comparable.",
      "Los cambios de wording no deben alterar decisiones estructurales del core."
    ]
  };
}

export function buildLoopIterationReport({
  loopRunId,
  generatedAt,
  iteration,
  iterationLabel = null,
  replay = {},
  review = {},
  probe = {},
  structuralPlan = null,
  baseline = null,
  commands = {}
} = {}) {
  const replaySummary = replay.summary || {};
  const replayDiagnostic = replay.diagnostic || {};
  const replayReviewSummary = review.summary || {};
  const probeSummary = probe.summary || {};
  const probeDiagnostic = probe.diagnostic || {};
  const probeActionPlan = probe.actionPlan || {};
  const providerAudit = probe.providerAudit || {};

  const replayCategoryCounts = replayDiagnostic.countsByCategory || {};
  const replayLayerCounts = replayDiagnostic.countsByLayer || {};
  const probeCategoryCounts = probeDiagnostic.countsByCategory || {};
  const probeLayerCounts = probeDiagnostic.countsByLayer || {};
  const combinedCategoryCounts = mergeCountMaps(replayCategoryCounts, probeCategoryCounts);
  const combinedLayerCounts = mergeCountMaps(replayLayerCounts, probeLayerCounts);

  const normalizedBaseline = baseline || normalizeBaseline({});
  const baselineReplay = normalizedBaseline.replay || null;
  const baselineProbe = normalizedBaseline.probe || null;
  const stabilityGates = evaluateStabilityGates({
    currentReplayCounts: replayCategoryCounts,
    baselineReplayCounts: baselineReplay?.countsByCategory || {}
  });
  const prioritizedWorkstreams = buildPrioritizedWorkstreams({
    combinedCategoryCounts,
    structuralPlan
  });

  const recommendedScope = prioritizedWorkstreams.slice(0, 3).map((entry) => entry.id);
  const currentReplayMetrics = {
    runId: replaySummary.runId || replayDiagnostic.runId || null,
    totalConversations: toNumber(replaySummary.totalConversations),
    totalEvaluatedTurns: toNumber(replaySummary.totalEvaluatedTurns),
    totalFindings: toNumber(replaySummary.totalFindings),
    failedTurns: toNumber(replaySummary.failedTurns),
    completedConversations: toNumber(replaySummary.completedConversations),
    completedTurns: toNumber(replaySummary.completedTurns),
    countsByCategory: replayCategoryCounts,
    countsByLayer: replayLayerCounts,
    topCategories: sortEntries(replayCategoryCounts, "category").slice(0, 8),
    topLayers: sortEntries(replayLayerCounts, "layer").slice(0, 8)
  };
  const currentProbeMetrics = {
    runId: probeSummary.runId || probeDiagnostic.runId || null,
    totalScenarios: toNumber(probeSummary.totalConversations),
    totalTurns: toNumber(probeSummary.totalEvaluatedTurns),
    totalFindings: toNumber(probeSummary.totalFindings),
    failedTurns: toNumber(probeSummary.failedTurns),
    llmResponseTurns: toNumber(providerAudit.llmResponseTurns),
    deterministicTurns: toNumber(providerAudit.deterministicTurns),
    countsByCategory: probeCategoryCounts,
    countsByLayer: probeLayerCounts,
    topCategories: sortEntries(probeCategoryCounts, "category").slice(0, 8),
    topLayers: sortEntries(probeLayerCounts, "layer").slice(0, 8)
  };

  const deltaVsBaseline = {
    baselineSourceType: normalizedBaseline.sourceType,
    replay: baselineReplay
      ? {
          totalFindingsDelta: currentReplayMetrics.totalFindings - toNumber(baselineReplay.totalFindings),
          failedTurnsDelta: currentReplayMetrics.failedTurns - toNumber(baselineReplay.failedTurns),
          categoryDeltas: buildCountDeltaEntries({
            currentCounts: currentReplayMetrics.countsByCategory,
            baselineCounts: baselineReplay.countsByCategory || {},
            keyName: "category"
          }),
          layerDeltas: buildCountDeltaEntries({
            currentCounts: currentReplayMetrics.countsByLayer,
            baselineCounts: baselineReplay.countsByLayer || {},
            keyName: "layer"
          })
        }
      : null,
    probe: baselineProbe
      ? {
          totalFindingsDelta: currentProbeMetrics.totalFindings - toNumber(baselineProbe.totalFindings),
          failedTurnsDelta: currentProbeMetrics.failedTurns - toNumber(baselineProbe.failedTurns),
          categoryDeltas: buildCountDeltaEntries({
            currentCounts: currentProbeMetrics.countsByCategory,
            baselineCounts: baselineProbe.countsByCategory || {},
            keyName: "category"
          }),
          layerDeltas: buildCountDeltaEntries({
            currentCounts: currentProbeMetrics.countsByLayer,
            baselineCounts: baselineProbe.countsByLayer || {},
            keyName: "layer"
          })
        }
      : null
  };

  const stageStatus =
    currentReplayMetrics.totalFindings > 0 ||
    currentReplayMetrics.failedTurns > 0 ||
    currentProbeMetrics.totalFindings > 0 ||
    currentProbeMetrics.failedTurns > 0
      ? "implementation_required"
      : stabilityGates.every((gate) => gate.passed)
        ? "regression_gate_ready"
        : "rerun_validation";

  return {
    loopRunId,
    generatedAt,
    iteration,
    iterationLabel,
    status: stageStatus,
    objective:
      "Ejecutar replay real + review + probes live, consolidar hallazgos estructurales, planificar remediacion y dejar la siguiente reejecucion preparada sobre el mismo chat real.",
    explicitLoop: [
      "Pruebas sobre el chat real (sin mocks)",
      "Analisis con datos y clustering estructural",
      "Planificacion de ajustes",
      "Implementacion estructural fuera del runner",
      "Generacion de reporte y delta",
      "Rerun del mismo pack sobre el chat real"
    ],
    architecturalGuardrails: buildArchitecturalGuardrails(),
    consolidatedMetrics: {
      replay: currentReplayMetrics,
      review: {
        processedConversations: toNumber(replayReviewSummary.totalProcessedConversations),
        processedWithFindings: toNumber(replayReviewSummary.processedWithFindings),
        processedWithoutFindings: toNumber(replayReviewSummary.processedWithoutFindings),
        totalFindings: toNumber(replayReviewSummary.totalFindings)
      },
      probe: currentProbeMetrics,
      combined: {
        countsByCategory: combinedCategoryCounts,
        countsByLayer: combinedLayerCounts,
        topCategories: sortEntries(combinedCategoryCounts, "category").slice(0, 10),
        topLayers: sortEntries(combinedLayerCounts, "layer").slice(0, 10)
      }
    },
    baseline: normalizedBaseline,
    deltaVsBaseline,
    stabilityGates,
    prioritizedWorkstreams,
    recommendedScope,
    nextAction:
      stageStatus === "implementation_required"
        ? normalizedBaseline.sourceType === "none"
          ? "Congelar esta corrida real como baseline de referencia, implementar fixes estructurales y rerunear el mismo loop contra el chat real."
          : "Implementar fixes estructurales en los workstreams priorizados y rerunear el mismo loop contra el chat real."
        : "Reejecutar el mismo loop para validar estabilidad o promover nuevos probes a regresion.",
    provenance: {
      structuralPlanPath: structuralPlan?.path || null,
      replayRunDir: replay.runDir || null,
      probeRunDir: probe.runDir || null,
      replayReviewDir: review.outputDir || null
    },
    commands: {
      replay: commands.replay || null,
      review: commands.review || null,
      probe: commands.probe || null,
      rerun: commands.rerun || null
    },
    replayTopProblems: Array.isArray(replayDiagnostic.topProblems) ? replayDiagnostic.topProblems : [],
    probePrioritizedActions: Array.isArray(probeActionPlan.prioritizedActions)
      ? probeActionPlan.prioritizedActions
      : [],
    notes: [
      "El runner no automatiza cambios de codigo; automatiza la medicion, el analisis y el backlog estructural por iteracion.",
      "La reimplementacion debe ocurrir sobre el core antes del siguiente rerun, sin introducir parches tenant-specific en runtime.",
      "Las palabras o frases hardcodeadas por idioma deben quedar fuera del core, en policy/registry."
    ].map(compactText)
  };
}

export function buildLoopIterationMarkdown(report) {
  const lines = [
    "# Real Chat Structural Remediation Loop",
    "",
    `Loop run ID: ${report.loopRunId}`,
    `Generated at: ${report.generatedAt}`,
    `Iteration: ${report.iteration}${report.iterationLabel ? ` (${report.iterationLabel})` : ""}`,
    `Status: ${report.status}`,
    "",
    "## Explicit Loop",
    "",
    ...report.explicitLoop.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Current Measurement",
    "",
    `- Replay conversations: ${report.consolidatedMetrics.replay.totalConversations}`,
    `- Replay turns: ${report.consolidatedMetrics.replay.totalEvaluatedTurns}`,
    `- Replay findings: ${report.consolidatedMetrics.replay.totalFindings}`,
    `- Replay failed turns: ${report.consolidatedMetrics.replay.failedTurns}`,
    `- Probe scenarios: ${report.consolidatedMetrics.probe.totalScenarios}`,
    `- Probe turns: ${report.consolidatedMetrics.probe.totalTurns}`,
    `- Probe findings: ${report.consolidatedMetrics.probe.totalFindings}`,
    `- Probe failed turns: ${report.consolidatedMetrics.probe.failedTurns}`,
    `- Probe llm_response turns: ${report.consolidatedMetrics.probe.llmResponseTurns}`,
    `- Probe deterministic turns: ${report.consolidatedMetrics.probe.deterministicTurns}`,
    "",
    "## Combined Top Categories",
    "",
    ...report.consolidatedMetrics.combined.topCategories.map(
      (entry) => `- ${entry.category}: ${entry.count}`
    ),
    "",
    "## Combined Top Layers",
    "",
    ...report.consolidatedMetrics.combined.topLayers.map(
      (entry) => `- ${entry.layer}: ${entry.count}`
    ),
    "",
    "## Delta Vs Baseline",
    ""
  ];

  if (report.deltaVsBaseline.replay) {
    lines.push(`- Baseline source: ${report.deltaVsBaseline.baselineSourceType}`);
    lines.push(`- Replay findings delta: ${report.deltaVsBaseline.replay.totalFindingsDelta}`);
    lines.push(`- Replay failed turns delta: ${report.deltaVsBaseline.replay.failedTurnsDelta}`);
    lines.push("");
    lines.push("Replay category deltas:");
    for (const entry of report.deltaVsBaseline.replay.categoryDeltas.slice(0, 10)) {
      lines.push(
        `- ${entry.category}: current=${entry.currentCount}, baseline=${entry.baselineCount}, delta=${entry.delta}`
      );
    }
    lines.push("");
  } else {
    lines.push("- No replay baseline available yet.");
    lines.push("");
  }

  lines.push("## Stability Gates");
  lines.push("");
  for (const gate of report.stabilityGates) {
    lines.push(
      `- [${gate.passed ? "x" : " "}] ${gate.label}: current=${gate.current}, baseline=${gate.baseline}, target=${gate.target ?? "n/a"}`
    );
  }
  lines.push("");
  lines.push("## Prioritized Workstreams");
  lines.push("");

  for (const workstream of report.prioritizedWorkstreams) {
    lines.push(`### ${workstream.id} ${workstream.name} (${workstream.priority})`);
    lines.push("");
    lines.push(`- Score: ${workstream.score}`);
    lines.push(
      `- Evidence: ${workstream.evidenceCategories.map((entry) => `${entry.category}(${entry.count})`).join(", ")}`
    );
    if (workstream.problem) {
      lines.push(`- Problem: ${workstream.problem}`);
    }
    if (workstream.implementation.length > 0) {
      lines.push("- Implementation focus:");
      for (const item of workstream.implementation) {
        lines.push(`  - ${item}`);
      }
    }
    if (workstream.acceptance.length > 0) {
      lines.push("- Acceptance:");
      for (const item of workstream.acceptance) {
        lines.push(`  - ${item}`);
      }
    }
    lines.push("");
  }

  lines.push("## Recommended Scope");
  lines.push("");
  lines.push(`- ${report.recommendedScope.join(", ") || "No workstreams prioritized."}`);
  lines.push("");
  lines.push("## Next Action");
  lines.push("");
  lines.push(`- ${report.nextAction}`);
  lines.push("");
  lines.push("## Architectural Guardrails");
  lines.push("");
  lines.push("Hard constraints:");
  for (const item of report.architecturalGuardrails?.hardConstraints || []) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("Allowed model participation:");
  for (const item of report.architecturalGuardrails?.allowedModelParticipation || []) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("Separation of concerns:");
  lines.push(`- Core: ${(report.architecturalGuardrails?.separationOfConcerns?.core || []).join(", ")}`);
  lines.push(
    `- Tenant/policy: ${(report.architecturalGuardrails?.separationOfConcerns?.tenantPolicy || []).join(", ")}`
  );
  lines.push(`- Model: ${(report.architecturalGuardrails?.separationOfConcerns?.model || []).join(", ")}`);
  lines.push("");
  lines.push("Acceptance rules:");
  for (const item of report.architecturalGuardrails?.acceptanceRules || []) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## Commands");
  lines.push("");
  if (report.commands.replay) {
    lines.push(`- Replay: \`${report.commands.replay}\``);
  }
  if (report.commands.review) {
    lines.push(`- Review: \`${report.commands.review}\``);
  }
  if (report.commands.probe) {
    lines.push(`- Probe: \`${report.commands.probe}\``);
  }
  if (report.commands.rerun) {
    lines.push(`- Rerun: \`${report.commands.rerun}\``);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}
