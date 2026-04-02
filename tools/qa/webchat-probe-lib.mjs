import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MEASUREMENTS_ASK_REGEX =
  /\b(medidas?|ancho por alto|medida aproximada|cu[aá]nto mide|dimensiones?)\b/iu;
const QUANTITY_ASK_REGEX = /\b(cu[aá]ntas? unidades|cantidad)\b/iu;
const FALLBACK_PRODUCT_ASK_REGEX =
  /\b(qu[eé] producto|qu[eé] quer[eé]s cotizar|qu[eé] opci[oó]n buscas|qu[eé] servicio te interesa|qu[eé] tipo de|te gustar[ií]a|prefieres|puertas?, ventanas? o paneles?)\b/iu;
const SCHEDULE_ASK_REGEX =
  /\b(direcci[oó]n|zona|ubicaci[oó]n|qu[eé]\s+d[ií]a|qu[eé]\s+dia|d[ií]a te queda bien|horario|a\s+qu[eé]\s+hora|a\s+que\s+hora)\b/iu;

const DEFAULT_MEASUREMENT_TERMS = [
  "medida",
  "medidas",
  "ancho por alto",
  "medida aproximada",
  "cuanto mide",
  "dimensiones"
];
const DEFAULT_QUANTITY_TERMS = ["cantidad", "unidades", "unidad"];
const DEFAULT_SCHEDULE_TERMS = [
  "direccion",
  "zona",
  "ubicacion",
  "dia",
  "horario",
  "hora"
];

const CATEGORY_TEMPLATES = Object.freeze({
  topic_loss: {
    likelyLayer: "turn interpretation",
    rootCause:
      "La decision del turno no esta priorizando la evidencia estructural ya presente sobre producto/topico antes de resolver que falta pedir.",
    globalFix:
      "Promover un contrato intermedio donde topico reconocido, variante y senales lexicas persistidas se evaluen antes de caer en pregunta abierta de producto.",
    rejectPatch:
      "Agregar keywords puntuales en runtime solo tapa el sintoma y no corrige la perdida de continuidad entre senales, parsing y decision."
  },
  measurement_parse_gap: {
    likelyLayer: "quote context",
    rootCause:
      "Las medidas llegan en el turno pero no terminan consolidadas como evidencia estructural reusable dentro del quote seed.",
    globalFix:
      "Separar extractor de medidas del resolvedor de topico y persistir measurement items normalizados como source of truth del contexto de cotizacion.",
    rejectPatch:
      "Una regex puntual por frase no resuelve la variabilidad de formato ni evita que otra capa vuelva a pedir el mismo dato."
  },
  quote_intake_reopened: {
    likelyLayer: "resolution readiness",
    rootCause:
      "La evaluacion de readiness no esta consumiendo de forma consistente los datos ya capturados, por lo que reabre intake aunque el contexto base ya exista.",
    globalFix:
      "Unificar el contrato de quote context entre extraccion, memoria y readiness para que los missing fields se calculen sobre evidencia consolidada.",
    rejectPatch:
      "Parchear preguntas o wording no evita que el runtime siga creyendo que faltan datos que ya fueron provistos."
  },
  generic_fallback_overreach: {
    likelyLayer: "detectIntent",
    rootCause:
      "La clasificacion del turno esta degradando a fallback o aclaracion generica aun cuando el mensaje ya trae intencion y senales accionables.",
    globalFix:
      "Elevar el peso de evidence-based turn interpretation y separar fallback por falta real de senal frente a fallback por baja confianza del clasificador.",
    rejectPatch:
      "Cambiar frases de fallback deja intacta la decision equivocada que llevo al sistema a responder generico."
  },
  loop_reentry: {
    likelyLayer: "loop prevention",
    rootCause:
      "La prevencion de loop entra tarde o con poca sensibilidad a respuestas repetidas sobre el mismo slot sin avance de estado.",
    globalFix:
      "Hacer que loop prevention lea estado conversacional y slots ya pedidos/resueltos, no solo similitud superficial del wording.",
    rejectPatch:
      "Retocar una respuesta repetida no elimina la condicion estructural que vuelve a generar el loop."
  },
  handoff_too_early: {
    likelyLayer: "resolution readiness",
    rootCause:
      "El runtime esta marcando derivacion o needsHuman antes de agotar la captura estructural que si esta dentro del alcance del chat.",
    globalFix:
      "Rebalancear readiness y policy para diferenciar bloqueo real de casos donde todavia hay progreso estructural posible.",
    rejectPatch:
      "Sacar una frase de derivacion del texto no corrige que el contrato de readiness este cerrando demasiado pronto."
  },
  policy_vs_core_leak: {
    likelyLayer: "render outcome / wording",
    rootCause:
      "Hay boilerplate o wording operativo acoplado al runtime central en vez de resolverse desde policy/registry.",
    globalFix:
      "Extraer wording dependiente de idioma o tenant a un registro de policy y mantener el core sobre contratos estructurales.",
    rejectPatch:
      "Meter otra frase fija en el core profundiza la fuga entre policy y runtime."
  },
  runtime_error: {
    likelyLayer: "render outcome / wording",
    rootCause:
      "La corrida no pudo completar el turno por un error operacional del stack local.",
    globalFix:
      "Asegurar preflight de servicios y tolerancia a fallos por turno para que la corrida siga siendo auditable aun con errores parciales.",
    rejectPatch:
      "Ignorar el error deja corridas opacas y no reproducibles."
  }
});

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return compactText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTermPattern(value) {
  return escapeRegex(compactText(value)).replace(/\s+/g, "\\s+");
}

function pushStringTerm(target, value) {
  const text = compactText(value);
  if (!text) {
    return;
  }
  target.add(text);
}

function pushStringArrayTerms(target, values) {
  for (const value of Array.isArray(values) ? values : []) {
    pushStringTerm(target, value);
  }
}

function compilePhraseRegex(terms, fallbackRegex) {
  const normalizedTerms = [...new Set((terms || []).map((entry) => compactText(entry)).filter(Boolean))]
    .sort((left, right) => right.length - left.length);
  if (!normalizedTerms.length) {
    return fallbackRegex;
  }

  return new RegExp(
    `(?:^|\\b)(?:${normalizedTerms.map((term) => normalizeTermPattern(term)).join("|")})(?:\\b|$)`,
    "iu"
  );
}

export function buildProbeKnowledgeDictionary({
  runtimeConfig = null,
  topicTaxonomy = null,
  quoteProfiles = null
} = {}) {
  const productTerms = new Set();
  const measurementTerms = new Set(DEFAULT_MEASUREMENT_TERMS);
  const quantityTerms = new Set(DEFAULT_QUANTITY_TERMS);
  const scheduleTerms = new Set(DEFAULT_SCHEDULE_TERMS);
  const topicItems = Array.isArray(topicTaxonomy?.items) ? topicTaxonomy.items : [];
  const quoteProfileItems = Array.isArray(quoteProfiles?.items) ? quoteProfiles.items : [];

  for (const item of topicItems) {
    if (!item || typeof item !== "object") {
      continue;
    }
    pushStringTerm(productTerms, item.label);
    pushStringTerm(productTerms, item.familyLabel);
    pushStringArrayTerms(productTerms, item.aliases);
    pushStringArrayTerms(productTerms, item.parentLabels);
    pushStringArrayTerms(productTerms, item.variantLabels);
  }

  for (const profile of quoteProfileItems) {
    if (!profile || typeof profile !== "object") {
      continue;
    }
    pushStringTerm(productTerms, profile.label);
    pushStringTerm(productTerms, profile.familyLabel);
    pushStringArrayTerms(productTerms, profile.appliesToTopicLabels);
    pushStringArrayTerms(measurementTerms, profile.measurementCarrierTerms);
    for (const attribute of Array.isArray(profile.attributes) ? profile.attributes : []) {
      pushStringTerm(productTerms, attribute?.label);
      for (const option of Array.isArray(attribute?.options) ? attribute.options : []) {
        pushStringTerm(productTerms, option?.value);
        pushStringArrayTerms(productTerms, option?.aliases);
      }
    }
  }

  return {
    runtimeConfig: runtimeConfig && typeof runtimeConfig === "object"
      ? {
          enabled: runtimeConfig.enabled === true,
          provider: typeof runtimeConfig.provider === "string" ? runtimeConfig.provider : null,
          model: typeof runtimeConfig.model === "string" ? runtimeConfig.model : null
        }
      : null,
    productTerms: [...productTerms].sort((left, right) => left.localeCompare(right)),
    measurementTerms: [...measurementTerms].sort((left, right) => left.localeCompare(right)),
    quantityTerms: [...quantityTerms].sort((left, right) => left.localeCompare(right)),
    scheduleTerms: [...scheduleTerms].sort((left, right) => left.localeCompare(right))
  };
}

function severityRank(severity) {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function buildFinding({
  category,
  severity,
  conversationId,
  turn,
  symptom,
  userGoal,
  currentResponseProblem,
  evidence
}) {
  const template = CATEGORY_TEMPLATES[category] || CATEGORY_TEMPLATES.generic_fallback_overreach;
  return {
    severity,
    conversationId,
    turn,
    symptom,
    user_goal: userGoal,
    current_response_problem: currentResponseProblem,
    likely_layer: template.likelyLayer,
    evidence,
    root_cause_hypothesis: template.rootCause,
    global_fix_direction: template.globalFix,
    reject_local_patch_reason: template.rejectPatch,
    taxonomy: category
  };
}

function substituteTemplate(value, variables) {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) =>
      Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : ""
    );
  }

  if (Array.isArray(value)) {
    return value.map((entry) => substituteTemplate(entry, variables));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, substituteTemplate(entry, variables)])
    );
  }

  return value;
}

function expandVariantMatrix(variants) {
  const entries = Object.entries(variants || {});
  if (!entries.length) {
    return [{}];
  }

  const results = [];

  function walk(index, current) {
    if (index >= entries.length) {
      results.push({ ...current });
      return;
    }

    const [key, rawValues] = entries[index];
    const values = Array.isArray(rawValues) ? rawValues : [rawValues];
    for (const value of values) {
      current[key] = value;
      walk(index + 1, current);
    }
    delete current[key];
  }

  walk(0, {});
  return results;
}

function buildInstanceId(scenarioId, variables, iterationIndex) {
  const variantSuffix = Object.entries(variables || {})
    .map(([key, value]) => `${slugify(key)}-${slugify(value)}`)
    .filter(Boolean)
    .join("__");

  const iterationSuffix = `it${String(iterationIndex + 1).padStart(2, "0")}`;
  return [scenarioId, variantSuffix, iterationSuffix].filter(Boolean).join("--");
}

export function buildDefaultProbePlaybook() {
  return {
    version: 1,
    playbookId: "default-live-webchat-probes",
    title: "Default Live Webchat Probe Loop",
    defaults: {
      tenantKey: "urucortinas",
      page: "/shop",
      locale: "es-UY",
      currency: "UYU",
      scope: "customer_public"
    },
    scenarios: [
      {
        id: "quote-window-black-aluminum",
        title: "Cotizacion ventana corrediza negra",
        goal: "customer.quote",
        focus: "quote continuity and retrieval boundary",
        tags: ["quote", "topic", "retrieval"],
        variants: {
          measurement: ["2x2", "2,00 x 2,00 m"]
        },
        steps: [
          { text: "buenas tardes" },
          { text: "necesito una abertura en aluminio" },
          {
            text: "color negro",
            expect: {
              must_not_contain: [
                { text: "Persianas y Cortinas de Enrollar", category: "policy_vs_core_leak" },
                { text: "Lun - Vie", category: "policy_vs_core_leak" },
                { text: "Solicita tu presupuesto", category: "policy_vs_core_leak" }
              ],
              should_ask: ["product"],
              should_keep_goal: "customer.quote",
              should_not_ask: ["schedule"]
            }
          },
          {
            text: "busco una ventana corrediza de {{measurement}}",
            expect: {
              must_not_contain: [
                { text: "Persianas y Cortinas de Enrollar", category: "policy_vs_core_leak" },
                { text: "Lun - Vie", category: "policy_vs_core_leak" },
                { text: "Solicita tu presupuesto", category: "policy_vs_core_leak" }
              ],
              should_not_ask: ["product"],
              should_keep_goal: "customer.quote"
            }
          }
        ]
      },
      {
        id: "quote-install-scope-followup",
        title: "Cotizacion con colocacion y seguimiento comercial",
        goal: "customer.quote",
        focus: "quote seed continuity",
        variants: {
          main_measurement: ["2,20 x 2,00", "2,00 x 2,20"],
          secondary_measurement: ["0,70 x 0,70"],
          quantity: ["2"]
        },
        tags: ["quote", "attributes", "continuity"],
        steps: [
          {
            text:
              "quiero cotizar una puerta ventana de {{main_measurement}} en aluminio negro"
          },
          {
            text:
              "tambien necesito {{quantity}} ventanas de {{secondary_measurement}} con mosquitero",
            expect: {
              should_keep_goal: "customer.quote",
              should_not_ask: ["product"]
            }
          },
          {
            text: "hacen colocacion para la grande pero las chicas sin colocacion",
            expect: {
              should_keep_goal: "customer.quote",
              must_not_repeat_previous: true
            }
          }
        ]
      },
      {
        id: "quote-courtesy-no-reset",
        title: "Cortesia no debe reabrir intake",
        goal: "customer.quote",
        focus: "loop prevention and quote readiness",
        tags: ["quote", "courtesy", "loop"],
        steps: [
          { text: "quiero una ventana corrediza en aluminio de 2x2" },
          { text: "1 unidad" },
          {
            text: "perfecto gracias",
            expect: {
              should_keep_goal: "customer.quote",
              should_not_ask: ["product", "measurements", "quantity"],
              must_not_repeat_previous: true,
              must_not_contain: [
                { text: "Lun - Vie", category: "policy_vs_core_leak" },
                { text: "Solicita tu presupuesto", category: "policy_vs_core_leak" }
              ]
            }
          }
        ]
      },
      {
        id: "support-motor-and-multichannel-control",
        title: "Soporte motor y control multicanal",
        goal: "customer.support_request",
        focus: "support continuity",
        tags: ["support", "topic", "repair"],
        steps: [
          { text: "tengo una cortina con motor que no responde" },
          {
            text: "ademas quiero cambiar el control por uno de varios canales",
            expect: {
              should_keep_goal: "customer.support_request",
              should_not_ask: ["product"],
              must_not_contain: ["presupuesto", "cotizacion"]
            }
          },
          {
            text: "ahora le saco foto",
            expect: {
              should_keep_goal: "customer.support_request",
              should_not_ask: ["product"]
            }
          }
        ]
      },
      {
        id: "schedule-after-support",
        title: "Coordinacion despues de soporte",
        goal: "customer.schedule_request",
        focus: "schedule continuity",
        tags: ["schedule", "support"],
        steps: [
          { text: "pueden venir manana de tarde a revisar?" },
          {
            text: "despues de turismo me sirve el lunes",
            expect: {
              should_keep_goal: "customer.schedule_request",
              should_not_ask: ["product"]
            }
          },
          {
            text: "bien gracias",
            expect: {
              should_keep_goal: "customer.schedule_request",
              must_not_repeat_previous: true
            }
          }
        ]
      }
    ]
  };
}

export async function loadProbePlaybook(playbookPath) {
  if (!playbookPath) {
    return buildDefaultProbePlaybook();
  }

  const absolutePath = path.resolve(playbookPath);
  return JSON.parse(await readFile(absolutePath, "utf8"));
}

export async function writeProbePlaybook(filePath, playbook = buildDefaultProbePlaybook()) {
  const absolutePath = path.resolve(filePath);
  await writeFile(absolutePath, `${JSON.stringify(playbook, null, 2)}\n`, "utf8");
  return absolutePath;
}

export function expandProbePlaybook(playbook, options = {}) {
  const iterationCount = Math.max(1, Number(options.iterations || 1));
  const scenarioIds = new Set(
    String(options.scenarioIds || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
  const tagFilter = new Set(
    String(options.tags || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

  const defaults =
    playbook?.defaults && typeof playbook.defaults === "object" ? playbook.defaults : {};
  const expanded = [];

  for (const scenario of Array.isArray(playbook?.scenarios) ? playbook.scenarios : []) {
    if (scenarioIds.size > 0 && !scenarioIds.has(scenario.id)) {
      continue;
    }

    const scenarioTags = Array.isArray(scenario.tags) ? scenario.tags : [];
    if (tagFilter.size > 0 && !scenarioTags.some((tag) => tagFilter.has(tag))) {
      continue;
    }

    const variants = expandVariantMatrix(scenario.variants);
    for (const variables of variants) {
      for (let iterationIndex = 0; iterationIndex < iterationCount; iterationIndex += 1) {
        const instanceId = buildInstanceId(scenario.id, variables, iterationIndex);
        expanded.push({
          id: instanceId,
          scenarioId: scenario.id,
          title: substituteTemplate(scenario.title || scenario.id, variables),
          goal: scenario.goal || "unknown",
          focus: substituteTemplate(scenario.focus || "", variables),
          tags: scenarioTags,
          variables,
          settings: {
            ...defaults,
            ...(scenario.settings && typeof scenario.settings === "object" ? scenario.settings : {})
          },
          steps: substituteTemplate(deepClone(Array.isArray(scenario.steps) ? scenario.steps : []), variables)
        });
      }
    }
  }

  const limited = Number.isFinite(Number(options.limitScenarios))
    ? expanded.slice(0, Math.max(0, Math.floor(Number(options.limitScenarios))))
    : expanded;

  return {
    playbookId: playbook?.playbookId || "anonymous-playbook",
    title: playbook?.title || "Live Webchat Probes",
    defaults,
    scenarios: limited
  };
}

function resolveAskExpectationRule(askType, dictionary = null) {
  if (askType === "product") {
    return {
      regex: compilePhraseRegex(dictionary?.productTerms, FALLBACK_PRODUCT_ASK_REGEX),
      category: "topic_loss",
      severity: "high"
    };
  }
  if (askType === "measurements") {
    return {
      regex: compilePhraseRegex(dictionary?.measurementTerms, MEASUREMENTS_ASK_REGEX),
      category: "quote_intake_reopened",
      severity: "high"
    };
  }
  if (askType === "quantity") {
    return {
      regex: compilePhraseRegex(dictionary?.quantityTerms, QUANTITY_ASK_REGEX),
      category: "quote_intake_reopened",
      severity: "medium"
    };
  }
  if (askType === "schedule") {
    return {
      regex: compilePhraseRegex(dictionary?.scheduleTerms, SCHEDULE_ASK_REGEX),
      category: "handoff_too_early",
      severity: "medium"
    };
  }

  return {
    regex: null,
    category: "generic_fallback_overreach",
    severity: "medium"
  };
}

function responseContainsAnyTerm(responseText, terms) {
  const normalizedResponse = normalizeText(responseText);
  return (terms || []).some((term) => normalizedResponse.includes(normalizeText(term)));
}

function matchesExpectedAskType(askType, responseText, dictionary = null) {
  const rule = resolveAskExpectationRule(askType, dictionary);
  if (rule.regex?.test(responseText)) {
    return true;
  }

  if (askType === "product" && /[?¿]/.test(responseText)) {
    const fallbackTerms =
      Array.isArray(dictionary?.productTerms) && dictionary.productTerms.length > 0
        ? dictionary.productTerms
        : ["ventana", "puerta", "panel", "cortina", "persiana", "abertura"];
    return responseContainsAnyTerm(responseText, fallbackTerms);
  }

  return false;
}

function normalizeForbiddenExpectation(entry) {
  if (typeof entry === "string") {
    return {
      text: entry,
      category: "generic_fallback_overreach",
      severity: "high"
    };
  }

  if (entry && typeof entry === "object") {
    return {
      text: typeof entry.text === "string" ? entry.text : "",
      category:
        typeof entry.category === "string" && entry.category.trim()
          ? entry.category.trim()
          : "generic_fallback_overreach",
      severity:
        typeof entry.severity === "string" && entry.severity.trim()
          ? entry.severity.trim()
          : "high"
    };
  }

  return null;
}

function normalizePatternExpectation(entry, defaultCategory = "generic_fallback_overreach", defaultSeverity = "medium") {
  if (typeof entry === "string") {
    return {
      pattern: entry,
      category: defaultCategory,
      severity: defaultSeverity
    };
  }

  if (entry && typeof entry === "object") {
    return {
      pattern: typeof entry.pattern === "string" ? entry.pattern : "",
      category:
        typeof entry.category === "string" && entry.category.trim()
          ? entry.category.trim()
          : defaultCategory,
      severity:
        typeof entry.severity === "string" && entry.severity.trim()
          ? entry.severity.trim()
          : defaultSeverity
    };
  }

  return null;
}

function regexMatchesText(pattern, text) {
  try {
    return new RegExp(pattern, "iu").test(text);
  } catch {
    return false;
  }
}

function makeCheck(id, passed, details = null) {
  return { id, passed, details };
}

function addExpectationFinding(collection, turnEntry, category, severity, symptom, problem, evidence) {
  collection.push(
    buildFinding({
      category,
      severity,
      conversationId: turnEntry.conversationId,
      turn: turnEntry.semanticTurnId,
      symptom,
      userGoal: turnEntry.userGoal,
      currentResponseProblem: problem,
      evidence
    })
  );
}

export function evaluateProbeExpectations({
  scenario,
  step,
  turnEntry,
  previousResponseText,
  dictionary = null
}) {
  const responseText = compactText(turnEntry.responseText);
  const expectation = step?.expect && typeof step.expect === "object" ? step.expect : {};
  const checks = [];
  const findings = [];

  for (const forbiddenEntry of Array.isArray(expectation.must_not_contain)
    ? expectation.must_not_contain
    : []) {
    const forbidden = normalizeForbiddenExpectation(forbiddenEntry);
    if (!forbidden?.text) {
      continue;
    }
    const normalizedForbidden = normalizeText(forbidden.text);
    const matched =
      normalizedForbidden &&
      normalizeText(responseText).includes(normalizeText(forbidden.text));
    checks.push(
      makeCheck(
        `must_not_contain:${forbidden.text}`,
        !matched,
        matched ? forbidden.text : null
      )
    );
    if (matched) {
      addExpectationFinding(
        findings,
        turnEntry,
        forbidden.category,
        forbidden.severity,
        "La salida incluyo texto explicitamente prohibido para este probe.",
        `La respuesta contiene "${forbidden.text}" en un flujo donde ese contenido senala desvio o leakage.`,
        {
          responseText,
          forbidden: forbidden.text
        }
      );
    }
  }

  for (const forbiddenEntry of Array.isArray(expectation.must_not_match_any)
    ? expectation.must_not_match_any
    : []) {
    const forbidden = normalizePatternExpectation(forbiddenEntry, "generic_fallback_overreach", "high");
    if (!forbidden?.pattern) {
      continue;
    }
    const matched = regexMatchesText(forbidden.pattern, responseText);
    checks.push(
      makeCheck(
        `must_not_match_any:${forbidden.pattern}`,
        !matched,
        matched ? forbidden.pattern : null
      )
    );
    if (matched) {
      addExpectationFinding(
        findings,
        turnEntry,
        forbidden.category,
        forbidden.severity,
        "La salida matchea un patron explicitamente prohibido para este probe.",
        `La respuesta coincide con el patron /${forbidden.pattern}/ en un flujo donde eso senala desvio estructural.`,
        {
          responseText,
          forbiddenPattern: forbidden.pattern
        }
      );
    }
  }

  if (Array.isArray(expectation.should_contain_any) && expectation.should_contain_any.length > 0) {
    const normalizedResponse = normalizeText(responseText);
    const matchedAny = expectation.should_contain_any.some((candidate) =>
      normalizedResponse.includes(normalizeText(candidate))
    );
    checks.push(makeCheck("should_contain_any", matchedAny, matchedAny ? null : expectation.should_contain_any));
    if (!matchedAny) {
      addExpectationFinding(
        findings,
        turnEntry,
        "generic_fallback_overreach",
        "medium",
        "La respuesta no incluyo ninguna senal esperada para el objetivo del probe.",
        "El chat respondio sin referenciar el foco que este probe esperaba consolidar.",
        {
          expectedAny: expectation.should_contain_any,
          responseText
        }
      );
    }
  }

  if (Array.isArray(expectation.should_match_any) && expectation.should_match_any.length > 0) {
    const patterns = expectation.should_match_any
      .map((entry) =>
        normalizePatternExpectation(entry, "generic_fallback_overreach", "medium")
      )
      .filter(Boolean);
    const matchedAny = patterns.some((entry) => regexMatchesText(entry.pattern, responseText));
    checks.push(
      makeCheck(
        "should_match_any",
        matchedAny,
        matchedAny ? null : patterns.map((entry) => entry.pattern)
      )
    );
    if (!matchedAny) {
      const fallbackCategory = patterns[0]?.category || "generic_fallback_overreach";
      const fallbackSeverity = patterns[0]?.severity || "medium";
      addExpectationFinding(
        findings,
        turnEntry,
        fallbackCategory,
        fallbackSeverity,
        "La respuesta no matchea ninguno de los patrones estructurales esperados para este probe.",
        "El chat respondio sin consolidar las senales que el escenario derivado del corpus esperaba ver en la salida.",
        {
          expectedPatterns: patterns.map((entry) => entry.pattern),
          responseText
        }
      );
    }
  }

  for (const askType of Array.isArray(expectation.should_not_ask)
    ? expectation.should_not_ask
    : []) {
    const rule = resolveAskExpectationRule(askType, dictionary);
    const regex = rule.regex;
    let category = rule.category;
    let severity = rule.severity;
    let symptom = "La respuesta reabre una pregunta que este probe no esperaba.";
    let problem = `La respuesta vuelve a pedir ${askType} aunque el escenario buscaba continuidad.`;

    if (askType === "product") {
      category = "topic_loss";
      severity = "high";
      symptom = "La respuesta vuelve a preguntar producto/tipo cuando el probe ya introdujo el foco.";
    } else if (askType === "measurements") {
      category = turnEntry.turnFacts?.current?.dimensions
        ? "measurement_parse_gap"
        : "quote_intake_reopened";
      severity = "high";
      symptom = "La respuesta vuelve a pedir medidas en un flujo donde no deberia hacerlo.";
    } else if (askType === "quantity") {
      category = "quote_intake_reopened";
      symptom = "La respuesta vuelve a pedir cantidad en un flujo donde no deberia hacerlo.";
    } else if (askType === "schedule") {
      category = "handoff_too_early";
      symptom = "La respuesta deriva a coordinacion antes de cerrar el objetivo estructural actual.";
    }

    const matched = regex ? regex.test(responseText) : false;
    checks.push(makeCheck(`should_not_ask:${askType}`, !matched, matched ? responseText : null));
    if (matched) {
      addExpectationFinding(findings, turnEntry, category, severity, symptom, problem, {
        responseText,
        askType
      });
    }
  }

  for (const askType of Array.isArray(expectation.should_ask) ? expectation.should_ask : []) {
    const matched = matchesExpectedAskType(askType, responseText, dictionary);
    checks.push(makeCheck(`should_ask:${askType}`, matched, matched ? null : responseText));
    if (!matched) {
      addExpectationFinding(
        findings,
        turnEntry,
        "generic_fallback_overreach",
        "medium",
        "La respuesta no hizo la aclaracion estructural esperada para este probe.",
        `El escenario esperaba que el chat pidiera ${askType} para clarificar el contexto actual.`,
        {
          responseText,
          askType
        }
      );
    }
  }

  if (typeof expectation.should_keep_goal === "string" && expectation.should_keep_goal.trim()) {
    const expectedGoal = expectation.should_keep_goal.trim();
    const actualGoal = turnEntry.userGoal || "unknown";
    const passed = actualGoal === expectedGoal;
    checks.push(makeCheck(`should_keep_goal:${expectedGoal}`, passed, actualGoal));
    if (!passed) {
      addExpectationFinding(
        findings,
        turnEntry,
        "topic_loss",
        "high",
        "La meta conversacional inferida por el chat no coincide con el objetivo del probe.",
        `El probe esperaba ${expectedGoal} y la salida termino en ${actualGoal}.`,
        {
          expectedGoal,
          actualGoal,
          responseText
        }
      );
    }
  }

  if (expectation.must_not_repeat_previous === true) {
    const passed =
      !previousResponseText || normalizeText(previousResponseText) !== normalizeText(responseText);
    checks.push(makeCheck("must_not_repeat_previous", passed, previousResponseText || null));
    if (!passed) {
      addExpectationFinding(
        findings,
        turnEntry,
        "loop_reentry",
        "high",
        "La salida repite esencialmente la respuesta anterior dentro del mismo probe.",
        "No hay progreso visible entre respuestas consecutivas del chat sobre este escenario.",
        {
          previousResponseText: compactText(previousResponseText),
          responseText
        }
      );
    }
  }

  return {
    checks,
    findings,
    passed: checks.every((entry) => entry.passed)
  };
}

export function mergeFindings(baseFindings, extraFindings) {
  const merged = new Map();

  for (const finding of [...(baseFindings || []), ...(extraFindings || [])]) {
    const key = `${finding.turn}::${finding.taxonomy}`;
    const previous = merged.get(key);
    if (!previous || severityRank(finding.severity) > severityRank(previous.severity)) {
      merged.set(key, finding);
    }
  }

  return Array.from(merged.values()).sort(
    (left, right) => severityRank(right.severity) - severityRank(left.severity)
  );
}

function actionPriority(problem) {
  if (problem.count >= 5) {
    return "P1";
  }
  if (problem.count >= 2) {
    return "P2";
  }
  return "P3";
}

function validationHintForCategory(category) {
  switch (category) {
    case "topic_loss":
      return "Rerun probes de follow-up y verificar que el topico no vuelva a abrirse como pregunta de producto.";
    case "measurement_parse_gap":
      return "Rerun probes de cotizacion con medidas explicitas y verificar que no se repidan pedidos de medidas.";
    case "quote_intake_reopened":
      return "Comparar turns con slots ya resueltos y confirmar que readiness no los reabra.";
    case "loop_reentry":
      return "Comparar respuestas consecutivas del mismo probe y exigir delta estructural por turno.";
    case "handoff_too_early":
      return "Repetir probes de quote/support y verificar que no aparezca coordinacion o derivacion sin blocked reason.";
    default:
      return "Repetir el mismo playbook y medir descenso de la categoria sin compensar con wording.";
  }
}

export function buildProbeActionPlan({ runId, summary, findingsSummary, playbookSummary }) {
  const prioritizedActions = findingsSummary.topProblems.slice(0, 5).map((problem) => ({
    priority: actionPriority(problem),
    category: problem.category,
    count: problem.count,
    likely_layer: problem.likely_layer,
    root_cause_hypothesis: problem.root_cause_hypothesis,
    global_fix_direction: problem.global_fix_direction,
    reject_local_patch_reason: problem.reject_local_patch_reason,
    validation_hint: validationHintForCategory(problem.category),
    evidence: problem.evidence
  }));

  return {
    runId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalScenarios: summary.totalConversations,
      totalTurns: summary.totalEvaluatedTurns,
      totalFindings: summary.totalFindings,
      playbookId: playbookSummary.playbookId,
      scenarioCount: playbookSummary.scenarioCount
    },
    prioritizedActions,
    continuousImprovementLoop: [
      "Ejecutar el mismo playbook contra el webchat real despues de cada cambio estructural.",
      "Comparar taxonomy/layer contra la corrida anterior antes de aceptar el cambio.",
      "Mantener corpus real y probes sinteticos en paralelo para no optimizar solo un tipo de entrada.",
      "No promover a produccion mientras persistan hallazgos high/critical en flujos base."
    ],
    recommendedNextIteration:
      prioritizedActions.length > 0 ? "implementation_with_live_validation" : "rerun_validation"
  };
}

export function buildProbeActionPlanMarkdown(plan) {
  const lines = [
    "# Live Webchat Probe Action Plan",
    "",
    `Run ID: ${plan.runId}`,
    `Generated at: ${plan.generatedAt}`,
    `Scenarios: ${plan.summary.totalScenarios}`,
    `Turns: ${plan.summary.totalTurns}`,
    `Findings: ${plan.summary.totalFindings}`,
    `Playbook: ${plan.summary.playbookId}`,
    "",
    "## Prioritized Actions",
    ""
  ];

  for (const action of plan.prioritizedActions) {
    lines.push(`### ${action.priority} ${action.category} (${action.count})`);
    lines.push("");
    lines.push(`Likely layer: ${action.likely_layer || "n/a"}`);
    lines.push(`Root cause hypothesis: ${action.root_cause_hypothesis || "n/a"}`);
    lines.push(`Global fix direction: ${action.global_fix_direction || "n/a"}`);
    lines.push(`Reject local patch reason: ${action.reject_local_patch_reason || "n/a"}`);
    lines.push(`Validation hint: ${action.validation_hint}`);
    if (Array.isArray(action.evidence) && action.evidence.length > 0) {
      lines.push("");
      lines.push("Evidence:");
      for (const evidence of action.evidence) {
        lines.push(
          `- ${evidence.conversationId} / ${evidence.turn} / ${evidence.severity}: ${evidence.current_response_problem}`
        );
      }
    }
    lines.push("");
  }

  lines.push("## Continuous Improvement Loop");
  lines.push("");
  for (const item of plan.continuousImprovementLoop) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## Recommendation");
  lines.push("");
  lines.push(`- ${plan.recommendedNextIteration}`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}
