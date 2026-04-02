import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCorpusTranscriptConversation,
  buildReplayTranscriptConversation,
  cleanMessageText,
  renderConversationText
} from "../real-corpus-artifacts-lib.mjs";

test("buildCorpusTranscriptConversation keeps only customer and business turns in plain format", () => {
  const manifest = {
    conversationId: "conv-1",
    turns: [
      {
        authorRole: "system",
        text: "Los mensajes estan cifrados"
      },
      {
        authorRole: "customer",
        text: "Hola"
      },
      {
        authorRole: "customer",
        text: "<Multimedia omitido>"
      },
      {
        authorRole: "business",
        text: "Buen dia"
      },
      {
        authorRole: "customer",
        text: "Necesito precio"
      }
    ]
  };

  const conversation = buildCorpusTranscriptConversation(manifest);

  assert.equal(conversation.conversationId, "conv-1");
  assert.equal(conversation.rawTurnCount, 3);
  assert.deepEqual(conversation.mergedTurns, [
    {
      speaker: "Cliente",
      messages: ["Hola"]
    },
    {
      speaker: "Agente",
      messages: ["Buen dia"]
    },
    {
      speaker: "Cliente",
      messages: ["Necesito precio"]
    }
  ]);
});

test("buildReplayTranscriptConversation renders customer inputs with generated chat replies", () => {
  const replayConversation = {
    conversationId: "conv-2",
    turns: [
      {
        user: {
          text: "Quiero precio de roller"
        },
        responseText: "Claro. Decime la medida aproximada."
      },
      {
        user: {
          text: "2 x 2"
        },
        response: {
          finalUserText: "Perfecto. Ya tengo una base para la cotizacion."
        }
      }
    ]
  };

  const conversation = buildReplayTranscriptConversation(replayConversation, {
    customerLabel: "Cliente",
    agentLabel: "Chat"
  });

  assert.equal(conversation.rawTurnCount, 4);
  assert.deepEqual(conversation.mergedTurns, [
    {
      speaker: "Cliente",
      messages: ["Quiero precio de roller"]
    },
    {
      speaker: "Chat",
      messages: ["Claro. Decime la medida aproximada."]
    },
    {
      speaker: "Cliente",
      messages: ["2 x 2"]
    },
    {
      speaker: "Chat",
      messages: ["Perfecto. Ya tengo una base para la cotizacion."]
    }
  ]);

  const rendered = renderConversationText(conversation.conversationId, conversation.mergedTurns);
  assert.match(rendered, /Cliente: Quiero precio de roller/);
  assert.match(rendered, /Chat: Claro\. Decime la medida aproximada\./);
});

test("cleanMessageText removes edited markers and invisible characters", () => {
  const cleaned = cleanMessageText(" \u200eHola  <Se editó este mensaje.>\n\nmundo ");
  assert.equal(cleaned, "Hola mundo");
});
