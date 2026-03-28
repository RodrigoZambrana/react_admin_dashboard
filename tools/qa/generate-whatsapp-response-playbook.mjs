#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

const DEFAULT_CORPUS_DIR = path.join(repoRoot, ".qa", "external-real-conversations", "whatsapp");
const DEFAULT_OUTPUT_PATH = path.join(
  os.homedir(),
  "Downloads",
  "knowledge-inputs",
  "customer-response-playbook.md"
);
const DEFAULT_METADATA_PATH = path.join(
  os.homedir(),
  "Downloads",
  "knowledge-inputs",
  "customer-response-playbook.meta.json"
);

const ARCHETYPES = [
  {
    id: "broad_inquiry_progressive_narrowing",
    title: "Apertura + consulta amplia + acotación progresiva",
    signals: ["quote_request", "long_running_thread"],
    whyItMatters:
      "Muchas conversaciones arrancan con una necesidad general y se vuelven útiles recién cuando el agente ayuda a acotar sin reiniciar el hilo.",
    responsePattern: [
      "saludo breve y natural",
      "reconocer la categoría o necesidad general",
      "ofrecer un próximo paso concreto entre dos o tres caminos posibles",
      "mantener el hilo abierto para follow-ups cortos"
    ],
    example: [
      ["Usuario", "Hola, estoy buscando [categoría general]."],
      [
        "Agente",
        "Hola. Claro, trabajamos con [categoría general]. ¿Buscas opciones, precios o una recomendación?"
      ],
      ["Usuario", "[subtipo o variante]."],
      [
        "Agente",
        "Perfecto. Tenemos [subtipo o variante] dentro de [categoría general]. ¿Querés que te cuente opciones o que vayamos a precio?"
      ]
    ]
  },
  {
    id: "price_with_missing_data",
    title: "Consulta de precio con datos insuficientes",
    signals: ["quote_request", "quote_follow_up"],
    whyItMatters:
      "El patrón más sano no es inventar un valor, sino pedir solo el dato mínimo que falta para orientar el precio.",
    responsePattern: [
      "confirmar que se entendió que la persona busca precio o presupuesto",
      "pedir una sola variable faltante por turno",
      "si ya existe una categoría activa, no volver a preguntar desde cero",
      "evitar listas largas de variables si todavía no hacen falta"
    ],
    example: [
      ["Usuario", "Quiero saber el precio."],
      [
        "Agente",
        "Claro. ¿De qué [producto/servicio] o medida te gustaría saber el precio?"
      ],
      ["Usuario", "[categoría] [subtipo]."],
      [
        "Agente",
        "Perfecto. Para orientarte mejor, decime [medida mínima necesaria] y seguimos desde ahí."
      ]
    ]
  },
  {
    id: "measurements_and_attachments",
    title: "Medidas, referencias y adjuntos",
    signals: ["structured_measurements", "multimodal_image", "multimodal_pdf", "multimodal_audio"],
    whyItMatters:
      "Una gran parte del valor conversacional aparece cuando el usuario aporta medidas, fotos, audios o documentos y espera que el agente los integre sin perder continuidad.",
    responsePattern: [
      "reconocer que llegó información concreta",
      "resumir de forma breve lo entendido, sin copiar todo el payload",
      "pedir únicamente el dato faltante o proponer el siguiente paso operativo",
      "si hay adjunto, usarlo como contexto válido y no como metadata decorativa"
    ],
    example: [
      ["Usuario", "Te paso una foto y las medidas: [ancho] x [alto]."],
      [
        "Agente",
        "Perfecto, ya vi la referencia y tomo la medida de [ancho] x [alto]. ¿Querés que sigamos con opciones o con una estimación?"
      ],
      ["Usuario", "Quiero presupuesto."],
      [
        "Agente",
        "Bien. Para dejarlo mejor encaminado, decime [dato mínimo faltante, por ejemplo zona o cantidad] y continúo."
      ]
    ]
  },
  {
    id: "operational_thread_switch",
    title: "Cambio de consulta a coordinación operativa",
    signals: ["operational_thread_switch", "appointment_scheduling"],
    whyItMatters:
      "Es frecuente que un hilo empiece en modo consulta y luego cambie a coordinación, visita, instalación o seguimiento dentro de la misma conversación.",
    responsePattern: [
      "detectar el cambio de eje sin arrastrar texto innecesario del tema anterior",
      "cerrar implícitamente el tema previo y abrir el nuevo paso operativo",
      "pedir zona, día o franja horaria como siguiente dato mínimo",
      "mantener tono resolutivo y breve"
    ],
    example: [
      ["Usuario", "Perfecto, entonces quiero coordinar [visita/instalación/relevamiento]."],
      [
        "Agente",
        "Claro. Para coordinarlo, decime [zona o dirección] y qué [día/horario] te queda mejor."
      ],
      ["Usuario", "[día]."],
      ["Agente", "Bien. ¿Te sirve [franja horaria] o preferís otra?"]
    ]
  },
  {
    id: "reengagement_after_gap",
    title: "Reenganche después de una pausa",
    signals: ["reengagement_after_gap", "outbound_follow_up", "long_running_thread"],
    whyItMatters:
      "Muchas conversaciones no son lineales; vuelven a activarse luego de horas o días y el agente debe retomar el hilo sin empezar de cero.",
    responsePattern: [
      "reconocer que se retoma el hilo",
      "retomar solo el contexto relevante, no todo el historial",
      "mover rápido la conversación al siguiente paso útil",
      "si la persona trae un tema nuevo, priorizar el cambio de eje"
    ],
    example: [
      ["Usuario", "Hola, retomo esto."],
      [
        "Agente",
        "Claro. Retomamos desde [tema activo]. ¿Querés seguir con eso o avanzar con [siguiente paso]?"
      ],
      ["Usuario", "Quiero coordinarlo."],
      ["Agente", "Perfecto. Decime [zona/día/horario] y lo encauzamos."]
    ]
  },
  {
    id: "support_or_post_sale",
    title: "Soporte o postventa",
    signals: ["support_service"],
    whyItMatters:
      "Cuando el usuario vuelve con un problema o ajuste, la respuesta útil no es vender de nuevo sino entender el inconveniente y pedir el contexto mínimo.",
    responsePattern: [
      "reconocer que se trata de un caso ya existente o de postventa",
      "pedir producto o servicio involucrado y síntoma concreto",
      "si corresponde, mover rápido a revisión o coordinación",
      "evitar mezclar este hilo con consultas comerciales nuevas"
    ],
    example: [
      ["Usuario", "Necesito service porque [problema]."],
      [
        "Agente",
        "Claro. Contame qué [producto/servicio] es y qué está pasando, así vemos cómo seguir."
      ],
      ["Usuario", "[detalle del problema]."],
      [
        "Agente",
        "Perfecto. Para encaminarlo, decime [zona/disponibilidad/referencia del caso] y avanzamos."
      ]
    ]
  },
  {
    id: "business_faq",
    title: "FAQ operativa o de negocio",
    signals: [],
    whyItMatters:
      "Hay consultas cortas que esperan respuesta directa y natural, no una derivación técnica ni un catálogo completo.",
    responsePattern: [
      "responder primero la pregunta puntual",
      "agregar una única línea opcional de ayuda adicional",
      "si falta precisión, pedir aclaración mínima",
      "no arrastrar contexto de producto si el usuario cambió a una FAQ operativa"
    ],
    example: [
      ["Usuario", "¿Cuál es el horario?"],
      ["Agente", "[respuesta directa y breve sobre horario]."],
      [
        "Usuario",
        "¿Y dónde están?"
      ],
      ["Agente", "[respuesta directa sobre ubicación o modalidad de atención]."]
    ]
  },
  {
    id: "channel_noise_and_auto_replies",
    title: "Ruido del canal, respuestas automáticas y mensajes no conversacionales",
    signals: ["system_message_interference", "auto_reply_present"],
    whyItMatters:
      "Los chats reales incluyen notificaciones de sistema y autores automáticos que deben quedar visibles pero no dominar el razonamiento.",
    responsePattern: [
      "ignorar mensajes de sistema o auto reply al reconstruir intención",
      "si el usuario responde después de un auto reply, tomar su mensaje como inicio real",
      "no contestar al ruido del canal",
      "persistir estos eventos para auditoría, pero con peso conversacional nulo o muy bajo"
    ],
    example: [
      ["Canal", "[mensaje automático fuera de horario o notificación del sistema]."],
      ["Usuario", "[consulta real]."],
      [
        "Agente",
        "Responder a la consulta real, sin mencionar ni seguir el mensaje automático salvo que el usuario lo pida explícitamente."
      ]
    ]
  }
];

const readJson = async (value) => JSON.parse(await readFile(value, "utf8"));

const median = (values) => {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
};

const countWords = (value) => {
  const matches = String(value || "").match(/\p{L}[\p{L}\p{N}_-]*/gu);
  return matches ? matches.length : 0;
};

const isBusinessHumanTurn = (turn) =>
  turn?.authorRole === "business" &&
  turn?.kind === "message" &&
  !String(turn?.normalizedText || "").includes("multimedia omitido");

const formatPercent = (value) => `${value.toFixed(1)}%`;

const loadCorpus = async (corpusDir) => {
  const indexPath = path.join(corpusDir, "index.json");
  const index = await readJson(indexPath);
  const manifests = await Promise.all(
    index.conversations.map((conversation) => readJson(conversation.manifestPath))
  );
  return { indexPath, index, manifests };
};

const buildResponseStats = (manifests) => {
  const businessTurns = [];

  for (const manifest of manifests) {
    for (const turn of manifest.turns ?? []) {
      if (isBusinessHumanTurn(turn)) {
        businessTurns.push(turn);
      }
    }
  }

  const wordCounts = businessTurns.map((turn) => countWords(turn.text));
  const questionTurns = businessTurns.filter(
    (turn) => String(turn.text || "").includes("?") || String(turn.text || "").includes("¿")
  ).length;
  const shortTurns = wordCounts.filter((count) => count <= 25).length;
  const oneSentenceTurns = businessTurns.filter((turn) => {
    const chunks = String(turn.text || "")
      .split(/[.!?]+/u)
      .map((entry) => entry.trim())
      .filter(Boolean);
    return chunks.length <= 2;
  }).length;

  return {
    totalBusinessTurns: businessTurns.length,
    avgWords: wordCounts.length
      ? wordCounts.reduce((total, current) => total + current, 0) / wordCounts.length
      : 0,
    medianWords: median(wordCounts),
    shortTurnsPct: businessTurns.length ? (shortTurns * 100) / businessTurns.length : 0,
    questionTurnsPct: businessTurns.length ? (questionTurns * 100) / businessTurns.length : 0,
    oneSentenceTurnsPct: businessTurns.length
      ? (oneSentenceTurns * 100) / businessTurns.length
      : 0
  };
};

const priorityForArchetype = (labelCounts, signals) =>
  signals.reduce((total, signal) => total + (labelCounts[signal] ?? 0), 0);

const buildArchetypeSections = (labelCounts) =>
  [...ARCHETYPES]
    .map((archetype) => ({
      ...archetype,
      signalCount: priorityForArchetype(labelCounts, archetype.signals)
    }))
    .sort((left, right) => {
      if (right.signalCount !== left.signalCount) {
        return right.signalCount - left.signalCount;
      }
      return left.title.localeCompare(right.title, "es");
    });

const buildPlaybookMarkdown = ({ index, responseStats, archetypes }) => {
  const labelCounts = index.summary?.labelCounts ?? {};
  const threadProfiles = index.summary?.threadProfileCounts ?? {};
  const topLabels = Object.entries(labelCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label, count]) => `\`${label}\` (${count})`);

  const lines = [
    "# Playbook Conversacional Derivado de Chats Reales",
    "",
    "Este documento consolida patrones de respuesta observados en conversaciones reales y los transforma en un insumo reutilizable para el sistema.",
    "Debe usarse para moldear continuidad, tono, estructura de respuesta y manejo de contexto.",
    "No debe usarse como fuente de verdad para precios exactos, políticas particulares, stock ni datos específicos de un negocio.",
    "",
    "## Cómo usar este archivo",
    "",
    "- Cargarlo como documento de apoyo conversacional, no como catálogo factual rígido.",
    "- Usarlo para replicar comportamiento y flujos, no para repetir texto literal.",
    "- Combinarlo con conocimiento factual aprobado: este archivo guía cómo responder; otros documentos responden qué decir en términos de facts.",
    "- Mantener placeholders y lenguaje general cuando el sistema no tenga todavía datos exactos.",
    "",
    "## Señales de origen",
    "",
    `- Conversaciones base: ${index.summary?.totalConversations ?? 0}.`,
    `- Turnos analizados: ${index.summary?.totalTurns ?? 0}.`,
    `- Respuestas humanas del negocio observadas: ${responseStats.totalBusinessTurns}.`,
    `- Respuestas cortas (<= 25 palabras): ${formatPercent(responseStats.shortTurnsPct)}.`,
    `- Respuestas con forma de pregunta guiada: ${formatPercent(responseStats.questionTurnsPct)}.`,
    `- Respuestas de una o dos oraciones: ${formatPercent(responseStats.oneSentenceTurnsPct)}.`,
    `- Promedio de palabras por respuesta: ${responseStats.avgWords.toFixed(1)} (mediana ${responseStats.medianWords}).`,
    `- Hilos predominantes del corpus actual: ${topLabels.join(", ")}.`,
    `- Perfiles de hilo: customer_initiated ${threadProfiles.customer_initiated ?? 0}, business_initiated ${threadProfiles.business_initiated ?? 0}, channel_interfered ${threadProfiles.channel_interfered ?? 0}.`,
    "",
    "## Principios base de respuesta",
    "",
    "- Responder corto y con un objetivo por turno.",
    "- Resolver primero la pregunta puntual y recién después ofrecer ampliar.",
    "- Pedir solo el dato mínimo faltante; evitar listas largas de preguntas en un mismo turno.",
    "- Mantener el contexto activo en follow-ups cortos y elípticos.",
    "- Detectar cuando el hilo cambió de consulta a coordinación operativa.",
    "- Si el usuario retoma una conversación, recuperar solo el contexto útil, no todo el historial.",
    "- Tratar adjuntos como contexto válido y no como metadata decorativa.",
    "- Ignorar el ruido del canal para razonamiento, aunque quede visible en auditoría.",
    "- No inventar valores exactos si faltan facts aprobados.",
    "- No volcar texto crudo, catálogos completos ni mensajes internos al usuario final.",
    "",
    "## Placeholders recomendados",
    "",
    "- `[categoría general]`",
    "- `[subtipo o variante]`",
    "- `[producto/servicio]`",
    "- `[medida mínima necesaria]`",
    "- `[ancho] x [alto]`",
    "- `[zona o dirección]`",
    "- `[día/horario]`",
    "- `[problema]`",
    "- `[siguiente paso]`",
    "",
    "## Flujos modelo derivados del corpus",
    ""
  ];

  archetypes.forEach((archetype, indexValue) => {
    lines.push(`### ${indexValue + 1}. ${archetype.title}`);
    lines.push("");
    if (archetype.signals.length) {
      lines.push(
        `Señal en el corpus actual: ${archetype.signals
          .map((signal) => `\`${signal}\` (${labelCounts[signal] ?? 0})`)
          .join(", ")}.`
      );
      lines.push("");
    }
    lines.push(archetype.whyItMatters);
    lines.push("");
    lines.push("Patrón de respuesta sugerido:");
    archetype.responsePattern.forEach((step) => lines.push(`- ${step}`));
    lines.push("");
    lines.push("Mini flujo modelo:");
    archetype.example.forEach(([speaker, message]) => {
      lines.push(`${speaker}: ${message}`);
    });
    lines.push("");
  });

  lines.push("## Buenas prácticas de wording");
  lines.push("");
  lines.push("- Empezar por confirmar comprensión implícita: `Claro`, `Perfecto`, `Bien`, `Sí`, solo si aporta continuidad.");
  lines.push("- Mantener tono humano y directo, sin lenguaje robótico ni frases de sistema.");
  lines.push("- Si ya existe contexto suficiente, evitar volver a preguntar `¿en qué podemos ayudarte?`.");
  lines.push("- En follow-ups, reutilizar el tópico activo en lugar de redefinir todo el contexto.");
  lines.push("- Si el usuario trae una FAQ operativa, responder directo y recién después ofrecer ampliar.");
  lines.push("- Si la persona comparte una medida, una foto o un audio, reflejar que ese dato fue tomado en cuenta.");
  lines.push("");
  lines.push("## Lo que este documento no debe disparar");
  lines.push("");
  lines.push("- No responder con precios, plazos o políticas exactas si no hay facts aprobados que los respalden.");
  lines.push("- No reemplazar validaciones de autorización ni ownership.");
  lines.push("- No mezclar este playbook con reglas internas del canal o mensajes automáticos.");
  lines.push("- No usarlo como justificativo para ignorar contexto factual aprobado.");
  lines.push("");
  lines.push("## Criterio de consumo dentro del sistema");
  lines.push("");
  lines.push("- Este archivo sirve para mejorar forma de respuesta y continuidad conversacional.");
  lines.push("- Debe combinarse con conocimiento factual separado, preferentemente aprobado y trazable.");
  lines.push("- Si falta información suficiente para responder con precisión, usar estos flujos para pedir el dato mínimo y seguir conversando con naturalidad.");
  lines.push("");

  return lines.join("\n");
};

export const generateWhatsAppResponsePlaybook = async ({
  corpusDir = DEFAULT_CORPUS_DIR,
  outputPath = DEFAULT_OUTPUT_PATH,
  metadataPath = DEFAULT_METADATA_PATH
} = {}) => {
  const { index, manifests } = await loadCorpus(corpusDir);
  const responseStats = buildResponseStats(manifests);
  const archetypes = buildArchetypeSections(index.summary?.labelCounts ?? {});
  const content = buildPlaybookMarkdown({ index, responseStats, archetypes });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");

  const metadata = {
    generatedAt: new Date().toISOString(),
    corpusDir,
    outputPath,
    conversations: index.summary?.totalConversations ?? manifests.length,
    turns: index.summary?.totalTurns ?? 0,
    responseStats,
    topLabels: Object.entries(index.summary?.labelCounts ?? {})
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count })),
    archetypes: archetypes.map((archetype) => ({
      id: archetype.id,
      title: archetype.title,
      signalCount: archetype.signalCount,
      signals: archetype.signals
    }))
  };

  if (metadataPath) {
    await mkdir(path.dirname(metadataPath), { recursive: true });
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
  }

  return metadata;
};

const parseArgs = (argv) => {
  const options = {
    corpusDir: DEFAULT_CORPUS_DIR,
    outputPath: DEFAULT_OUTPUT_PATH,
    metadataPath: DEFAULT_METADATA_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--corpus-dir") {
      options.corpusDir = argv[index + 1] ?? options.corpusDir;
      index += 1;
      continue;
    }
    if (arg.startsWith("--corpus-dir=")) {
      options.corpusDir = arg.slice("--corpus-dir=".length);
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
          "Usage: node tools/qa/generate-whatsapp-response-playbook.mjs [options]",
          "",
          "Options:",
          "  --corpus-dir <path>      Corpus directory with index.json and manifests.",
          "  --output-path <path>     Markdown output path for the generated playbook.",
          "  --metadata-path <path>   JSON metadata output path.",
          "  --no-metadata            Skip metadata JSON generation."
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
  generateWhatsAppResponsePlaybook(parseArgs(process.argv.slice(2)))
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
