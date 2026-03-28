#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  createSimulationRuntime,
  runConversation
} from "./generate-simulated-runtime-conversations.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const DEFAULT_PLAYBOOK_PATH = path.join(
  os.homedir(),
  "Downloads",
  "knowledge-inputs",
  "customer-response-playbook.md"
);
const DEFAULT_TEMPLATE_PATH = path.join(
  os.homedir(),
  "Downloads",
  "knowledge-inputs",
  "real-conversation-set.template.json"
);
const DEFAULT_OUTPUT_DIR = path.join(
  repoRoot,
  ".qa",
  "external-real-conversations",
  "whatsapp",
  "generated"
);
const DEFAULT_OUTPUT_PATH = path.join(DEFAULT_OUTPUT_DIR, "runtime-real-set-evaluation.md");
const DEFAULT_METADATA_PATH = path.join(
  DEFAULT_OUTPUT_DIR,
  "runtime-real-set-evaluation.json"
);

const TEMPLATE = {
  name: "real-conversation-set-template",
  description:
    "Set de conversaciones reales transformadas a escenarios evaluables contra el runtime.",
  scenarios: [
    {
      id: "pricing_to_payment",
      title: "Consulta de precio con typo y cambio a medios de pago",
      notes:
        "Usar mensajes reales anonimizados. Las expectativas deben validar forma de respuesta, no facts exactos del negocio.",
      turns: [
        {
          user: "precios cortnas",
          expected: {
            notes: "Debe pedir el dato mínimo faltante y no caer en fallback técnico.",
            include: ["precio", "producto o medida"],
            avoid: ["asesor del equipo", "no pude completar"]
          }
        },
        {
          user: "roller blackout",
          expected: {
            notes: "Debe mantener continuidad sobre el producto.",
            include: ["roller blackout"],
            avoid: ["medios de pago"]
          }
        },
        {
          user: "que medios de pagos aceptan",
          expected: {
            notes: "Debe cambiar de hilo y responder la FAQ operativa sin arrastrar el contexto de producto.",
            include: ["efectivo", "transferencia", "tarjetas"],
            avoid: ["roller blackout", "screen"]
          }
        }
      ]
    }
  ]
};

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const countSentences = (value) =>
  String(value || "")
    .split(/[.!?]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean).length;

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toRegExp = (value) => {
  if (value instanceof RegExp) {
    return value;
  }
  const raw = String(value || "").trim();
  const regexMatch = raw.match(/^\/([\s\S]+)\/([gimsuy]*)$/u);
  if (regexMatch) {
    return new RegExp(regexMatch[1], regexMatch[2]);
  }
  return new RegExp(escapeRegExp(raw), "i");
};

const compileExpected = (expected = {}) => ({
  notes: expected.notes ?? null,
  include: Array.isArray(expected.include) ? expected.include.map(toRegExp) : [],
  avoid: Array.isArray(expected.avoid) ? expected.avoid.map(toRegExp) : []
});

const evaluateTurn = (responseText, expected = {}) => {
  const compiled = compileExpected(expected);
  const text = String(responseText || "");
  const checks = [
    ...compiled.include.map((pattern) => ({
      label: `include ${pattern.toString()}`,
      ok: pattern.test(text)
    })),
    ...compiled.avoid.map((pattern) => ({
      label: `avoid ${pattern.toString()}`,
      ok: !pattern.test(text)
    }))
  ];
  const passed = checks.filter((entry) => entry.ok).length;
  const total = checks.length;
  return {
    notes: compiled.notes,
    passed,
    total,
    score: total ? Math.round((passed * 100) / total) : 100,
    responseStats: {
      chars: text.length,
      sentences: countSentences(text)
    },
    checks
  };
};

const evaluateScenario = (responses, turns) => {
  const turnResults = responses.map((response, index) =>
    evaluateTurn(response.finalUserText || response.text || "", turns[index]?.expected || {})
  );
  const averageScore = turnResults.length
    ? Math.round(
        turnResults.reduce((total, result) => total + result.score, 0) / turnResults.length
      )
    : 100;
  return { averageScore, turnResults };
};

const compareModes = (baseScore, assistedScore) => {
  const delta = assistedScore - baseScore;
  if (delta >= 8) {
    return `mejora clara (+${delta})`;
  }
  if (delta >= 3) {
    return `mejora moderada (+${delta})`;
  }
  if (delta > 0) {
    return `mejora leve (+${delta})`;
  }
  if (delta === 0) {
    return "sin cambio material";
  }
  return `regresión (${delta})`;
};

const buildMarkdown = ({ inputPath, playbookPath, setName, summary, scenarios }) => {
  const lines = [
    "# Evaluación de Set Conversacional Real",
    "",
    `Generado: ${new Date().toISOString()}`,
    `Set evaluado: ${setName}`,
    `Input: ${inputPath}`,
    `Playbook: ${playbookPath}`,
    "",
    "## Resumen",
    "",
    `- Escenarios: ${summary.totalScenarios}.`,
    `- Score promedio base: ${summary.baseAverage}.`,
    `- Score promedio playbook-assisted: ${summary.assistedAverage}.`,
    `- Diferencia promedio: ${summary.deltaAverage >= 0 ? "+" : ""}${summary.deltaAverage}.`,
    ""
  ];

  scenarios.forEach((scenario, scenarioIndex) => {
    lines.push(`## ${scenarioIndex + 1}. ${scenario.title}`);
    lines.push("");
    if (scenario.notes) {
      lines.push(`Notas del caso: ${scenario.notes}`);
      lines.push("");
    }
    lines.push(`Resultado comparativo: ${scenario.comparison}.`);
    lines.push(
      `Scores: base ${scenario.base.evaluation.averageScore} / playbook-assisted ${scenario.assisted.evaluation.averageScore}.`
    );
    lines.push("");
    scenario.turns.forEach((turn, turnIndex) => {
      const baseText =
        scenario.base.responses[turnIndex].finalUserText || scenario.base.responses[turnIndex].text || "";
      const assistedText =
        scenario.assisted.responses[turnIndex].finalUserText ||
        scenario.assisted.responses[turnIndex].text ||
        "";
      lines.push(`### Turno ${turnIndex + 1}`);
      lines.push("");
      lines.push(`Usuario: ${turn.user}`);
      if (turn.expected?.notes) {
        lines.push(`Esperado: ${turn.expected.notes}`);
      }
      lines.push(`Base: ${baseText}`);
      lines.push(
        `Checks base: ${scenario.base.evaluation.turnResults[turnIndex].score}/100`
      );
      lines.push(`Playbook-assisted: ${assistedText}`);
      lines.push(
        `Checks playbook-assisted: ${scenario.assisted.evaluation.turnResults[turnIndex].score}/100`
      );
      lines.push("");
    });
  });

  return lines.join("\n");
};

export const writeRealConversationSetTemplate = async (templatePath = DEFAULT_TEMPLATE_PATH) => {
  await mkdir(path.dirname(templatePath), { recursive: true });
  await writeFile(templatePath, JSON.stringify(TEMPLATE, null, 2), "utf8");
  return templatePath;
};

export const evaluateRealConversationSet = async ({
  inputPath,
  playbookPath = DEFAULT_PLAYBOOK_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
  metadataPath = DEFAULT_METADATA_PATH
}) => {
  if (!inputPath) {
    throw new Error("input_path_required");
  }

  const [setContent, playbookContent] = await Promise.all([
    readFile(inputPath, "utf8"),
    readFile(playbookPath, "utf8")
  ]);

  const parsed = JSON.parse(setContent);
  const scenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
  const results = [];

  for (const scenario of scenarios) {
    const turns = Array.isArray(scenario.turns) ? scenario.turns : [];
    const turnTexts = turns.map((turn) => turn.user);

    const baseRuntime = await createSimulationRuntime({
      playbookContent,
      rewriteEnabled: false
    });
    const assistedRuntime = await createSimulationRuntime({
      playbookContent,
      rewriteEnabled: true
    });

    const [baseResponses, assistedResponses] = await Promise.all([
      runConversation({
        runtime: baseRuntime.runtime,
        conversationId: `real-set-${scenario.id}-base`,
        turns: turnTexts
      }),
      runConversation({
        runtime: assistedRuntime.runtime,
        conversationId: `real-set-${scenario.id}-assisted`,
        turns: turnTexts
      })
    ]);

    const baseEvaluation = evaluateScenario(baseResponses, turns);
    const assistedEvaluation = evaluateScenario(assistedResponses, turns);

    results.push({
      id: scenario.id,
      title: scenario.title,
      notes: scenario.notes ?? null,
      turns,
      base: {
        responses: baseResponses.map((response) => ({
          text: response.text,
          finalUserText: response.finalUserText,
          intentKey: response.audit?.intentKey ?? response.auditPayload?.intentKey ?? null
        })),
        evaluation: baseEvaluation
      },
      assisted: {
        responses: assistedResponses.map((response) => ({
          text: response.text,
          finalUserText: response.finalUserText,
          intentKey: response.audit?.intentKey ?? response.auditPayload?.intentKey ?? null
        })),
        evaluation: assistedEvaluation
      },
      comparison: compareModes(baseEvaluation.averageScore, assistedEvaluation.averageScore)
    });
  }

  const summary = {
    totalScenarios: results.length,
    baseAverage: results.length
      ? Math.round(results.reduce((total, entry) => total + entry.base.evaluation.averageScore, 0) / results.length)
      : 100,
    assistedAverage: results.length
      ? Math.round(
          results.reduce((total, entry) => total + entry.assisted.evaluation.averageScore, 0) /
            results.length
        )
      : 100
  };
  summary.deltaAverage = summary.assistedAverage - summary.baseAverage;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    buildMarkdown({
      inputPath,
      playbookPath,
      setName: parsed.name || path.basename(inputPath),
      summary,
      scenarios: results
    }),
    "utf8"
  );

  if (metadataPath) {
    await mkdir(path.dirname(metadataPath), { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          inputPath,
          playbookPath,
          summary,
          scenarios: results
        },
        null,
        2
      ),
      "utf8"
    );
  }

  return {
    inputPath,
    playbookPath,
    outputPath,
    metadataPath,
    summary
  };
};

const parseArgs = (argv) => {
  const options = {
    inputPath: null,
    playbookPath: DEFAULT_PLAYBOOK_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    metadataPath: DEFAULT_METADATA_PATH,
    writeTemplate: false,
    templatePath: DEFAULT_TEMPLATE_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") {
      options.inputPath = argv[index + 1] ?? options.inputPath;
      index += 1;
      continue;
    }
    if (arg.startsWith("--input=")) {
      options.inputPath = arg.slice("--input=".length);
      continue;
    }
    if (arg === "--playbook-path") {
      options.playbookPath = argv[index + 1] ?? options.playbookPath;
      index += 1;
      continue;
    }
    if (arg.startsWith("--playbook-path=")) {
      options.playbookPath = arg.slice("--playbook-path=".length);
      continue;
    }
    if (arg === "--output-path") {
      options.outputPath = argv[index + 1] ?? options.outputPath;
      index += 1;
      continue;
    }
    if (arg.startsWith("--output-path=")) {
      options.outputPath = arg.slice("--output-path=".length);
      continue;
    }
    if (arg === "--metadata-path") {
      options.metadataPath = argv[index + 1] ?? options.metadataPath;
      index += 1;
      continue;
    }
    if (arg.startsWith("--metadata-path=")) {
      options.metadataPath = arg.slice("--metadata-path=".length);
      continue;
    }
    if (arg === "--template-path") {
      options.templatePath = argv[index + 1] ?? options.templatePath;
      index += 1;
      continue;
    }
    if (arg.startsWith("--template-path=")) {
      options.templatePath = arg.slice("--template-path=".length);
      continue;
    }
    if (arg === "--write-template") {
      options.writeTemplate = true;
      continue;
    }
    if (arg === "--no-metadata") {
      options.metadataPath = null;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: node tools/qa/evaluate-real-conversation-set.mjs [options]",
          "",
          "Options:",
          "  --input <path>           JSON file with real conversation scenarios.",
          "  --playbook-path <path>   Playbook markdown used for assisted rewrite.",
          "  --output-path <path>     Markdown output report.",
          "  --metadata-path <path>   JSON output report.",
          "  --write-template         Write a template JSON file and exit.",
          "  --template-path <path>   Target path for the template JSON."
        ].join("\n")
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const isDirectExecution = () => {
  const entryPath = process.argv[1];
  if (!entryPath) {
    return false;
  }
  return path.resolve(entryPath) === path.resolve(new URL(import.meta.url).pathname);
};

if (isDirectExecution()) {
  const options = parseArgs(process.argv.slice(2));
  const runner = options.writeTemplate
    ? writeRealConversationSetTemplate(options.templatePath).then((templatePath) => ({
        templatePath
      }))
    : evaluateRealConversationSet(options);

  runner
    .then((result) => {
      console.log(JSON.stringify({ status: "ok", ...result }, null, 2));
    })
    .catch((error) => {
      console.error(
        JSON.stringify(
          {
            status: "failed",
            error: error?.message || String(error)
          },
          null,
          2
        )
      );
      process.exit(1);
    });
}
