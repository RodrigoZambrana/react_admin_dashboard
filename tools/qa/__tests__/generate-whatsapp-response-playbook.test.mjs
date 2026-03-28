import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { generateWhatsAppResponsePlaybook } from "../generate-whatsapp-response-playbook.mjs";

test("generateWhatsAppResponsePlaybook emits a reusable markdown playbook from corpus outputs", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "qa-playbook-"));
  const corpusDir = path.join(tmpDir, "corpus");
  const manifestsDir = path.join(corpusDir, "manifests");
  const outputPath = path.join(tmpDir, "generated", "customer-response-playbook.md");
  const metadataPath = path.join(tmpDir, "generated", "customer-response-playbook.meta.json");

  await mkdir(manifestsDir, { recursive: true });

  const manifestPath = path.join(manifestsDir, "sample.json");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        conversationId: "sample",
        turns: [
          {
            index: 1,
            authorRole: "customer",
            kind: "message",
            text: "Hola, quiero saber precios."
          },
          {
            index: 2,
            authorRole: "business",
            kind: "message",
            text: "Claro. ¿De qué producto o medida te gustaría saber el precio?"
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );

  await writeFile(
    path.join(corpusDir, "index.json"),
    JSON.stringify(
      {
        generatedAt: "2026-03-28T02:00:00.000Z",
        sourceDir: "/tmp/source",
        outputDir: corpusDir,
        conversations: [
          {
            conversationId: "sample",
            name: "sample",
            manifestPath,
            proposalPath: path.join(corpusDir, "proposals", "sample.json"),
            turnCount: 2,
            labels: ["quote_request", "quote_follow_up"],
            scope: {
              general: ["quote_request", "quote_follow_up"],
              tenantSpecific: []
            },
            threadProfile: {
              initiatedBy: "customer_initiated",
              channelInterfered: false,
              buckets: ["customer_initiated"]
            },
            proposalCount: 1,
            startedAt: "2026-03-28T02:00:00.000Z",
            endedAt: "2026-03-28T02:01:00.000Z",
            attachmentTypes: []
          }
        ],
        proposals: [],
        summary: {
          totalConversations: 1,
          totalTurns: 2,
          totalProposals: 1,
          labelCounts: {
            quote_request: 1,
            quote_follow_up: 1
          },
          threadProfileCounts: {
            customer_initiated: 1,
            business_initiated: 0,
            channel_interfered: 0
          }
        }
      },
      null,
      2
    ),
    "utf8"
  );

  const result = await generateWhatsAppResponsePlaybook({
    corpusDir,
    outputPath,
    metadataPath
  });

  const content = await readFile(outputPath, "utf8");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));

  assert.equal(result.conversations, 1);
  assert.match(content, /Playbook Conversacional Derivado de Chats Reales/);
  assert.match(content, /Placeholders recomendados/);
  assert.match(content, /Apertura \+ consulta amplia \+ acotación progresiva/);
  assert.match(content, /\[categoría general\]/);
  assert.equal(metadata.conversations, 1);
  assert.equal(metadata.topLabels[0].label, "quote_request");
});
