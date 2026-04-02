import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildReplayTranscriptConversation,
  cleanMessageText,
  readJson,
  renderConversationText,
  writeJson
} from "./real-corpus-artifacts-lib.mjs";

function compactText(value) {
  return cleanMessageText(String(value || "").replace(/\s+/g, " "));
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toTraceConversations(trace) {
  if (Array.isArray(trace)) {
    return trace;
  }
  if (Array.isArray(trace?.conversations)) {
    return trace.conversations;
  }
  if (Array.isArray(trace?.trace)) {
    return trace.trace;
  }
  return [];
}

function indexProbeConversationsByScenario(traceConversations) {
  const map = new Map();

  for (const conversation of traceConversations) {
    const scenarioId =
      normalizeArray(conversation?.turns)
        .map((turn) => turn?.probe?.scenarioId)
        .find(Boolean) || null;

    if (!scenarioId) {
      continue;
    }

    const bucket = map.get(scenarioId) || [];
    bucket.push(conversation);
    map.set(scenarioId, bucket);
  }

  return map;
}

function summarizeConversationCategories(conversation) {
  const counts = {};
  for (const turn of normalizeArray(conversation?.turns)) {
    for (const finding of normalizeArray(turn?.findings)) {
      const key = typeof finding?.taxonomy === "string" ? finding.taxonomy : null;
      if (!key) {
        continue;
      }
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([category, count]) => ({ category, count }));
}

function buildTurnDecisionTrace(turn) {
  const audit = turn?.response?.auditPayload || turn?.webchat?.aiState?.audit || null;
  const interpretation = audit?.turnInterpretation || null;
  const quoteContext = interpretation?.quoteContext || null;

  return {
    semanticTurnId: turn?.semanticTurnId || null,
    semanticTurnIndex: turn?.semanticTurnIndex ?? null,
    userText: cleanMessageText(turn?.user?.text || ""),
    responseText: cleanMessageText(turn?.responseText || turn?.response?.finalUserText || ""),
    stage: audit?.stage || null,
    intentKey: audit?.intentKey || interpretation?.intent?.key || null,
    actionKey: audit?.actionKey || null,
    grounded: audit?.grounded ?? null,
    needsHuman: audit?.needsHuman ?? turn?.response?.needsHuman ?? null,
    decisionPath: normalizeArray(audit?.decisionPath),
    followUp: interpretation?.followUp || null,
    topic: interpretation?.topic || null,
    activeThreadKey: interpretation?.threadResolution?.activeThreadKey || null,
    quoteContext: quoteContext
      ? {
          topicLabel: quoteContext.topicLabel || null,
          profileKey: quoteContext.profileKey || null,
          missingFields: normalizeArray(quoteContext.missingFields),
          requiredFields: normalizeArray(quoteContext.requiredFields),
          completionStatus: quoteContext.completionStatus || null,
          closureMode: quoteContext.closureMode || null,
          quantity: quoteContext.quantity || null,
          measurements: quoteContext.measurements || null
        }
      : null,
    findings: normalizeArray(turn?.findings).map((finding) => ({
      taxonomy: finding?.taxonomy || null,
      severity: finding?.severity || null,
      symptom: finding?.symptom || null,
      likelyLayer: finding?.likely_layer || null
    }))
  };
}

function buildScenarioExecution(conversation) {
  const transcript = buildReplayTranscriptConversation(conversation, {
    customerLabel: "Cliente",
    agentLabel: "Chat"
  });

  return {
    conversationId: conversation?.conversationId || null,
    replayConversationId: conversation?.replayConversationId || null,
    evaluatedTurnCount: conversation?.evaluatedTurnCount ?? normalizeArray(conversation?.turns).length,
    findingCount: conversation?.findingCount ?? 0,
    failedTurnCount: conversation?.failedTurnCount ?? 0,
    tags: normalizeArray(
      normalizeArray(conversation?.turns)
        .flatMap((turn) => normalizeArray(turn?.probe?.tags))
        .filter(Boolean)
    ),
    variables:
      normalizeArray(conversation?.turns)
        .map((turn) => turn?.probe?.variables)
        .find((value) => value && typeof value === "object") || {},
    findingsByCategory: summarizeConversationCategories(conversation),
    transcript: transcript.mergedTurns,
    transcriptText: renderConversationText(
      conversation?.conversationId || "unknown-conversation",
      transcript.mergedTurns
    ),
    decisionTrace: normalizeArray(conversation?.turns).map(buildTurnDecisionTrace)
  };
}

function buildScenarioResource(scenario, executions) {
  const simplifiedSteps = normalizeArray(scenario?.steps).map((step, index) => ({
    stepIndex: index + 1,
    text: cleanMessageText(step?.text || ""),
    expect: step?.expect || null
  }));

  return {
    scenarioId: scenario?.id || null,
    title: scenario?.title || null,
    goal: scenario?.goal || null,
    focus: scenario?.focus || null,
    tags: normalizeArray(scenario?.tags),
    metadata: scenario?.metadata || {},
    defaults: scenario?.defaults || null,
    stepCount: simplifiedSteps.length,
    steps: simplifiedSteps,
    executions
  };
}

function renderScenarioPlainText(resource) {
  const lines = [
    `ESCENARIO: ${resource.scenarioId || "sin-id"}`,
    `Titulo: ${resource.title || "sin titulo"}`,
    `Goal: ${resource.goal || "unknown"}`,
    `Focus: ${resource.focus || "n/a"}`,
    `Tags: ${resource.tags.join(", ") || "none"}`,
    `Source metadata: ${JSON.stringify(resource.metadata || {})}`,
    "",
    "Definicion del escenario:"
  ];

  for (const step of resource.steps) {
    lines.push(`Cliente: ${step.text || "[sin texto]"}`);
    if (step.expect) {
      lines.push(`Expect: ${JSON.stringify(step.expect)}`);
    }
  }

  if (resource.executions.length === 0) {
    lines.push("");
    lines.push("Sin ejecuciones asociadas en el probe run.");
    return `${lines.join("\n")}\n`;
  }

  for (const execution of resource.executions) {
    lines.push("");
    lines.push(`Ejecucion: ${execution.conversationId || "unknown-conversation"}`);
    lines.push(
      `Resumen: turns=${execution.evaluatedTurnCount} findings=${execution.findingCount} failed=${execution.failedTurnCount}`
    );
    for (const turn of execution.transcript) {
      lines.push(`${turn.speaker}: ${turn.messages.join("\n")}`);
    }
    if (execution.findingsByCategory.length > 0) {
      lines.push(
        `Categorias: ${execution.findingsByCategory.map((entry) => `${entry.category}(${entry.count})`).join(", ")}`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderScenarioNaturalLanguage(resource) {
  const lines = [
    `## ${resource.title || resource.scenarioId || "Escenario"}`,
    "",
    `- Scenario ID: ${resource.scenarioId || "n/a"}`,
    `- Goal: ${resource.goal || "unknown"}`,
    `- Focus: ${resource.focus || "n/a"}`,
    `- Tags: ${resource.tags.join(", ") || "none"}`,
    `- Source metadata: ${JSON.stringify(resource.metadata || {})}`,
    "",
    "### Flujo esperado",
    ""
  ];

  for (const step of resource.steps) {
    lines.push(`Cliente ${step.stepIndex}: ${step.text || "[sin texto]"}`);
    if (step.expect) {
      lines.push(`Expectativa ${step.stepIndex}: ${JSON.stringify(step.expect)}`);
    }
    lines.push("");
  }

  if (resource.executions.length === 0) {
    lines.push("### Ejecucion observada");
    lines.push("");
    lines.push("No hay una ejecucion asociada en el probe run para este escenario.");
    lines.push("");
    return lines.join("\n");
  }

  resource.executions.forEach((execution, executionIndex) => {
    lines.push(`### Ejecucion ${executionIndex + 1}`);
    lines.push("");
    lines.push(`- Conversation ID: ${execution.conversationId || "n/a"}`);
    lines.push(
      `- Resultado: turns=${execution.evaluatedTurnCount}, findings=${execution.findingCount}, failed=${execution.failedTurnCount}`
    );
    if (execution.findingsByCategory.length > 0) {
      lines.push(
        `- Categorias: ${execution.findingsByCategory.map((entry) => `${entry.category}(${entry.count})`).join(", ")}`
      );
    } else {
      lines.push("- Categorias: sin hallazgos");
    }
    lines.push("");
    lines.push("Transcripcion:");
    lines.push("");
    for (const turn of execution.transcript) {
      lines.push(`**${turn.speaker}:** ${turn.messages.join(" ")}`);
      lines.push("");
    }
    lines.push("Decision trace resumido:");
    lines.push("");
    for (const decision of execution.decisionTrace) {
      const decisionSummary = [
        `turn=${decision.semanticTurnIndex ?? "?"}`,
        `stage=${decision.stage || "unknown"}`,
        `intent=${decision.intentKey || "unknown"}`,
        decision.actionKey ? `action=${decision.actionKey}` : null,
        decision.topic?.label ? `topic=${decision.topic.label}` : null,
        decision.activeThreadKey ? `thread=${decision.activeThreadKey}` : null
      ]
        .filter(Boolean)
        .join(" | ");
      lines.push(`- ${decisionSummary}`);
      if (decision.findings.length > 0) {
        lines.push(
          `- findings: ${decision.findings.map((finding) => `${finding.taxonomy}:${finding.severity}`).join(", ")}`
        );
      }
    }
    lines.push("");
  });

  return lines.join("\n");
}

function renderPackPlainText(packResource) {
  const sections = [
    `PACK: ${packResource.packKey}`,
    `Titulo: ${packResource.title || "sin titulo"}`,
    `Path fuente: ${packResource.sourcePath}`,
    `Escenarios: ${packResource.scenarioCount}`,
    `Escenarios con ejecucion: ${packResource.executedScenarioCount}`,
    ""
  ];

  for (const scenario of packResource.scenarios) {
    sections.push(renderScenarioPlainText(scenario));
  }

  return `${sections.join("\n")}\n`;
}

function renderPackReadableMarkdown(packResource) {
  const lines = [
    `# ${packResource.title || packResource.packKey}`,
    "",
    `- Pack key: ${packResource.packKey}`,
    `- Source path: ${packResource.sourcePath}`,
    `- Scenario count: ${packResource.scenarioCount}`,
    `- Executed scenario count: ${packResource.executedScenarioCount}`,
    ""
  ];

  for (const scenario of packResource.scenarios) {
    lines.push(renderScenarioNaturalLanguage(scenario));
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function buildPackResource({ packKey, packPath, playbook, executionsByScenario }) {
  const scenarios = normalizeArray(playbook?.scenarios).map((scenario) =>
    buildScenarioResource(scenario, executionsByScenario.get(scenario?.id) || [])
  );

  return {
    generatedAt: new Date().toISOString(),
    packKey,
    playbookId: playbook?.playbookId || null,
    title: playbook?.title || null,
    sourcePath: packPath,
    defaults: playbook?.defaults || {},
    scenarioCount: scenarios.length,
    executedScenarioCount: scenarios.filter((scenario) => scenario.executions.length > 0).length,
    scenarios
  };
}

export async function exportRealChatRemediationResources({
  loopRunDir,
  outputDir = null
} = {}) {
  if (!loopRunDir) {
    throw new Error("loop_run_dir_required");
  }

  const absoluteLoopRunDir = path.resolve(loopRunDir);
  const absoluteOutputDir =
    outputDir || path.join(absoluteLoopRunDir, "resource-exports");

  const run = await readJson(path.join(absoluteLoopRunDir, "run.json"));
  const probeRunDir = path.resolve(run?.probeRunDir || "");
  const probeTrace = await readJson(path.join(probeRunDir, "trace.json"));
  const traceConversations = toTraceConversations(probeTrace);
  const groupedExecutions = indexProbeConversationsByScenario(traceConversations);

  const packDefinitions = [
    {
      packKey: "base-pack",
      sourcePath: run?.baseProbePlaybookPath || null
    },
    {
      packKey: "new-findings-pack",
      sourcePath: path.join(absoluteLoopRunDir, "corpus-derived-probes", "new-findings-pack.json")
    },
    {
      packKey: "regression-pack",
      sourcePath: run?.regressionProbePlaybookPath || null
    },
    {
      packKey: "effective-pack",
      sourcePath: run?.generatedProbePlaybookPath || null
    }
  ].filter((entry) => entry.sourcePath);

  await mkdir(absoluteOutputDir, { recursive: true });

  const resources = [];

  for (const definition of packDefinitions) {
    const packPath = path.resolve(definition.sourcePath);
    const playbook = await readJson(packPath);
    const packResource = buildPackResource({
      packKey: definition.packKey,
      packPath,
      playbook,
      executionsByScenario: groupedExecutions
    });

    await writeJson(
      path.join(absoluteOutputDir, `${definition.packKey}.extended.json`),
      packResource
    );
    await writeFile(
      path.join(absoluteOutputDir, `${definition.packKey}.plain.txt`),
      renderPackPlainText(packResource),
      "utf8"
    );
    await writeFile(
      path.join(absoluteOutputDir, `${definition.packKey}.readable.md`),
      renderPackReadableMarkdown(packResource),
      "utf8"
    );

    resources.push({
      packKey: definition.packKey,
      sourcePath: packPath,
      extendedJsonPath: path.join(absoluteOutputDir, `${definition.packKey}.extended.json`),
      plainTextPath: path.join(absoluteOutputDir, `${definition.packKey}.plain.txt`),
      readableMarkdownPath: path.join(absoluteOutputDir, `${definition.packKey}.readable.md`)
    });
  }

  const index = {
    generatedAt: new Date().toISOString(),
    loopRunDir: absoluteLoopRunDir,
    probeRunDir,
    outputDir: absoluteOutputDir,
    resources
  };

  await writeJson(path.join(absoluteOutputDir, "index.json"), index);
  await writeFile(
    path.join(absoluteOutputDir, "index.md"),
    [
      "# Remediation Loop Resource Exports",
      "",
      `- Loop run dir: ${absoluteLoopRunDir}`,
      `- Probe run dir: ${probeRunDir}`,
      `- Output dir: ${absoluteOutputDir}`,
      "",
      ...resources.flatMap((resource) => [
        `## ${resource.packKey}`,
        "",
        `- Source path: ${resource.sourcePath}`,
        `- Extended JSON: ${resource.extendedJsonPath}`,
        `- Plain text: ${resource.plainTextPath}`,
        `- Readable markdown: ${resource.readableMarkdownPath}`,
        ""
      ])
    ].join("\n"),
    "utf8"
  );

  return index;
}
