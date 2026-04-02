import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProbeKnowledgeDictionary,
  evaluateProbeExpectations
} from "../webchat-probe-lib.mjs";

test("buildProbeKnowledgeDictionary derives product and measurement signals from knowledge snapshots", () => {
  const dictionary = buildProbeKnowledgeDictionary({
    runtimeConfig: {
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini"
    },
    topicTaxonomy: {
      items: [
        {
          label: "ventana corrediza",
          familyLabel: "aberturas",
          aliases: ["ventana", "corrediza"],
          variantLabels: ["ventana de aluminio"]
        }
      ]
    },
    quoteProfiles: {
      items: [
        {
          label: "aberturas de aluminio",
          familyLabel: "aberturas",
          appliesToTopicLabels: ["ventana corrediza"],
          measurementCarrierTerms: ["abertura", "hueco"],
          attributes: [
            {
              label: "color",
              options: [{ value: "negro", aliases: ["black"] }]
            }
          ]
        }
      ]
    }
  });

  assert.equal(dictionary.runtimeConfig.provider, "openai");
  assert.ok(dictionary.productTerms.includes("ventana corrediza"));
  assert.ok(dictionary.productTerms.includes("aberturas"));
  assert.ok(dictionary.productTerms.includes("negro"));
  assert.ok(dictionary.measurementTerms.includes("abertura"));
});

test("evaluateProbeExpectations detects missing clarification and forbidden policy leakage", () => {
  const dictionary = buildProbeKnowledgeDictionary({
    topicTaxonomy: {
      items: [
        {
          label: "ventana corrediza",
          familyLabel: "aberturas",
          aliases: ["ventana", "puerta"]
        }
      ]
    }
  });

  const turnEntry = {
    conversationId: "probe-1",
    semanticTurnId: "probe-1:step-2",
    userGoal: "customer.quote",
    responseText: "Persianas y Cortinas de Enrollar - Solicita tu presupuesto.",
    turnFacts: {
      current: {}
    }
  };

  const result = evaluateProbeExpectations({
    scenario: { id: "probe-1" },
    step: {
      expect: {
        should_ask: ["product"],
        must_not_contain: [
          { text: "Solicita tu presupuesto", category: "policy_vs_core_leak" }
        ]
      }
    },
    turnEntry,
    previousResponseText: "",
    dictionary
  });

  assert.equal(result.passed, false);
  assert.ok(result.checks.some((entry) => entry.id === "should_ask:product" && entry.passed === false));
  assert.ok(
    result.findings.some((entry) => entry.taxonomy === "policy_vs_core_leak")
  );
});

test("evaluateProbeExpectations uses knowledge-derived product terms for clarification checks", () => {
  const dictionary = buildProbeKnowledgeDictionary({
    topicTaxonomy: {
      items: [
        {
          label: "ventana corrediza",
          familyLabel: "aberturas",
          aliases: ["ventana", "puerta"]
        }
      ]
    }
  });

  const turnEntry = {
    conversationId: "probe-2",
    semanticTurnId: "probe-2:step-1",
    userGoal: "customer.quote",
    responseText: "¿Buscás una ventana o una puerta?",
    turnFacts: {
      current: {}
    }
  };

  const result = evaluateProbeExpectations({
    scenario: { id: "probe-2" },
    step: {
      expect: {
        should_ask: ["product"]
      }
    },
    turnEntry,
    previousResponseText: "",
    dictionary
  });

  assert.equal(result.passed, true);
  assert.equal(result.findings.length, 0);
});

test("evaluateProbeExpectations still accepts generic product clarification when knowledge dictionary is empty", () => {
  const turnEntry = {
    conversationId: "probe-3",
    semanticTurnId: "probe-3:step-1",
    userGoal: "customer.quote",
    responseText: "Perfecto, ¿buscás una ventana o una puerta en particular?",
    turnFacts: {
      current: {}
    }
  };

  const result = evaluateProbeExpectations({
    scenario: { id: "probe-3" },
    step: {
      expect: {
        should_ask: ["product"]
      }
    },
    turnEntry,
    previousResponseText: "",
    dictionary: buildProbeKnowledgeDictionary({})
  });

  assert.equal(result.passed, true);
  assert.equal(result.findings.length, 0);
});

test("evaluateProbeExpectations supports regex-based structural expectations", () => {
  const turnEntry = {
    conversationId: "probe-4",
    semanticTurnId: "probe-4:step-2",
    userGoal: "customer.quote",
    responseText: "Perfecto. Ya tengo una base para la cotizacion y seguimos con el siguiente paso.",
    turnFacts: {
      current: {}
    }
  };

  const passing = evaluateProbeExpectations({
    scenario: { id: "probe-4" },
    step: {
      expect: {
        should_match_any: [{ pattern: "base para la cotizacion", category: "quote_intake_reopened" }],
        must_not_match_any: [{ pattern: "que producto", category: "topic_loss" }]
      }
    },
    turnEntry,
    previousResponseText: "",
    dictionary: buildProbeKnowledgeDictionary({})
  });

  assert.equal(passing.passed, true);
  assert.equal(passing.findings.length, 0);

  const failing = evaluateProbeExpectations({
    scenario: { id: "probe-4" },
    step: {
      expect: {
        should_match_any: [{ pattern: "coordinar visita", category: "handoff_too_early" }]
      }
    },
    turnEntry,
    previousResponseText: "",
    dictionary: buildProbeKnowledgeDictionary({})
  });

  assert.equal(failing.passed, false);
  assert.ok(
    failing.findings.some((entry) => entry.taxonomy === "handoff_too_early")
  );
});
