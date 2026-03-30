#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { AiAgentRuntime } from "../../services/ai-agent-service/src/ai/agent.js";
import { InMemoryConversationStore } from "../../services/ai-agent-service/src/ai/memory/in-memory-conversation-store.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const DEFAULT_PLAYBOOK_PATH = path.join(
  process.env.HOME || "/Users/rodrigo",
  "Downloads",
  "knowledge-inputs",
  "customer-response-playbook.md"
);
const DEFAULT_OUTPUT_DIR = path.join(
  repoRoot,
  ".qa",
  "external-real-conversations",
  "whatsapp",
  "generated"
);
const DEFAULT_OUTPUT_PATH = path.join(DEFAULT_OUTPUT_DIR, "runtime-simulated-conversations.md");
const DEFAULT_METADATA_PATH = path.join(
  DEFAULT_OUTPUT_DIR,
  "runtime-simulated-conversations.json"
);

const roleCatalog = [
  {
    key: "customer_public",
    type: "customer",
    memoryTurns: 12,
    allowedTools: ["search_products"],
    forbiddenIntents: ["aberturas.register", "orders.manage", "catalog.manage"],
    requiresConfirmation: [],
    tone: "helpful_public",
    legacyScopes: ["customer_public"]
  },
  {
    key: "customer_authenticated",
    type: "customer",
    memoryTurns: 12,
    allowedTools: ["search_products"],
    forbiddenIntents: ["aberturas.register", "orders.manage", "catalog.manage"],
    requiresConfirmation: [],
    tone: "trusted_customer",
    legacyScopes: ["customer_authenticated", "customer_logged"]
  }
];

const DEFAULT_TOPIC_TAXONOMY = [
  {
    key: "product_family:cortina",
    label: "cortinas",
    kind: "product_family",
    aliases: ["cortinas", "cortina", "cortnas", "roller", "venecianas"],
    normalizationValue: "cortinas",
    familyLabel: "cortinas",
    tags: ["quote_requires_measurements", "quote_requires_quantity"]
  },
  {
    key: "product_topic:cortinas-roller",
    label: "cortinas roller",
    kind: "product_topic",
    aliases: ["cortinas roller", "roller", "roler", "roller blackout", "screen"],
    normalizationValue: "roller",
    parentKeys: ["product_family:cortina"],
    parentLabels: ["cortinas"],
    familyLabel: "cortinas",
    tags: ["quote_requires_measurements", "quote_requires_quantity"]
  },
  {
    key: "product_family:persiana",
    label: "persianas",
    kind: "product_family",
    aliases: [
      "persianas",
      "persiana",
      "persinas",
      "estera",
      "esteras",
      "estera de persiana",
      "esteras de persiana"
    ],
    normalizationValue: "persianas",
    familyLabel: "persianas",
    tags: ["quote_requires_measurements", "quote_requires_quantity"]
  },
  {
    key: "product_family:abertura",
    label: "aberturas",
    kind: "product_family",
    aliases: ["aberturas", "abertura", "abertruas", "abrturas", "ventana", "ventanas"],
    normalizationValue: "aberturas",
    familyLabel: "aberturas",
    tags: [
      "quote_requires_measurements",
      "quote_requires_quantity",
      "quote_requires_series",
      "quote_requires_glass",
      "quote_requires_color"
    ]
  },
  {
    key: "product_topic:aberturas-de-aluminio",
    label: "aberturas de aluminio",
    kind: "product_topic",
    aliases: ["aberturas de aluminio", "aluminio", "ventanas de aluminio"],
    normalizationValue: "aberturas de aluminio",
    parentKeys: ["product_family:abertura"],
    parentLabels: ["aberturas"],
    familyLabel: "aberturas",
    tags: [
      "quote_requires_measurements",
      "quote_requires_quantity",
      "quote_requires_series",
      "quote_requires_glass",
      "quote_requires_color"
    ]
  }
];

const DEFAULT_QUOTE_PROFILES = [
  {
    key: "quote_profile:cortinas_roller",
    label: "Cortinas roller",
    appliesToTopicKeys: ["product_topic:cortinas-roller"],
    appliesToTopicLabels: ["cortinas roller", "roller"],
    familyLabel: "cortinas",
    pricingStrategy: "immediate_square_meter",
    closureMode: "collect_then_price_or_handoff",
    measurementCarrierTerms: ["ventana", "ventanas", "vano", "vanos"],
    attributes: [
      {
        key: "measurements",
        label: "las medidas aproximadas (ancho por alto)",
        captureKind: "measurements",
        required: true
      },
      {
        key: "quantity",
        label: "cuántas unidades necesitás",
        captureKind: "quantity",
        required: true
      }
    ]
  },
  {
    key: "quote_profile:persianas",
    label: "Persianas",
    appliesToTopicKeys: ["product_family:persiana"],
    appliesToTopicLabels: ["persianas", "persiana", "estera de persiana"],
    familyLabel: "persianas",
    pricingStrategy: "handoff_only",
    closureMode: "collect_then_handoff",
    measurementCarrierTerms: ["ventana", "ventanas", "vano", "vanos", "paño", "paños"],
    attributes: [
      {
        key: "measurements",
        label: "las medidas aproximadas (ancho por alto)",
        captureKind: "measurements",
        required: true
      },
      {
        key: "quantity",
        label: "cuántas unidades necesitás",
        captureKind: "quantity",
        required: true
      },
      {
        key: "material",
        label: "si las querés en PVC o aluminio",
        captureKind: "enum",
        required: false,
        subjectPrefix: "en",
        options: [
          { value: "pvc", aliases: ["pvc"] },
          { value: "aluminio", aliases: ["aluminio"] }
        ]
      }
    ]
  },
  {
    key: "quote_profile:aberturas",
    label: "Aberturas",
    appliesToTopicKeys: ["product_family:abertura", "product_topic:aberturas-de-aluminio"],
    appliesToTopicLabels: ["aberturas", "aberturas de aluminio"],
    familyLabel: "aberturas",
    pricingStrategy: "parametric_exact_or_handoff",
    closureMode: "collect_then_price_or_handoff",
    measurementCarrierTerms: ["ventana", "ventanas", "puerta", "puertas", "vano", "vanos"],
    attributes: [
      {
        key: "measurements",
        label: "las medidas aproximadas (ancho por alto)",
        captureKind: "measurements",
        required: true
      },
      {
        key: "quantity",
        label: "cuántas unidades necesitás",
        captureKind: "quantity",
        required: true
      },
      {
        key: "series",
        label: "la serie",
        captureKind: "enum",
        required: true
      },
      {
        key: "glass",
        label: "el tipo de vidrio",
        captureKind: "enum",
        required: true
      },
      {
        key: "color",
        label: "el color",
        captureKind: "enum",
        required: true
      }
    ]
  }
];

const scenarios = [
  {
    id: "broad_followups_to_schedule",
    title: "Consulta amplia, follow-ups cortos y cambio a coordinación",
    turns: [
      "Hola, qué tal?",
      "Estoy buscando cortinas roller",
      "qué tipos tienen?",
      "Perfecto, quiero coordinar una visita"
    ],
    expectations: [
      {
        include: [/hola|buen/i, /ayudarte|ayudamos|necesitas/i],
        avoid: [/productos,\s*precios,\s*medidas,\s*env[ií]os/i]
      },
      {
        include: [/roller|cortinas/i, /opciones|precio|recomendaci[oó]n/i]
      },
      {
        include: [/screen/i, /blackout/i],
        avoid: [/no pude completar|asesor del equipo/i]
      },
      {
        include: [/coordinar/i, /zona|direcci[oó]n|d[ií]a|horario/i],
        avoid: [/roller blackout|screen y blackout/i]
      }
    ]
  },
  {
    id: "typos_price_and_payment_switch",
    title: "Typos, precio abierto y cambio a medios de pago",
    turns: [
      "hola necsto info",
      "precios cortnas",
      "roller blackout",
      "que medios de pagos aceptan"
    ],
    expectations: [
      {
        include: [/hola/i, /informaci[oó]n|consulta|ayudo/i]
      },
      {
        include: [/precio/i, /producto|medida/i],
        avoid: [/no pude completar|asesor del equipo/i]
      },
      {
        include: [/roller blackout/i],
        avoid: [/medios de pago/i]
      },
      {
        include: [/efectivo|transferencia|tarjetas/i],
        avoid: [/roller blackout|screen|blackout/i]
      }
    ]
  },
  {
    id: "reengagement_quote_to_coordination",
    title: "Reenganche después de presupuesto y paso a coordinación",
    turns: [
      "Quiero saber precios de cortinas roller",
      "blackout",
      "Hola, retomo esto",
      "Quiero coordinar la instalación"
    ],
    expectations: [
      {
        include: [/precio/i, /producto|medida/i]
      },
      {
        include: [/blackout/i]
      },
      {
        include: [/retomamos|seguimos|retomar/i]
      },
      {
        include: [/coordinar/i, /zona|direcci[oó]n|d[ií]a|horario/i],
        avoid: [/2\.40 x 2\.10/i]
      }
    ]
  },
  {
    id: "post_sale_support",
    title: "Postventa o service con paso operativo claro",
    turns: [
      "Tengo un producto instalado que necesita service",
      "Una parte dejó de funcionar",
      "Quiero coordinar una visita para revisarlo"
    ],
    expectations: [
      {
        include: [/service|revisi[oó]n|c[oó]mo seguir/i]
      },
      {
        include: [/qu[eé].*pasando|producto|detalle/i]
      },
      {
        include: [/coordinar/i, /zona|direcci[oó]n|disponibilidad|horario/i]
      }
    ]
  },
  {
    id: "business_faq_thread_switch",
    title: "FAQ operativa directa sin arrastre del hilo comercial",
    turns: [
      "Estoy buscando cortinas",
      "roller",
      "también necesito saber horarios",
      "y tienen teléfono?"
    ],
    expectations: [
      {
        include: [/opciones|categor[ií]a|producto|servicio/i]
      },
      {
        include: [/roller/i]
      },
      {
        include: [/lunes|viernes|9:00|18:00|horario/i],
        avoid: [/roller blackout|screen/i]
      },
      {
        include: [/099|tel[eé]fono|whatsapp|contacto/i],
        avoid: [/horario|roller/i]
      }
    ]
  },
  {
    id: "installation_side_question_after_quote",
    title: "Consulta lateral sobre instalación sin reabrir precio ni filtrar costos internos",
    turns: [
      "Hola tienen cortinas roller?",
      "Si necesito una de 2x2",
      "incluye instalacion?"
    ],
    expectations: [
      {
        include: [/roller|cortinas/i]
      },
      {
        include: [/USD 240,00|precio estimado/i],
        avoid: [/USD 60|por m²|por m2|a raz[oó]n de/i]
      },
      {
        include: [/instalaci[oó]n|alcance|coordinar|propuesta/i],
        avoid: [/USD 240,00|USD 60|2,00 x 2,00 m|a raz[oó]n de/i]
      }
    ]
  },
  {
    id: "schedule_intake_split_across_messages",
    title: "Agenda repartida entre varios mensajes cortos",
    turns: [
      "Prefiero agendar una visita para poder asesorarme mejor",
      "puedo el lunes",
      "a que hora podrian?",
      "es en avenida italia 1428. A las 14 estoy en casa. Mi teléfono es 099123456"
    ],
    expectations: [
      {
        include: [/coordinar/i, /d[ií]a|horario|direcci[oó]n|contacto/i]
      },
      {
        include: [/horario|proponga uno|te propongo uno/i],
        avoid: [/productos|prestaciones|roller blackout/i]
      },
      {
        include: [/horario|proponga uno|te propongo uno/i],
        avoid: [/productos|prestaciones|roller blackout/i]
      },
      {
        include: [/agendada|coordinada/i, /avenida italia 1428/i],
        avoid: [/actividad #|italia 1428,|roller blackout/i]
      }
    ]
  }
];

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

const parseRewritePayload = (input) => {
  const rawInput = String(input || "");
  const match = rawInput.match(
    /^Consulta original:\s*([\s\S]*?)\n\n(?:Borrador grounded|Borrador aprobado):\s*([\s\S]*)$/u
  );
  if (!match) {
    return {
      originalQuery: "",
      draft: rawInput.trim(),
      sources: ""
    };
  }
  const originalBlock = match[1].trim();
  const originalQuery = originalBlock
    .split(/\n\n(?:Clave sem[aá]ntica segura:|Fuentes aprobadas usadas:)/u)[0]
    .trim();
  const sourcesMatch = originalBlock.match(/\n\nFuentes aprobadas usadas:\s*([\s\S]*)$/u);
  return {
    originalQuery,
    draft: match[2].trim(),
    sources: sourcesMatch ? sourcesMatch[1].trim() : ""
  };
};

const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();

const trimToTwoSentences = (value, maxChars = 220) => {
  const sentences = String(value || "")
    .split(/(?<=[.!?])\s+/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 2);
  const candidate = compact(sentences.join(" "));
  return candidate.slice(0, maxChars).trim();
};

const rewriteWithPlaybook = ({ originalQuery, draft, maxChars }) => {
  const normalizedQuery = normalize(originalQuery);
  const normalizedDraft = normalize(draft);

  if (/que tipos tienen|tipos tienen|que variantes/i.test(normalizedQuery)) {
    if (normalizedDraft.includes("screen") && normalizedDraft.includes("blackout")) {
      return "Tenemos opciones screen y blackout. Si quieres, te cuento cuál conviene más según luz, privacidad y uso.";
    }
  }

  if (/medio|forma|pago|tarjeta|transferencia|debito|credito/i.test(normalizedQuery)) {
    return "Aceptamos efectivo, transferencia bancaria y tarjetas. Si quieres, te indico opciones o condiciones según el medio de pago.";
  }

  if (/horario|atienden|abren/i.test(normalizedQuery)) {
    return "Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00. Si quieres, después seguimos con tu consulta.";
  }

  if (/telefono|whatsapp|contacto/i.test(normalizedQuery)) {
    return "Sí, tenemos teléfono y WhatsApp para contacto. Si quieres, te comparto el número por este medio.";
  }

  if (/incluye instalacion|incluye instalación|instalacion|instalación/i.test(normalizedQuery)) {
    return "La instalación se confirma según el producto y el alcance del trabajo. Si quieres, lo dejamos en seguimiento con la propuesta.";
  }

  if (/coordinar|visita|instalacion|relevamiento|revision/i.test(normalizedQuery)) {
    return "Claro. Para coordinarlo, decime la zona o dirección y qué día u horario te queda mejor.";
  }

  if (/retomo|retomar/i.test(normalizedQuery)) {
    return "Claro, retomamos desde lo anterior. Si quieres, avanzamos con el siguiente paso.";
  }

  if (/service|no funciona|dejo de funcionar|revision/i.test(normalizedQuery)) {
    return "Claro. Contame qué está pasando y qué producto o servicio es, así vemos cómo seguir.";
  }

  if (/blackout/i.test(normalizedQuery) && /roller/i.test(normalizedDraft)) {
    return "Sí, también tenemos roller blackout. Son una buena opción cuando buscas mayor privacidad y menos entrada de luz.";
  }

  return trimToTwoSentences(draft, maxChars);
};

const buildPrimaryProviderReply = (input) => {
  const normalizedInput = normalize(input);
  const measureMatch = String(input || "").match(/(\d(?:[.,]\d+)?)\s*x\s*(\d(?:[.,]\d+)?)/i);

  if (/retomo|retomar/i.test(normalizedInput)) {
    return "Claro, retomamos desde lo anterior. Si quieres, seguimos con el presupuesto o con la coordinación.";
  }

  if (/presupuesto|precio|cotiz/i.test(normalizedInput) && /roller|cortina|producto/i.test(normalizedInput)) {
    return "Claro. ¿De qué producto o medida te gustaría saber el precio?";
  }

  if ((/presupuesto|precio|cotiz/i.test(normalizedInput) && measureMatch) || /medidas/i.test(normalizedInput)) {
    const measureText = measureMatch ? `${measureMatch[1]} x ${measureMatch[2]}` : "la medida indicada";
    return `Perfecto, tomo la medida de ${measureText}. ¿Es para una sola abertura o para más de una?`;
  }

  if (/dos ventanas|dos unidades|2 ventanas/i.test(normalizedInput)) {
    return "Perfecto, entonces sería para dos unidades. Si quieres, seguimos con la zona o con el siguiente dato necesario.";
  }

  if (/viendo opciones|buscando opciones|estoy buscando/i.test(normalizedInput)) {
    return "Perfecto. ¿Buscas opciones, precios o una recomendación?";
  }

  return "Claro. Contame un poco más y lo vemos.";
};

const buildGenericKnowledgeItems = (playbookContent) => [
  {
    id: "playbook-conversational-guidance",
    title: "Playbook conversacional derivado de chats reales",
    scope: "customer_public",
    sourceType: "curated_document",
    summary:
      "Respuestas cortas, un objetivo por turno, continuidad en follow-ups y cambio limpio hacia coordinación operativa.",
    snippet: compact(playbookContent).slice(0, 220),
    score: 0.35,
    metadata: {
      documentKind: "conversation_playbook",
      tags: ["conversation_playbook", "response_style"]
    }
  }
];

const buildKnowledgeRouter = (playbookContent) => {
  const generic = buildGenericKnowledgeItems(playbookContent);

  return async (query) => {
    const normalizedQuery = normalize(query);
    const items = [];

    if (/telefono|whatsapp|contacto/i.test(normalizedQuery)) {
      items.push({
        id: "fact-contact-1",
        title: "Contacto general",
        scope: "customer_public",
        sourceType: "curated_document",
        summary: "Canales de contacto disponibles: teléfono y WhatsApp.",
        snippet: "Contamos con teléfono y WhatsApp para contacto directo.",
        score: 0.96,
        metadata: {
          documentKind: "derived_web_fact",
          factType: "contact",
          pageKinds: ["contact_page"]
        },
        tags: ["contact"]
      });
    }

    if (/horario|atienden|abren|hoy/i.test(normalizedQuery)) {
      items.push({
        id: "fact-hours-1",
        title: "Horario de atención",
        scope: "customer_public",
        sourceType: "curated_document",
        summary: "La atención se realiza de lunes a viernes de 9:00 a 18:00.",
        snippet: "Horario de atención: lunes a viernes de 9:00 a 18:00.",
        score: 0.97,
        metadata: {
          documentKind: "derived_web_fact",
          factType: "business_hours",
          pageKinds: ["hours_page"]
        },
        tags: ["business_hours"]
      });
    }

    if (/pago|pagos|tarjeta|transferencia|debito|credito|cuotas/i.test(normalizedQuery)) {
      items.push({
        id: "fact-payments-1",
        title: "Medios de pago",
        scope: "customer_public",
        sourceType: "curated_document",
        summary: "Aceptamos efectivo, transferencia bancaria y tarjetas.",
        snippet: "Medios de pago disponibles: efectivo, transferencia bancaria y tarjetas.",
        score: 0.97,
        metadata: {
          documentKind: "derived_web_fact",
          factType: "payment_methods",
          pageKinds: ["payments_page"]
        },
        tags: ["payment_methods"]
      });
    }

    if (/instalacion|instalación|colocacion|colocación/i.test(normalizedQuery)) {
      items.push({
        id: "fact-installation-1",
        title: "Alcance comercial",
        scope: "customer_public",
        sourceType: "curated_document",
        summary: "La instalación puede depender del producto y del alcance, por lo que conviene confirmarla con la propuesta concreta.",
        snippet: "La instalación se confirma según el producto y el alcance del trabajo. Si querés, lo dejamos en seguimiento con la propuesta.",
        score: 0.94,
        metadata: {
          documentKind: "commercial_condition_fact",
          factType: "commercial_condition",
          pageKinds: ["faq_page"]
        },
        tags: ["installation", "commercial_condition"]
      });
    }

    if (/blackout/i.test(normalizedQuery)) {
      items.push({
        id: "fact-roller-blackout-1",
        title: "Opciones blackout",
        scope: "customer_public",
        sourceType: "curated_document",
        summary: "Dentro de esta categoría hay una variante blackout para mayor privacidad y control de luz.",
        snippet: "La variante blackout es útil cuando se busca menos entrada de luz.",
        score: 0.95,
        metadata: {
          documentKind: "product_fact",
          factType: "product_variant",
          pageKinds: ["product_page"]
        },
        tags: ["product_variant", "blackout"]
      });
    }

    if (/venecianas/i.test(normalizedQuery)) {
      items.push({
        id: "fact-venecianas-1",
        title: "Opciones venecianas",
        scope: "customer_public",
        sourceType: "curated_document",
        summary: "También trabajamos con venecianas para regular luz y privacidad.",
        snippet: "Las venecianas permiten orientar la luz con precisión.",
        score: 0.95,
        metadata: {
          documentKind: "product_fact",
          factType: "product_topic",
          pageKinds: ["product_page"]
        },
        tags: ["product_topic", "venecianas"]
      });
    }

    if (/roller/i.test(normalizedQuery)) {
      items.push({
        id: "fact-roller-1",
        title: "Opciones roller",
        scope: "customer_public",
        sourceType: "curated_document",
        summary: "La categoría roller incluye variantes screen y blackout.",
        snippet: "Trabajamos con opciones roller screen y blackout según luz y privacidad.",
        score: 0.96,
        metadata: {
          documentKind: "product_fact",
          factType: "product_topic",
          pageKinds: ["product_page"]
        },
        tags: ["product_topic", "roller"]
      });
    }

    if (/cortina|cortinas|opciones/i.test(normalizedQuery) && !items.length) {
      items.push({
        id: "fact-category-1",
        title: "Categoría general",
        scope: "customer_public",
        sourceType: "curated_document",
        summary: "Trabajamos con varias opciones dentro de la categoría consultada.",
        snippet: "Podemos orientar según uso, luz, privacidad y necesidad general.",
        score: 0.92,
        metadata: {
          documentKind: "product_fact",
          factType: "product_topic",
          pageKinds: ["product_page"]
        },
        tags: ["product_topic", "category"]
      });
    }

    return {
      items: [...items, ...generic]
    };
  };
};

export const createSimulationRuntime = async ({ playbookContent, rewriteEnabled }) => {
  const providerCalls = [];

  const backendClient = {
    runtimeRole: null,
    scoped(role) {
      return {
        ...this,
        runtimeRole: role,
        scoped: this.scoped
      };
    },
    getRuntimeConfig: async () => ({
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini",
      roleCatalog,
      customerGroundedRewriteEnabled: rewriteEnabled,
      customerGroundedRewriteMaxChars: 180,
      customerGreetingDefault: "Hola. ¿En qué podemos ayudarte hoy?"
    }),
    getActions: async () => [],
    getTopicTaxonomy: async () => ({
      tenantKey: "urucortinas",
      scope: "customer_public",
      items: DEFAULT_TOPIC_TAXONOMY,
      updatedAt: "2026-03-28T00:00:00.000Z"
    }),
    getQuoteProfiles: async () => ({
      tenantKey: "urucortinas",
      scope: "customer_public",
      items: DEFAULT_QUOTE_PROFILES,
      updatedAt: "2026-03-28T00:00:00.000Z"
    }),
    searchKnowledge: buildKnowledgeRouter(playbookContent),
    lookupOwnedCustomerDocument: async () => null,
    getUsageSnapshot: async () => ({
      usage: {
        total_tokens: 0,
        total_requests: 0,
        start_time: 0,
        end_time: 0,
        source: "openai",
        error: null
      },
      costs: {
        total_spent: 0,
        currency: "usd",
        start_time: 0,
        end_time: 0,
        source: "openai",
        error: null
      },
      quota: {
        budget_limit: 25,
        total_spent: 0,
        remaining: 25,
        exceeded: false,
        source: "openai",
        error: null,
        checked_at: "2026-03-28T00:00:00.000Z"
      }
    }),
    searchProducts: async (query) => {
      const normalizedQuery = normalize(query);
      if (/roller/.test(normalizedQuery)) {
        return [
          {
            id: 1,
            name: "Cortina Roller",
            currency: "USD",
            amount: 60,
            unitOfMeasure: "SQUARE_METER",
            mode: "SIMPLE"
          }
        ];
      }

      if (/aberturas|aluminio/.test(normalizedQuery)) {
        return [
          {
            id: 2,
            name: "Aberturas de aluminio",
            currency: "USD",
            amount: null,
            unitOfMeasure: "UNIT",
            mode: "PARAMETRIC"
          }
        ];
      }

      return [{ id: 9, name: `Opción relacionada con ${query}`, currency: "UYU", amount: 0 }];
    },
    previewProductQuote: async (payload) => {
      const items =
        Array.isArray(payload?.items) && payload.items.length
          ? payload.items
          : [
              {
                widthMm: payload?.widthMm,
                heightMm: payload?.heightMm,
                quantity: payload?.quantity
              }
            ];
      const normalizedItems = items.map((item) => ({
        widthMm: Number(item?.widthMm || 0),
        heightMm: Number(item?.heightMm || 0),
        quantity: Number(item?.quantity || payload?.quantity || 1) || 1
      }));
      const hasMeasurements = normalizedItems.some(
        (item) => item.widthMm > 0 && item.heightMm > 0
      );
      const unitAmount = hasMeasurements ? 60 : 120;
      const previewItems = normalizedItems.map((item) => {
        const measurementPerUnit =
          item.widthMm > 0 && item.heightMm > 0
            ? (item.widthMm * item.heightMm) / 1_000_000
            : null;
        const totalAmount =
          measurementPerUnit == null ? unitAmount * item.quantity : measurementPerUnit * unitAmount * item.quantity;
        return {
          quantity: item.quantity,
          widthMm: item.widthMm || null,
          heightMm: item.heightMm || null,
          measurementPerUnit,
          effectiveQuantity:
            measurementPerUnit == null ? item.quantity : measurementPerUnit * item.quantity,
          totalAmount
        };
      });
      return {
        available: true,
        currency: "USD",
        quantity: normalizedItems.reduce((total, item) => total + item.quantity, 0),
        unitAmount,
        effectiveQuantity: previewItems.reduce(
          (total, item) => total + Number(item.effectiveQuantity || 0),
          0
        ),
        totalAmount: previewItems.reduce((total, item) => total + Number(item.totalAmount || 0), 0),
        items: previewItems
      };
    },
    prepareAberturasQuote: async () => ({
      itemCount: 1,
      readyItemCount: 0,
      summary: "Cotización paramétrica pendiente de revisión externa.",
      items: []
    }),
    searchAppointments: async () => [],
    createAppointment: async (payload) => ({
      id: 901,
      title: payload.title,
      startAt: payload.startAt,
      endAt: payload.endAt,
      type: "MEETING"
    }),
    searchCustomerAppointments: async () => [],
    createCustomerAppointment: async (payload) => ({
      id: 902,
      title: payload.title,
      startAt: payload.startAt,
      endAt: payload.endAt,
      type: "MEETING"
    }),
    extractAssets: async ({ assets }) => ({
      items: assets.map((asset) => ({
        assetType: asset.assetType ?? "text",
        fileName: asset.fileName ?? null,
        contentType: asset.contentType ?? null,
        source: "provided_text",
        stage: "deterministic",
        rawText: asset.textContent ?? asset.metadata?.rawText ?? null,
        normalizedText: asset.textContent ?? asset.metadata?.rawText ?? null,
        structuredRows: [],
        warnings: [],
        confidence: 0.95,
        requiresStructuredExtraction: true,
        usableForContext: true,
        debug: {
          byteLength: null,
          rowCount: 0,
          sheetCount: null,
          usedOpenAi: false,
          reason: "simulation"
        }
      }))
    })
  };

  const provider = {
    providerName: "openai",
    modelName: "gpt-4o-mini",
    generate: async (payload) => {
      providerCalls.push({
        input: payload.input,
        systemPrompt: payload.systemPrompt,
        role: payload.role
      });

      if (String(payload.input || "").includes("Borrador grounded:")) {
        const parsed = parseRewritePayload(payload.input);
        return {
          text: rewriteWithPlaybook({
            originalQuery: parsed.originalQuery,
            draft: parsed.draft,
            maxChars: 180
          }),
          toolCalls: []
        };
      }

      return {
        text: buildPrimaryProviderReply(payload.input),
        toolCalls: []
      };
    },
    extractStructured: async () => null
  };

  const runtime = new AiAgentRuntime({
    config: {
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      enabled: true
    },
    provider,
    memoryStore: new InMemoryConversationStore(),
    backendClient
  });

  return { runtime, providerCalls };
};

export const runConversation = async ({ runtime, conversationId, turns }) => {
  const outputs = [];
  for (const text of turns) {
    const response = await runtime.respond({
      conversationId,
      scope: "customer_public",
      tenantKey: "urucortinas",
      text
    });
    outputs.push(response);
  }
  return outputs;
};

const evaluateTurn = (responseText, expectation) => {
  const text = String(responseText || "");
  const includeChecks = (expectation.include || []).map((pattern) => ({
    ok: pattern.test(text),
    pattern: pattern.toString()
  }));
  const avoidChecks = (expectation.avoid || []).map((pattern) => ({
    ok: !pattern.test(text),
    pattern: pattern.toString()
  }));
  const shapeChecks = [
    {
      label: "chars<=220",
      ok: text.length <= 220
    },
    {
      label: "sentences<=2",
      ok: countSentences(text) <= 2
    },
    {
      label: "no_raw_leak",
      ok: !/cat[aá]logo ampliado|contactanos para solicitar|respuesta autom[aá]tica|urucortinas \u00b7/i.test(
        text
      )
    }
  ];

  const allChecks = [
    ...includeChecks.map((entry) => ({ label: `include ${entry.pattern}`, ok: entry.ok })),
    ...avoidChecks.map((entry) => ({ label: `avoid ${entry.pattern}`, ok: entry.ok })),
    ...shapeChecks
  ];
  const passed = allChecks.filter((entry) => entry.ok).length;
  return {
    passed,
    total: allChecks.length,
    score: allChecks.length ? Math.round((passed * 100) / allChecks.length) : 100,
    checks: allChecks
  };
};

const evaluateScenario = (responses, expectations) => {
  const turnEvaluations = responses.map((response, index) =>
    evaluateTurn(response.finalUserText || response.text || "", expectations[index] || {})
  );
  const averageScore = turnEvaluations.length
    ? Math.round(
        turnEvaluations.reduce((total, evaluation) => total + evaluation.score, 0) /
          turnEvaluations.length
      )
    : 100;
  return {
    averageScore,
    turnEvaluations
  };
};

const summarizeImprovement = (baselineScore, assistedScore) => {
  const delta = assistedScore - baselineScore;
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

const buildMarkdown = ({ playbookPath, scenarios: scenarioResults, summary }) => {
  const lines = [
    "# Simulaciones Conversacionales con Runtime + Playbook",
    "",
    `Generado: ${new Date().toISOString()}`,
    `Playbook usado: ${playbookPath}`,
    "",
    "Este archivo ejecuta escenarios multi-turno contra el runtime real en dos modos:",
    "- `base`: runtime con facts mínimos y sin grounded rewrite asistido.",
    "- `playbook-assisted`: mismo runtime, mismos facts y rewrite grounded breve guiado por el playbook conversacional.",
    "",
    "## Resumen",
    "",
    `- Escenarios ejecutados: ${summary.totalScenarios}.`,
    `- Score promedio base: ${summary.baselineAverage}.`,
    `- Score promedio playbook-assisted: ${summary.assistedAverage}.`,
    `- Diferencia promedio: ${summary.deltaAverage >= 0 ? "+" : ""}${summary.deltaAverage}.`,
    ""
  ];

  scenarioResults.forEach((scenario, index) => {
    lines.push(`## ${index + 1}. ${scenario.title}`);
    lines.push("");
    lines.push(`Resultado comparativo: ${scenario.comparison}.`);
    lines.push("");
    lines.push(
      `- Score base: ${scenario.baseline.evaluation.averageScore}`
    );
    lines.push(
      `- Score playbook-assisted: ${scenario.assisted.evaluation.averageScore}`
    );
    lines.push("");
    lines.push("### Chat generado (playbook-assisted)");
    lines.push("");
    scenario.turns.forEach((turn, turnIndex) => {
      const assistedResponse = scenario.assisted.responses[turnIndex];
      const baselineResponse = scenario.baseline.responses[turnIndex];
      lines.push(`Usuario: ${turn}`);
      lines.push(`Agente: ${assistedResponse.finalUserText || assistedResponse.text || ""}`);
      lines.push(
        `Evaluación turno: ${scenario.assisted.evaluation.turnEvaluations[turnIndex].score}/100`
      );
      if ((assistedResponse.finalUserText || assistedResponse.text || "") !== (baselineResponse.finalUserText || baselineResponse.text || "")) {
        lines.push(
          `Comparación base: ${baselineResponse.finalUserText || baselineResponse.text || ""}`
        );
      }
      lines.push("");
    });
  });

  return lines.join("\n");
};

export const generateSimulatedRuntimeConversations = async ({
  playbookPath = DEFAULT_PLAYBOOK_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
  metadataPath = DEFAULT_METADATA_PATH
} = {}) => {
  const playbookContent = await readFile(playbookPath, "utf8");
  const scenarioResults = [];

  for (const scenario of scenarios) {
    const baselineRuntime = await createSimulationRuntime({
      playbookContent,
      rewriteEnabled: false
    });
    const assistedRuntime = await createSimulationRuntime({
      playbookContent,
      rewriteEnabled: true
    });

    const baselineResponses = await runConversation({
      runtime: baselineRuntime.runtime,
      conversationId: `sim-${scenario.id}-base`,
      turns: scenario.turns
    });
    const assistedResponses = await runConversation({
      runtime: assistedRuntime.runtime,
      conversationId: `sim-${scenario.id}-assisted`,
      turns: scenario.turns
    });

    const baselineEvaluation = evaluateScenario(baselineResponses, scenario.expectations);
    const assistedEvaluation = evaluateScenario(assistedResponses, scenario.expectations);

    scenarioResults.push({
      id: scenario.id,
      title: scenario.title,
      turns: scenario.turns,
      baseline: {
        responses: baselineResponses.map((response) => ({
          text: response.text,
          finalUserText: response.finalUserText,
          intentKey: response.audit?.intentKey ?? response.auditPayload?.intentKey ?? null
        })),
        evaluation: baselineEvaluation,
        providerCalls: baselineRuntime.providerCalls.length
      },
      assisted: {
        responses: assistedResponses.map((response) => ({
          text: response.text,
          finalUserText: response.finalUserText,
          intentKey: response.audit?.intentKey ?? response.auditPayload?.intentKey ?? null
        })),
        evaluation: assistedEvaluation,
        providerCalls: assistedRuntime.providerCalls.length
      },
      comparison: summarizeImprovement(
        baselineEvaluation.averageScore,
        assistedEvaluation.averageScore
      )
    });
  }

  const baselineAverage = Math.round(
    scenarioResults.reduce((total, scenario) => total + scenario.baseline.evaluation.averageScore, 0) /
      Math.max(1, scenarioResults.length)
  );
  const assistedAverage = Math.round(
    scenarioResults.reduce((total, scenario) => total + scenario.assisted.evaluation.averageScore, 0) /
      Math.max(1, scenarioResults.length)
  );
  const summary = {
    totalScenarios: scenarioResults.length,
    baselineAverage,
    assistedAverage,
    deltaAverage: assistedAverage - baselineAverage
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    buildMarkdown({ playbookPath, scenarios: scenarioResults, summary }),
    "utf8"
  );

  if (metadataPath) {
    await mkdir(path.dirname(metadataPath), { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          playbookPath,
          outputPath,
          summary,
          scenarios: scenarioResults
        },
        null,
        2
      ),
      "utf8"
    );
  }

  return {
    playbookPath,
    outputPath,
    metadataPath,
    summary
  };
};

const parseArgs = (argv) => {
  const options = {
    playbookPath: DEFAULT_PLAYBOOK_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    metadataPath: DEFAULT_METADATA_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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
    if (arg === "--no-metadata") {
      options.metadataPath = null;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: node tools/qa/generate-simulated-runtime-conversations.mjs [options]",
          "",
          "Options:",
          "  --playbook-path <path>   Playbook markdown file used as style guide.",
          "  --output-path <path>     Markdown output with generated chats.",
          "  --metadata-path <path>   JSON output with raw scenario data.",
          "  --no-metadata            Skip JSON metadata output."
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
  generateSimulatedRuntimeConversations(parseArgs(process.argv.slice(2)))
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
