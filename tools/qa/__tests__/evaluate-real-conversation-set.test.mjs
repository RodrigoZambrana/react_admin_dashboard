import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import {
  evaluateRealConversationSet,
  writeRealConversationSetTemplate
} from "../evaluate-real-conversation-set.mjs";

test("writeRealConversationSetTemplate writes a reusable input template", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "qa-real-set-template-"));
  const templatePath = path.join(tmpDir, "real-conversation-set.template.json");

  const writtenPath = await writeRealConversationSetTemplate(templatePath);
  const template = JSON.parse(await readFile(templatePath, "utf8"));

  assert.equal(writtenPath, templatePath);
  assert.equal(template.name, "real-conversation-set-template");
  assert.ok(Array.isArray(template.scenarios));
  assert.ok(template.scenarios.length >= 1);
});

test("evaluateRealConversationSet compares expected output against runtime responses", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "qa-real-set-eval-"));
  const inputPath = path.join(tmpDir, "input.json");
  const playbookPath = path.join(tmpDir, "playbook.md");
  const outputPath = path.join(tmpDir, "report.md");
  const metadataPath = path.join(tmpDir, "report.json");

  await writeFile(
    playbookPath,
    "# Playbook\n\nResponder corto, natural y con un objetivo por turno.\n",
    "utf8"
  );

  await writeFile(
    inputPath,
    JSON.stringify(
      {
        name: "sample-real-set",
        scenarios: [
          {
            id: "payment-switch",
            title: "Cambio a medios de pago",
            turns: [
              {
                user: "que medios de pagos aceptan",
                expected: {
                  include: ["efectivo", "transferencia", "tarjetas"],
                  avoid: ["asesor del equipo"]
                }
              }
            ]
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );

  const result = await evaluateRealConversationSet({
    inputPath,
    playbookPath,
    outputPath,
    metadataPath
  });

  const report = await readFile(outputPath, "utf8");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));

  assert.equal(result.summary.totalScenarios, 1);
  assert.match(report, /Cambio a medios de pago/);
  assert.match(report, /efectivo, transferencia bancaria y tarjetas/i);
  assert.equal(metadata.summary.totalScenarios, 1);
  assert.equal(metadata.scenarios[0].id, "payment-switch");
});
