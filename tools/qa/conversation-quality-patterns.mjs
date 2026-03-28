export const conversationQualityPatterns = [
  {
    id: "greeting_tone",
    label: "Greeting Tone",
    bucket: "missing_deterministic_rule",
    fixType: "response_shaping",
    layer: "baseline_runtime",
    severity: "P2",
    recommendation:
      "Ajustar saludo/configuración base para que sea corto, natural y consistente antes de cualquier llamada al proveedor.",
    matchers: [/greeting|saludo|hola|buenos d[ií]as|buenas tardes/i],
  },
  {
    id: "clarification_flow",
    label: "Clarification Flow",
    bucket: "missing_deterministic_rule",
    fixType: "inbound_classifier",
    layer: "pre_ai_decision_gate",
    severity: "P1",
    recommendation:
      "Reforzar clasificación previa e intención genérica para pedir solo el dato mínimo faltante sin caer a fallback técnico.",
    matchers: [
      /clarification|clarify|rephrase|incomplete|generic info|minimum detail|weak-object|ayuda|informaci[oó]n/i,
    ],
  },
  {
    id: "follow_up_continuity",
    label: "Follow-up Continuity",
    bucket: "faq_selection_gap",
    fixType: "intent_engine",
    layer: "context_continuity",
    severity: "P1",
    recommendation:
      "Corregir herencia de intención/tópico y reinterpretación de follow-ups elípticos antes del retrieval.",
    matchers: [
      /follow-up|follow up|continuity|continuidad|related follow-up|referential|topic continuity|y venecianas|variantes/i,
    ],
  },
  {
    id: "knowledge_grounding",
    label: "Knowledge Grounding",
    bucket: "knowledge_gap",
    fixType: "knowledge_selection",
    layer: "retrieval_grounding",
    severity: "P1",
    recommendation:
      "Ajustar ranking, facts derivados o shaping knowledge-first para priorizar la fuente aprobada correcta y evitar arrastre de catálogo.",
    matchers: [
      /knowledge|approved faq|location faq|contact faq|payment|hours|topic knowledge|dvh|roller|venecianas|aberturas|raw snippet/i,
    ],
  },
  {
    id: "provider_governance",
    label: "Provider Governance",
    bucket: "provider_overuse",
    fixType: "fallback_renderer",
    layer: "provider_policy",
    severity: "P1",
    recommendation:
      "Reducir llamadas innecesarias al proveedor y mejorar clasificación de quota/rate-limit/auth con fallback grounded y trazable.",
    matchers: [/provider|quota|rate limit|budget|rewrite|deduplicates repeated product search/i],
  },
  {
    id: "authorization_security",
    label: "Authorization And Security",
    bucket: "security_guard_gap",
    fixType: "security_policy",
    layer: "authorization",
    severity: "P0",
    recommendation:
      "Endurecer guards de autenticación/pertenencia/rol antes de retrieval, tools o exposición de datos sensibles.",
    matchers: [
      /authentication|authenticated|owned order|private|blocked|prompt injection|tool block|forbidden|security|unauthorized/i,
    ],
  },
  {
    id: "multimodal_contract",
    label: "Multimodal Contract",
    bucket: "multimodal_gap",
    fixType: "attachment_policy",
    layer: "multimodal",
    severity: "P1",
    recommendation:
      "Corregir contrato canónico de attachments/messageElements y asegurar interpretación, render y uso real por canal.",
    matchers: [
      /attachment|audio|image|video|message elements|multimodal|structured extraction|xlsx|csv/i,
    ],
  },
  {
    id: "execution_confirmation",
    label: "Execution Confirmation",
    bucket: "execution_guard_gap",
    fixType: "tool_registry",
    layer: "execution_guards",
    severity: "P1",
    recommendation:
      "Verificar draft, confirmación/cancelación y estado de ejecución antes de disparar acciones críticas.",
    matchers: [/confirm|confirmation|cancellation|waiting confirmation|confirm-execute lifecycle/i],
  },
  {
    id: "channel_parity_handoff",
    label: "Channel Parity And Handoff",
    bucket: "channel_parity_gap",
    fixType: "channel_contract",
    layer: "channel_projection",
    severity: "P1",
    recommendation:
      "Alinear preview, author, handoff, control mode y refresh entre storefront, admin y canal backend-first.",
    matchers: [/handoff|control mode|routing|queue|human|hybrid|parity|projected/i],
  },
  {
    id: "email_projection",
    label: "Email Projection",
    bucket: "channel_parity_gap",
    fixType: "channel_contract",
    layer: "email_channel",
    severity: "P1",
    recommendation:
      "Converger email al contrato canónico con historial, reply flow y proyección consistente en inbox.",
    matchers: [/email|mailbox|reply/i],
  },
  {
    id: "memory_task_state",
    label: "Memory And Task State",
    bucket: "missing_deterministic_rule",
    fixType: "intent_engine",
    layer: "memory_runtime",
    severity: "P1",
    recommendation:
      "Ajustar memoria de tarea y reset explícito para mantener continuidad útil sin contaminar temas distintos.",
    matchers: [/memory|task reset|task summary|current task|recent conversation context/i],
  },
  {
    id: "conversation_baseline",
    label: "Conversation Baseline",
    bucket: "fallback_quality_gap",
    fixType: "regression_test_only",
    layer: "conversation_baseline",
    severity: "P2",
    recommendation:
      "Agregar o refinar regresiones de conversación para cubrir wording, claridad y coherencia donde hoy el comportamiento no está explicitado.",
    matchers: [/.*/i],
  },
]

export const conversationQualityCoverageAreas = conversationQualityPatterns.map(
  ({ id, label, bucket, fixType, layer, severity, recommendation }) => ({
    id,
    label,
    bucket,
    fixType,
    layer,
    severity,
    recommendation,
  }),
)
