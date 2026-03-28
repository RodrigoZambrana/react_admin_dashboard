# AI Runtime Minimal Design

## 1. Propósito

Este documento define el diseño técnico mínimo para fortalecer la implementación actual del agente conversacional sin reescribir la arquitectura ni mover lógica al modelo.

Objetivo:

- ordenar el runtime actual
- volver explícitas las piezas ya existentes
- reducir lógica implícita
- mejorar mantenibilidad y observabilidad
- preparar una evolución incremental sin romper producción

Debe leerse junto con:

- [AI_OPERATING_MODEL.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_OPERATING_MODEL.md)
- [AI_IMPLEMENTATION_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_IMPLEMENTATION_PLAN.md)
- [AI_CONVERSATIONAL_CLOSURE_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATIONAL_CLOSURE_PLAN.md)
- [AI_CONVERSATIONAL_BEHAVIOR_ANALYSIS.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATIONAL_BEHAVIOR_ANALYSIS.md)
- [AI_CONVERSATION_TO_KNOWLEDGE_DRAFT_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATION_TO_KNOWLEDGE_DRAFT_DESIGN.md)
- [AI_QUOTE_PROFILES_AND_DERIVED_TAXONOMY_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_QUOTE_PROFILES_AND_DERIVED_TAXONOMY_DESIGN.md)
- [AI_CRITICAL_PROCESS_OWNERSHIP.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CRITICAL_PROCESS_OWNERSHIP.md)
- [AI_REUSABLE_CHATBOT_CAPABILITIES.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_REUSABLE_CHATBOT_CAPABILITIES.md)
- [AI_WORDING_HYBRID_STRATEGY.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_WORDING_HYBRID_STRATEGY.md)
- [AI_INSTALLATION_PRODUCT_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_INSTALLATION_PRODUCT_DESIGN.md)
- [AI_MULTIMODAL_EXECUTION_BACKLOG.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_MULTIMODAL_EXECUTION_BACKLOG.md)
- [canonical-messaging-contract.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/canonical-messaging-contract.md)
- [shared-messaging-primitives-spec.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/shared-messaging-primitives-spec.md)

## 2. Restricciones de diseño

Este diseño parte de acuerdos ya vigentes:

- no reescribir el sistema
- no reemplazar LangChain
- no mover lógica de negocio al modelo
- mantener backend como autoridad final
- mantener Redis como memoria operativa actual
- mantener `conversations.service.ts` como capa de persistencia y proyección

Por lo tanto:

- LangChain sigue siendo solo capa de acceso al modelo, tool calling y structured output
- el runtime propio sigue siendo el orquestador real
- el backend sigue validando y ejecutando

## 3. Diagnóstico breve del estado actual

La base actual es correcta, pero varias piezas todavía viven como lógica repartida:

- intención:
  - `deriveIntentKey`
  - `findActionIntent`
  - `inferActionIntentFromConversationContext`
- estado:
  - `taskState`
  - drafts
  - confirmaciones
  - fallbacks
- acciones:
  - parte en catálogo backend
  - parte en `buildOperationDraft*`
  - parte en `tryExecutePendingConfirmation`
- outcomes:
  - parte común
  - parte todavía hardcodeada por rama
- multimodalidad:
  - extracción ya existe
  - interpretación conversacional todavía no está formalizada por tipo de mensaje

El problema principal no es de capacidad sino de formalización.

## 4. Principio rector

La arquitectura debe converger a cinco capas internas dentro del runtime:

1. `Intent Engine`
2. `Agent State`
3. `Action Registry`
4. `Outcome Renderer`
5. `Message Element Interpreter`

Sin romper el flujo actual:

- input
- detección de intención
- precontexto
- draft
- confirmación
- ejecución backend
- verificación
- respuesta

## 4.1 Prioridades actuales
La fase actual ya no está dominada por problemas de “responder algo”, sino por problemas de coherencia y cierre correcto.

Prioridades activas:
- priorizar rewrite híbrido sobre claves seguras para mejorar fluidez y flexibilidad visibles
- mejorar handoff rico cuando el intake de cotización ya está completo
- cerrar el puente de estado entre soporte/postventa y agenda
- evitar que preguntas laterales reactiven por error un flujo de cotización previo
- mover decisiones comerciales inciertas, como instalación, a datos estructurados de backend
- usar wording híbrido solo como capa de naturalización, no como solución a errores semánticos

Traducción práctica:
- si el problema es de estado, se corrige en runtime
- si el problema es de política comercial, se corrige en backend o catálogo
- si el problema es de repetición o rigidez superficial, se corrige en wording híbrido

Orden recomendado para el próximo ciclo:
1. ampliar wording híbrido en claves seguras
2. enriquecer `quote_handoff`
3. cerrar `support_request -> schedule_request`
4. evitar reactivaciones erróneas de cotización
5. modelar instalación en backend

## 5. Módulo 1 — Intent Engine

### 5.1 Objetivo

Unificar la detección de intención en una sola entrada:

```ts
detectIntent(message, context) => IntentDetection
```

### 5.2 Estructura sugerida

```text
services/ai-agent-service/src/ai/intents/
  intent-registry.js
  detect-intent.js
  intent-types.js
  detectors/
    rule-detectors.js
    contextual-detectors.js
    hybrid-detectors.js
```

### 5.3 Contrato mínimo

```ts
type IntentDetection = {
  intent: string
  confidence: number
  source: 'rule' | 'llm' | 'hybrid'
  actionKey: string | null
  matchedKeywords: string[]
  decisionPath: string[]
  referencedMessages?: Array<{
    messageId: string | null
    createdAt: string | null
    preview: string | null
  }>
}
```

### 5.4 Intent Registry mínimo

```ts
type IntentRegistryEntry = {
  key: string
  label: string
  namespace: string
  priority: number
  keywords: string[]
  requiresConfirmation: boolean
  actionKey: string | null
  detector: (input: DetectIntentInput) => IntentMatchResult | null
}
```

### 5.5 Ejemplo

```js
{
  key: 'appointments.create',
  label: 'Crear cita',
  namespace: 'appointments',
  priority: 80,
  keywords: ['agendar cita', 'agendar visita', 'crear cita'],
  requiresConfirmation: true,
  actionKey: 'appointments.create',
  detector: ({ normalizedText }) => {
    if (!/\b(agendar|crear)\b/.test(normalizedText)) return null
    if (!/\b(cita|visita|actividad)\b/.test(normalizedText)) return null
    return {
      matched: true,
      confidence: 0.92,
      matchedKeywords: ['agendar', 'cita'],
      decisionPath: ['rule:verb', 'rule:entity'],
    }
  },
}
```

### 5.6 Migración progresiva

No reemplazar de golpe:

- `deriveIntentKey`
- `findActionIntent`
- `inferActionIntentFromConversationContext`

Plan:

1. crear `detectIntent()` como wrapper
2. internamente reutilizar las funciones actuales
3. emitir `IntentDetection` estándar
4. guardar en auditoría:
   - `intent`
   - `confidence`
   - `source`
   - `decisionPath`
5. mover luego reglas una por una al `intent-registry`

Resultado:

- no cambia el comportamiento
- sí cambia la forma de invocarlo y observarlo

## 6. Módulo 2 — Agent State

### 6.1 Objetivo

Hacer explícito el estado del agente que hoy está implícito en:

- `taskState`
- drafts
- confirmaciones
- `needsHuman`
- `fallbackReason`

### 6.2 Estructura sugerida

```text
services/ai-agent-service/src/ai/state/
  state-machine.js
  state-types.js
  transition-state.js
```

### 6.3 Estados mínimos

```ts
type AgentState =
  | 'IDLE'
  | 'INTENT_DETECTED'
  | 'DRAFT_CREATED'
  | 'WAITING_CONFIRMATION'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'HANDED_OFF'
```

### 6.4 Snapshot sugerido

```ts
type RuntimeTaskState = {
  taskId: string
  intentKey: string | null
  state: AgentState
  actionKey: string | null
  entities: Array<{ type: string; value: string }>
  draftRef: string | null
  confirmationRequired: boolean
  intentConfidence: number | null
  intentSource: 'rule' | 'llm' | 'hybrid' | null
  decisionPath: string[]
  status: 'open' | 'completed' | 'failed' | 'handoff'
  lastUpdate: string
  lastTransitionAt: string
  resetCount: number
  lastResetAt: string | null
}
```

### 6.5 Transiciones mínimas

```text
IDLE -> INTENT_DETECTED
INTENT_DETECTED -> DRAFT_CREATED
DRAFT_CREATED -> WAITING_CONFIRMATION
WAITING_CONFIRMATION -> EXECUTING
EXECUTING -> COMPLETED
EXECUTING -> FAILED
ANY -> HANDED_OFF
```

### 6.6 Integración con Redis actual

No cambiar el contrato base del snapshot.

Se mantiene:

- `conversationId`
- `turns`
- `summary`
- `compiledContext`
- `taskState`

Solo se formaliza `taskState`.

### 6.7 Función sugerida

```ts
transitionAgentState(snapshot, event) => {
  snapshot: ConversationSnapshot
  transition: {
    from: AgentState
    to: AgentState
    at: string
    reason: string
  }
}
```

## 7. Módulo 3 — Action Registry

### 7.1 Objetivo

Separar con claridad:

- intención
- acción
- draft
- ejecución

### 7.2 Estructura sugerida

```text
services/ai-agent-service/src/ai/actions/
  action-registry.js
  action-types.js
  action-resolver.js
  action-executor.js
```

### 7.3 Contrato mínimo

```ts
type ActionRegistryEntry = {
  key: string
  label: string
  intentKeys: string[]
  allowedRoles: string[]
  requiresAuth: boolean
  requiresConfirmation: boolean
  draftBuilder: string
  executor: string | null
  verifyEntity: 'customer' | 'product' | 'appointment' | 'order' | 'quote' | 'payment' | null
}
```

### 7.4 Ejemplo

```js
{
  key: 'products.create',
  label: 'Alta de producto',
  intentKeys: ['products.create'],
  allowedRoles: ['admin_operations'],
  requiresAuth: true,
  requiresConfirmation: true,
  draftBuilder: 'buildProductCreateDraft',
  executor: 'create_product',
  verifyEntity: 'product',
}
```

### 7.5 Resolver de acción

```ts
resolveAction(intentDetection, role, context) => {
  action: ActionRegistryEntry | null
  blocked: boolean
  reason: 'not_allowed' | 'ambiguous' | 'not_found' | null
}
```

### 7.6 Contrato runtime -> backend

No debe cambiar de forma disruptiva.

Contrato mínimo deseado:

```ts
type BackendActionExecutionRequest = {
  actionKey: string
  role: string
  confirmationId?: string | null
  targetId?: string | number | null
  payload: Record<string, unknown>
  conversationId: string
  taskId: string
}
```

```ts
type BackendActionExecutionResponse = {
  ok: boolean
  actionKey: string
  entity: string | null
  entityId: string | number | null
  verificationUrl: string | null
  result: Record<string, unknown> | null
  error: {
    code: string
    message: string
    retryable: boolean
  } | null
}
```

### 7.7 Beneficio

Hoy el backend ya ejecuta. Esta capa no cambia eso.

Lo que agrega es:

- contrato explícito
- observabilidad uniforme
- desacople entre intención y tool puntual

## 8. Módulo 4 — Outcome Renderer

### 8.1 Objetivo

Evitar que el wording final quede repartido por ramas.

### 8.2 Estructura sugerida

```text
services/ai-agent-service/src/ai/outcomes/
  outcome-renderer.js
  outcome-types.js
  shared-copy.js
```

### 8.3 Outcome types mínimos

```ts
type OutcomeType =
  | 'light'
  | 'success'
  | 'blocked'
  | 'missing-data'
  | 'low-confidence'
  | 'handoff'
  | 'provider-failure'
  | 'execution-failure'
  | 'partial-batch'
```

### 8.4 Contrato mínimo

```ts
type OutcomeRenderInput = {
  audience: 'customer' | 'admin'
  outcome: OutcomeType
  variant?: string | null
  context?: Record<string, unknown>
}
```

```ts
type OutcomeRenderOutput = {
  finalUserText: string
  debugSummary?: string | null
  auditPayload?: Record<string, unknown> | null
}
```

### 8.5 Regla de implementación

Los outcomes compartidos deben tener:

- semántica base común
- cierre adaptado por audiencia

Ejemplos:

- `blocked`
  - cliente: continúa asesor
  - admin: circuito interno / perfil operativo
- `missing-data`
  - cliente: “todavía necesito algunos datos”
  - admin: “todavía me faltan algunos datos para seguir”
- `low-confidence`
  - cliente: “no terminé de entender”
  - admin: “no terminé de identificar con claridad la entidad o contexto”

### 8.6 Integración con la salida actual

La salida final no debe cambiar de forma disruptiva.

Se mantiene:

- `finalUserText`
- `debugSummary`
- `auditPayload`

El renderer solo centraliza cómo se construyen.

## 9. Capa transversal — Message Element Interpreter

### 9.1 Objetivo

Formalizar cómo se interpreta el contenido de una conversación cuando el mensaje no es solo texto.

No alcanza con `ExtractedAsset`.

Hace falta una capa que traduzca mensajes y adjuntos a elementos conversacionales consistentes.

### 9.2 Estructura sugerida

```text
services/ai-agent-service/src/ai/message-elements/
  message-element-types.js
  build-message-elements.js
  summarize-message-elements.js
```

### 9.3 Contrato mínimo

```ts
type MessageElement =
  | {
      type: 'text'
      text: string
      normalizedText: string
    }
  | {
      type: 'image'
      fileName: string | null
      extractedText: string | null
      description: string | null
      confidence: number | null
      sourceAssetId: string | null
    }
  | {
      type: 'audio'
      fileName: string | null
      transcript: string | null
      confidence: number | null
      sourceAssetId: string | null
    }
  | {
      type: 'document'
      fileName: string | null
      mimeType: string | null
      extractedText: string | null
      sections: string[]
      sourceAssetId: string | null
    }
  | {
      type: 'table'
      fileName: string | null
      rows: Array<Record<string, unknown>>
      rowCount: number
      sourceAssetId: string | null
    }
```

### 9.4 Regla de interpretación

Para cada turno:

1. partir de `text`
2. agregar adjuntos extraídos como `MessageElement`
3. construir un resumen conversacional usable por:
   - detección de intención
   - inferencia contextual
   - drafts operativos
   - auditoría

### 9.5 Resultado esperado

Esto permite entender mejor casos como:

- cliente que manda solo una foto y luego escribe “esto”
- admin que manda PDF + “cargalo”
- audio con pedido de soporte
- excel con altas batch

### 9.6 Integración con backend actual

No reemplaza `ExtractedAsset`.

Relación:

- backend:
  - extrae
  - normaliza por tipo
  - devuelve `ExtractedAsset`
- runtime:
  - transforma `ExtractedAsset + text` en `MessageElement`
  - interpreta semánticamente el turno

## 10. Estructura mínima objetivo

```text
services/ai-agent-service/src/ai/
  agent.js
  intents/
    detect-intent.js
    intent-registry.js
    intent-types.js
  state/
    state-machine.js
    state-types.js
    transition-state.js
  actions/
    action-registry.js
    action-types.js
    action-resolver.js
    action-executor.js
  outcomes/
    outcome-renderer.js
    outcome-types.js
    shared-copy.js
  message-elements/
    message-element-types.js
    build-message-elements.js
    summarize-message-elements.js
```

## 11. Plan de implementación incremental

### Paso 1

Crear `detectIntent()` y hacerlo wrapper de la lógica actual.

Sin cambiar comportamiento.

### Paso 2

Agregar `state` explícito a `taskState`.

Sin cambiar Redis ni snapshots.

### Paso 3

Crear `Action Registry` mínimo reutilizando:

- action catalog backend
- `buildOperationDraft*`
- `tryExecutePendingConfirmation`

### Paso 4

Centralizar `Outcome Renderer` con los outcomes ya implementados.

### Paso 5

Agregar `Message Element Interpreter` sobre `ExtractedAsset`.

### Paso 6

Migrar ramas concretas una por una:

- `light`
- `blocked`
- `missing-data`
- `provider-failure`
- drafts confirmables

## 12. Riesgos a evitar

- duplicar reglas entre módulo nuevo y lógica vieja
- intentar reemplazar todo `agent.js` de una vez
- usar LLM para decidir la acción final
- mezclar `ExtractedAsset` con render de mensaje sin capa intermedia
- romper el contrato actual:
  - `finalUserText`
  - `debugSummary`
  - `auditPayload`

## 13. Quick wins inmediatos

1. extraer `detectIntent()` sin cambiar la lógica interna
2. agregar `state` al `taskState`
3. extraer `classifyProviderFailure()` a módulo propio
4. centralizar `Outcome Renderer` para outcomes compartidos
5. agregar `confidence` y `source` al `auditPayload`
6. convertir texto + adjuntos extraídos en `MessageElement[]` antes de inferencia contextual

## 14. Criterio de cierre

El rediseño mínimo puede considerarse correctamente encaminado cuando:

- el runtime siga funcionando sin quiebres
- la intención salga de una sola entrada pública
- el estado del agente sea explícito
- la acción tenga contrato reconocible
- la salida final se renderice por una capa común
- texto, imagen, audio, pdf y tabla puedan formar parte del mismo contexto conversacional interpretable
