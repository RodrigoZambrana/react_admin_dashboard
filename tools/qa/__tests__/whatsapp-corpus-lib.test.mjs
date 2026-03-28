import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyConversationCases,
  deriveThreadProfile,
  parseWhatsAppTranscript,
  proposeRegressionFixtures
} from "../whatsapp-corpus-lib.mjs";

test("parseWhatsAppTranscript parses multi-line messages and attachment mentions", () => {
  const transcript = [
    "20/2/2026, 08:38 - Cliente: Te puedo mandar audio?",
    "20/2/2026, 08:38 - urucortinas: Si",
    "20/2/2026, 08:38 - Cliente: PTT-20260220-WA0000.opus (archivo adjunto)",
    "20/2/2026, 08:46 - Cliente: IMG-20260220-WA0003.jpg (archivo adjunto)",
    "Barrotes de aluminio en la ventana la cantidad que uds consideren seguros.",
    "20/2/2026, 08:47 - urucortinas: Si te entiendo."
  ].join("\n");

  const { participants, entries } = parseWhatsAppTranscript(transcript, [
    {
      name: "Chat de WhatsApp con A. Paola.txt",
      kind: "transcript",
      type: "document",
      extension: ".txt"
    },
    {
      name: "PTT-20260220-WA0000.opus",
      kind: "attachment",
      type: "audio",
      extension: ".opus"
    },
    {
      name: "IMG-20260220-WA0003.jpg",
      kind: "attachment",
      type: "image",
      extension: ".jpg"
    }
  ]);

  assert.equal(participants.length, 2);
  assert.equal(participants[1].role, "business");
  assert.equal(entries.length, 5);
  assert.equal(entries[2].attachmentRefs[0].type, "audio");
  assert.equal(entries[3].attachmentRefs[0].type, "image");
  assert.match(entries[3].text, /Barrotes de aluminio/);
});

test("classifyConversationCases and proposeRegressionFixtures derive QA candidates from real-style threads", () => {
  const manifest = {
    conversationId: "chat-paola",
    turns: [
      {
        index: 1,
        authorRole: "customer",
        text: "Hola, te contacto desde la web. Necesito saber si hacen trabajos a medida con colocación."
      },
      {
        index: 2,
        authorRole: "business",
        text: "Respuesta automática: Gracias por tu mensaje."
      },
      {
        index: 3,
        authorRole: "customer",
        text: "Te puedo mandar audio?",
        attachmentRefs: []
      },
      {
        index: 4,
        authorRole: "customer",
        text: "PTT-20260220-WA0000.opus (archivo adjunto)",
        attachmentRefs: [{ name: "PTT-20260220-WA0000.opus", type: "audio" }]
      },
      {
        index: 5,
        authorRole: "customer",
        text: "La ventana es de 1.00 x 1.50 aprox y la puerta de 2 x 0.65"
      },
      {
        index: 6,
        authorRole: "business",
        text: "Tenemos serie 25, Probba y Gala. También aceptamos efectivo, transferencia bancaria o Mercado Pago."
      },
      {
        index: 7,
        authorRole: "customer",
        text: "Tengo instaladas unas cortinas con motor que necesitan service. Una dejó de funcionar."
      }
    ]
  };

  const labels = classifyConversationCases(manifest);
  const proposals = proposeRegressionFixtures({
    ...manifest,
    classification: { labels }
  });

  assert.ok(labels.includes("structured_measurements"));
  assert.ok(labels.includes("payment_terms"));
  assert.ok(labels.includes("support_service"));
  assert.ok(labels.includes("multimodal_audio"));
  assert.ok(labels.includes("auto_reply_present"));
  assert.ok(labels.includes("system_message_interference"));
  assert.ok(labels.includes("operational_thread_switch"));
  assert.ok(proposals.some((proposal) => proposal.category === "multimodal_regression_candidate"));
  assert.ok(proposals.some((proposal) => proposal.category === "support_regression_candidate"));
  assert.ok(
    proposals.some((proposal) => proposal.category === "knowledge_first_regression_candidate")
  );
  assert.ok(
    proposals.some((proposal) => proposal.category === "channel_noise_regression_candidate")
  );
});

test("classifyConversationCases detects outbound follow-up, reengagement and abandoned threads", () => {
  const manifest = {
    conversationId: "chat-reengagement",
    turns: [
      {
        index: 1,
        authorRole: "business",
        kind: "message",
        timestamp: "2026-03-01T12:00:00.000Z",
        text: "Seguimos atentos por si quieres retomar."
      },
      {
        index: 2,
        authorRole: "customer",
        kind: "message",
        timestamp: "2026-03-03T15:30:00.000Z",
        text: "Sí, quiero continuar con la consulta."
      },
      {
        index: 3,
        authorRole: "customer",
        kind: "message",
        timestamp: "2026-03-03T15:32:00.000Z",
        text: "Hola?"
      }
    ]
  };

  const labels = classifyConversationCases(manifest);
  const proposals = proposeRegressionFixtures({
    ...manifest,
    classification: { labels }
  });

  assert.ok(labels.includes("outbound_follow_up"));
  assert.ok(labels.includes("reengagement_after_gap"));
  assert.ok(labels.includes("abandoned_thread"));
  assert.ok(
    proposals.some((proposal) => proposal.id.endsWith(":outbound-follow-up"))
  );
  assert.ok(
    proposals.some((proposal) => proposal.id.endsWith(":reengagement-after-gap"))
  );
  assert.ok(
    proposals.some((proposal) => proposal.id.endsWith(":abandoned-thread"))
  );
});

test("deriveThreadProfile separates customer initiated, business initiated and channel interfered threads", () => {
  const turns = [
    {
      index: 1,
      authorRole: "business",
      kind: "message",
      timestamp: "2026-03-01T12:00:00.000Z",
      text: "Respuesta automática: gracias por tu mensaje."
    },
    {
      index: 2,
      authorRole: "customer",
      kind: "message",
      timestamp: "2026-03-01T12:10:00.000Z",
      text: "Quiero retomar la consulta."
    }
  ];
  const labels = classifyConversationCases({ conversationId: "chat-thread-profile", turns });
  const threadProfile = deriveThreadProfile(turns, labels);

  assert.ok(labels.includes("outbound_follow_up"));
  assert.ok(labels.includes("system_message_interference"));
  assert.equal(threadProfile.initiatedBy, "business_initiated");
  assert.equal(threadProfile.channelInterfered, true);
  assert.deepEqual(threadProfile.buckets, ["business_initiated", "channel_interfered"]);
});
