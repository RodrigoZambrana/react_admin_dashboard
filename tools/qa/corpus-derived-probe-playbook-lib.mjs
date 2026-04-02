function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return compactText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function extractSourceCategory(notes) {
  const match = /Categor[ií]a:\s*([^.]+)\./iu.exec(String(notes || ""));
  return match ? compactText(match[1]) : null;
}

function extractSourceConversationId(notes) {
  const match = /Conversaci[oó]n fuente:\s*([^.]+)\./iu.exec(String(notes || ""));
  return match ? compactText(match[1]) : null;
}

function mapSourceCategoryToFindingCategory(sourceCategory) {
  switch (sourceCategory) {
    case "stateful_regression_candidate":
      return "topic_loss";
    case "follow_up_regression_candidate":
      return "loop_reentry";
    case "support_regression_candidate":
      return "handoff_too_early";
    case "knowledge_first_regression_candidate":
      return "policy_vs_core_leak";
    case "runtime_regression_candidate":
      return "generic_fallback_overreach";
    case "multimodal_regression_candidate":
      return "generic_fallback_overreach";
    default:
      return "generic_fallback_overreach";
  }
}

function buildExpectationPatterns(patterns, category, severity) {
  return (Array.isArray(patterns) ? patterns : [])
    .map((pattern) => compactText(pattern))
    .filter(Boolean)
    .map((pattern) => ({
      pattern,
      category,
      severity
    }));
}

export function buildProbePlaybookFromDerivedRealSet(derivedSet, options = {}) {
  const defaults = {
    tenantKey: typeof options.tenantKey === "string" ? options.tenantKey : "urucortinas",
    page: typeof options.page === "string" ? options.page : "/shop",
    locale: typeof options.locale === "string" ? options.locale : "es-UY",
    currency: typeof options.currency === "string" ? options.currency : "UYU",
    scope: typeof options.scope === "string" ? options.scope : "customer_public"
  };

  const scenarios = (Array.isArray(derivedSet?.scenarios) ? derivedSet.scenarios : [])
    .map((scenario) => {
      const sourceCategory = extractSourceCategory(scenario?.notes);
      const sourceConversationId = extractSourceConversationId(scenario?.notes);
      const findingCategory = mapSourceCategoryToFindingCategory(sourceCategory);
      const steps = (Array.isArray(scenario?.turns) ? scenario.turns : [])
        .map((turn, index) => {
          const includePatterns = buildExpectationPatterns(
            turn?.expected?.include,
            findingCategory,
            "medium"
          );
          const avoidPatterns = buildExpectationPatterns(
            turn?.expected?.avoid,
            findingCategory,
            "high"
          );

          const expect = {};
          if (includePatterns.length > 0) {
            expect.should_match_any = includePatterns;
          }
          if (avoidPatterns.length > 0) {
            expect.must_not_match_any = avoidPatterns;
          }
          if (Object.keys(expect).length === 0) {
            return {
              text: turn?.user || "",
              expect: undefined
            };
          }

          return {
            text: turn?.user || "",
            expect
          };
        })
        .filter((step) => compactText(step.text));

      if (!steps.length) {
        return null;
      }

      return {
        id: scenario?.id || slugify(scenario?.title || "corpus-derived-probe"),
        title: compactText(scenario?.title || "Corpus derived probe"),
        goal: "unknown",
        focus: "corpus-derived mutation",
        tags: [
          "corpus_mutation",
          sourceCategory ? slugify(sourceCategory) : null,
          sourceConversationId ? `source-${slugify(sourceConversationId)}` : null
        ].filter(Boolean),
        metadata: {
          sourceCategory,
          sourceConversationId,
          notes: compactText(scenario?.notes || "")
        },
        steps
      };
    })
    .filter(Boolean);

  return {
    version: 1,
    playbookId: `corpus-derived-live-probes-${slugify(derivedSet?.name || "anonymous")}`,
    title: "Corpus Derived Live Webchat Probes",
    defaults,
    scenarios
  };
}

export function mergeProbePlaybooks(...playbooks) {
  const normalized = playbooks.filter(Boolean);
  const defaults = Object.assign({}, ...normalized.map((playbook) => playbook?.defaults || {}));
  const scenarioMap = new Map();

  for (const playbook of normalized) {
    for (const scenario of Array.isArray(playbook?.scenarios) ? playbook.scenarios : []) {
      const id = typeof scenario?.id === "string" && scenario.id.trim()
        ? scenario.id.trim()
        : null;
      if (!id) {
        continue;
      }

      if (!scenarioMap.has(id)) {
        scenarioMap.set(id, scenario);
        continue;
      }

      const previous = scenarioMap.get(id);
      const previousStepCount = Array.isArray(previous?.steps) ? previous.steps.length : 0;
      const currentStepCount = Array.isArray(scenario?.steps) ? scenario.steps.length : 0;
      if (currentStepCount > previousStepCount) {
        scenarioMap.set(id, scenario);
      }
    }
  }

  return {
    version: 1,
    playbookId: normalized.map((playbook) => playbook?.playbookId).filter(Boolean).join("+") || "merged-live-probes",
    title: "Merged Live Webchat Probes",
    defaults,
    scenarios: Array.from(scenarioMap.values()).sort((left, right) =>
      String(left.id).localeCompare(String(right.id))
    )
  };
}
