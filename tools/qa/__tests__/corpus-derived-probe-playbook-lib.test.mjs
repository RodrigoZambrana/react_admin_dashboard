import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProbePlaybookFromDerivedRealSet,
  mergeProbePlaybooks
} from "../corpus-derived-probe-playbook-lib.mjs";

test("buildProbePlaybookFromDerivedRealSet converts derived corpus scenarios into live probe playbook", () => {
  const playbook = buildProbePlaybookFromDerivedRealSet(
    {
      name: "proposal-derived-real-set-mixed-2026-04-01",
      scenarios: [
        {
          id: "scenario-1",
          title: "Seguimiento de quote",
          notes:
            "Categoría: stateful_regression_candidate. Conversación fuente: 000123. Incluye follow-up sintético: Seguimos con esto.",
          turns: [
            {
              user: "quiero cotizar roller blackout",
              expected: {
                include: ["roller|blackout"],
                avoid: ["que producto"]
              }
            }
          ]
        }
      ]
    },
    {
      tenantKey: "urucortinas",
      page: "/shop",
      scope: "customer_public"
    }
  );

  assert.equal(playbook.defaults.tenantKey, "urucortinas");
  assert.equal(playbook.scenarios.length, 1);
  assert.equal(playbook.scenarios[0].tags.includes("corpus_mutation"), true);
  assert.equal(playbook.scenarios[0].metadata.sourceCategory, "stateful_regression_candidate");
  assert.deepEqual(playbook.scenarios[0].steps[0].expect.should_match_any, [
    {
      pattern: "roller|blackout",
      category: "topic_loss",
      severity: "medium"
    }
  ]);
  assert.deepEqual(playbook.scenarios[0].steps[0].expect.must_not_match_any, [
    {
      pattern: "que producto",
      category: "topic_loss",
      severity: "high"
    }
  ]);
});

test("mergeProbePlaybooks preserves previous pack and adds new scenarios without shrinking the sample", () => {
  const previous = {
    playbookId: "previous-pack",
    defaults: { tenantKey: "urucortinas" },
    scenarios: [
      { id: "carry-1", title: "Carry 1", steps: [{ text: "hola" }] },
      { id: "carry-2", title: "Carry 2", steps: [{ text: "precio" }] }
    ]
  };
  const current = {
    playbookId: "current-pack",
    defaults: { page: "/shop" },
    scenarios: [
      { id: "carry-2", title: "Carry 2 expanded", steps: [{ text: "precio" }, { text: "medida" }] },
      { id: "new-1", title: "New 1", steps: [{ text: "retomo esto" }] }
    ]
  };

  const merged = mergeProbePlaybooks(previous, current);

  assert.equal(merged.scenarios.length, 3);
  assert.deepEqual(merged.defaults, { tenantKey: "urucortinas", page: "/shop" });
  assert.equal(
    merged.scenarios.find((entry) => entry.id === "carry-2")?.steps.length,
    2
  );
});
