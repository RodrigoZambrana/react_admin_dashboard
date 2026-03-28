# AI Active Knowledge Ingestion Plan

## 1. Propósito

Este documento define cómo evolucionar la base de conocimiento actual hacia un sistema de **ingesta activa de conocimiento con human-in-the-loop**, sin reemplazar la arquitectura vigente ni mover la autoridad al modelo.

Objetivo:

- capturar conocimiento útil desde interacciones reales
- estructurarlo de forma trazable
- validarlo con operadores humanos
- reutilizarlo en sugerencias y respuestas futuras
- mantener backend como autoridad final

Debe leerse junto con:

- [AI_OPERATING_MODEL.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_OPERATING_MODEL.md)
- [AI_IMPLEMENTATION_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_IMPLEMENTATION_PLAN.md)
- [AI_RUNTIME_MINIMAL_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_RUNTIME_MINIMAL_DESIGN.md)
- [AI_CONVERSATION_TO_KNOWLEDGE_DRAFT_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATION_TO_KNOWLEDGE_DRAFT_DESIGN.md)
- [AI_QUOTE_PROFILES_AND_DERIVED_TAXONOMY_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_QUOTE_PROFILES_AND_DERIVED_TAXONOMY_DESIGN.md)
- [AI_MULTIMODAL_EXECUTION_BACKLOG.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_MULTIMODAL_EXECUTION_BACKLOG.md)
- [ai-knowledge-base-plan.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/ai-knowledge-base-plan.md)

## 2. Estado actual relevante del repo

La base no parte de cero. Ya existe una foundation que conviene extender:

- canalización y persistencia conversacional:
  - [backend/src/conversations/conversations.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/conversations/conversations.service.ts)
  - [services/channel-adapter/src/normalization/unified-message.js](/Users/rodrigo/git/personal/react_admin_dashboard/services/channel-adapter/src/normalization/unified-message.js)
- runtime IA desacoplado:
  - [services/ai-agent-service/src/ai/agent.js](/Users/rodrigo/git/personal/react_admin_dashboard/services/ai-agent-service/src/ai/agent.js)
- extracción multimodal base:
  - [backend/src/ai/extraction/ai-asset-extraction.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/extraction/ai-asset-extraction.service.ts)
  - [services/ai-agent-service/src/ai/message-elements/interpret-message-elements.js](/Users/rodrigo/git/personal/react_admin_dashboard/services/ai-agent-service/src/ai/message-elements/interpret-message-elements.js)
- knowledge store ya existente:
  - [backend/src/knowledge/knowledge.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/knowledge/knowledge.service.ts)
  - [backend/src/knowledge/knowledge.controller.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/knowledge/knowledge.controller.ts)
  - [backend/prisma/schema.prisma](/Users/rodrigo/git/personal/react_admin_dashboard/backend/prisma/schema.prisma)
- UI admin ya existente para documentos/candidatos:
  - [frontend/src/views/settings/AiRuntimeSettings/AiRuntimeSettings.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/settings/AiRuntimeSettings/AiRuntimeSettings.tsx)

Hoy ya existen:

- `KnowledgeDocument`
- `KnowledgeCandidate`
- `KnowledgeDocumentEmbedding`
- ingestión de docs y datasets
- review manual de candidatos
- retrieval de documentos aprobados

Limitación actual:

- la base de conocimiento todavía depende demasiado de:
  - documentos curados
  - datasets backend
  - creación manual o semi-manual de candidatos
- no existe aún una **ingesta activa, continua y gobernada** desde conversaciones reales

## 3. Principios de diseño

La evolución propuesta debe respetar estas reglas:

- no reemplazar el sistema actual
- no mover la lógica de negocio al modelo
- no usar conocimiento no validado como fuente de verdad
- separar claramente:
  - datos crudos
  - observaciones estructuradas
  - conocimiento sugerido
  - conocimiento aprobado
- usar IA solo para:
  - clasificar relevancia
  - extraer estructura
  - resumir
  - proponer respuestas
- usar backend para:
  - validar
  - deduplicar
  - versionar
  - aprobar/rechazar
  - decidir publicación efectiva

## 4. Arquitectura objetivo

### 4.1 Capas

La arquitectura recomendada agrega una capa nueva sobre el módulo `knowledge` actual.

```text
Channels / Conversations / Inbox
  -> Active Ingestion
  -> Knowledge Extraction
  -> Human Review
  -> Approved Knowledge Store
  -> Suggestion Engine / AI Runtime Retrieval
```

### 4.2 Módulos propuestos

#### A. `ingestion-service`

Responsabilidad:

- observar fuentes reales
- decidir si una interacción merece extracción
- crear un registro trazable de observación

Ubicación sugerida:

```text
backend/src/knowledge/active-ingestion/
  knowledge-ingestion.service.ts
  knowledge-observation.service.ts
  knowledge-dedupe.service.ts
  jobs/
    conversation-ingestion.job.ts
```

Entradas naturales:

- mensajes inbound de:
  - WhatsApp
  - email
  - webchat
- respuestas de operadores
- respuestas IA aprobadas o reutilizadas

#### B. `knowledge-extractor`

Responsabilidad:

- transformar observaciones en estructura útil
- detectar:
  - intención
  - problema
  - contexto
  - respuesta dada
  - respuesta sugerida
  - tags
  - confidence

Ubicación recomendada:

```text
backend/src/knowledge/active-ingestion/
  knowledge-extractor.service.ts
  knowledge-observation-normalizer.ts
  knowledge-relevance.service.ts
```

Importante:

- el backend orquesta
- la extracción asistida por IA debe seguir entrando por el runtime IA o una interfaz interna controlada
- no conviene que backend se convierta en “cliente directo del modelo” si la frontera actual ya vive en `ai-agent-service`

#### C. `knowledge-store`

Responsabilidad:

- guardar observaciones, candidatos, documentos aprobados, embeddings y eventos de uso

Se apoya sobre el módulo actual:

- [backend/src/knowledge/knowledge.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/knowledge/knowledge.service.ts)

#### D. `suggestion-engine`

Responsabilidad:

- sugerir respuestas opcionales a operadores humanos
- priorizar:
  - conocimiento aprobado
  - similitud semántica
  - intención
  - scope
  - tenant

Ubicación sugerida:

```text
backend/src/knowledge/active-ingestion/
  suggestion-engine.service.ts
  similarity-ranking.service.ts
  operator-suggestion.service.ts
```

#### E. `validation-interface`

Responsabilidad:

- mostrar observaciones/candidatos
- permitir aprobar, editar, fusionar o rechazar
- exponer trazabilidad

No requiere una UI nueva desde cero. Puede extender:

- [frontend/src/views/settings/AiRuntimeSettings/AiRuntimeSettings.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/settings/AiRuntimeSettings/AiRuntimeSettings.tsx)

Y más adelante vivir también dentro del inbox/admin:

- [frontend/src/views/crm/ConversationsV2/ConversationsV2.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/crm/ConversationsV2/ConversationsV2.tsx)

#### F. `feedback-loop`

Responsabilidad:

- registrar si una sugerencia fue:
  - aceptada
  - editada
  - descartada
- alimentar ranking futuro
- disparar revisión periódica

## 5. Separación canónica de estados

El sistema debe distinguir cuatro niveles:

### 5.1 Datos crudos

Fuente de verdad primaria:

- `Conversation`
- `ConversationMessage`
- `InboxMessage`
- adjuntos originales

No deben considerarse conocimiento.

### 5.2 Observaciones estructuradas

Nuevo nivel recomendado:

- snapshot normalizado de una interacción potencialmente útil
- sin promoción automática a conocimiento aprobado

### 5.3 Conocimiento sugerido

Representa:

- una hipótesis reutilizable
- una respuesta sugerida
- una interpretación estructurada lista para revisión

### 5.4 Conocimiento aprobado

Vive en:

- `KnowledgeDocument`

Y es lo único que puede alimentar retrieval confiable del agente y sugerencias de alta confianza.

## 6. Modelo de datos propuesto

### 6.1 Reutilización de tablas existentes

Mantener:

- `KnowledgeDocument`
- `KnowledgeDocumentEmbedding`
- `KnowledgeCandidate`

Y extenderlas.

### 6.2 Tablas nuevas recomendadas

#### `KnowledgeObservation`

Propósito:

- representar una interacción real ya normalizada para evaluación posterior

Campos sugeridos:

```ts
{
  id,
  tenantKey,
  channel: 'whatsapp' | 'email' | 'webchat' | 'admin_chat' | ...,
  conversationId,
  messageId,
  sourceAuthorType,
  scope,
  userMessage,
  normalizedMessage,
  redactedMessage,
  operatorReply,
  aiReply,
  detectedIntent,
  contextJson,
  messageElementsJson,
  messageContextOriginJson,
  relevanceScore,
  confidence,
  status: 'new' | 'processed' | 'discarded',
  dedupeHash,
  createdAt,
  updatedAt
}
```

#### `KnowledgeIngestionRun`

Propósito:

- trazabilidad de procesos batch o incremental

Campos sugeridos:

```ts
{
  id,
  tenantKey,
  sourceType,
  triggerType: 'manual' | 'scheduled' | 'event',
  status: 'running' | 'completed' | 'failed',
  processedCount,
  createdCandidates,
  skippedCount,
  errorCount,
  startedAt,
  finishedAt,
  metadata
}
```

#### `KnowledgeSuggestionEvent`

Propósito:

- medir uso real de sugerencias y aprendizaje posterior

Campos sugeridos:

```ts
{
  id,
  tenantKey,
  conversationId,
  messageId,
  operatorUserId,
  candidateId,
  documentId,
  suggestionText,
  decision: 'accepted' | 'edited' | 'rejected' | 'ignored',
  finalText,
  createdAt
}
```

#### `KnowledgeConflict`

Opcional en fase posterior.

Propósito:

- detectar conocimiento contradictorio entre documentos aprobados/candidatos

### 6.3 Extensiones mínimas a tablas existentes

#### `KnowledgeCandidate`

Agregar progresivamente:

- `observationId`
- `detectedIntent`
- `contextJson`
- `suggestedResponse`
- `approvedResponse`
- `confidence`
- `clusterKey`
- `dedupeHash`
- `version`
- `sourceChannel`
- `messageElementsJson`

#### `KnowledgeDocument`

Agregar si hace falta:

- `supersedesDocumentId`
- `documentVersion`
- `originCandidateId`
- `conflictStatus`
- `lastReviewedAt`

## 7. Uso de elementos del chat por tipo

La ingesta activa no debe razonar solo sobre texto plano. Debe apoyarse en la capa ya existente de:

- `ExtractedAsset`
- `MessageElement`
- `messageContextOrigin`

Archivos relevantes:

- [backend/src/ai/extraction/ai-asset-extraction.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/extraction/ai-asset-extraction.service.ts)
- [services/ai-agent-service/src/ai/message-elements/interpret-message-elements.js](/Users/rodrigo/git/personal/react_admin_dashboard/services/ai-agent-service/src/ai/message-elements/interpret-message-elements.js)
- [services/ai-agent-service/src/ai/message-elements/build-message-context.js](/Users/rodrigo/git/personal/react_admin_dashboard/services/ai-agent-service/src/ai/message-elements/build-message-context.js)

### 7.1 Regla general

Para conocimiento derivado, cada observación debe conservar:

- texto del mensaje
- elementos interpretados
- origen del contexto
- referencia al mensaje original

### 7.2 Por tipo

#### `text`

Uso:

- intención
- pregunta explícita
- wording real del usuario

#### `image`

Uso:

- OCR
- descripción visual
- contexto de producto/incidencia

Guardar:

- resumen textual
- etiquetas relevantes
- referencia al adjunto original

#### `audio`

Uso:

- transcripción
- urgencia/tono si luego se agrega señal adicional

Guardar:

- transcripción normalizada
- confidence
- idioma si existe

#### `document`

Uso:

- políticas
- reclamos
- comprobantes
- especificaciones

Guardar:

- resumen
- excerpt relevante
- páginas o secciones si están disponibles

#### `table`

Uso:

- preguntas recurrentes desde CSV/XLSX
- lotes operativos
- listas de items o precios

Guardar:

- columnas
- filas resumidas
- datos relevantes normalizados

### 7.3 Regla de almacenamiento

No duplicar archivos binarios en el knowledge store.

Se debe guardar:

- referencia al mensaje/adjunto
- texto extraído o resumen estructurado
- metadata operativa útil

## 8. Flujo objetivo de punta a punta

### 8.1 Ingesta

```text
mensaje real -> filtro de relevancia -> observación estructurada
```

### 8.2 Extracción

```text
observación -> extracción determinística
          -> si no alcanza, extracción IA estructurada
          -> validación backend
          -> candidate sugerido
```

### 8.3 Human-in-the-loop

```text
candidate -> aprobar / editar / rechazar / fusionar
```

### 8.4 Publicación

```text
approve -> KnowledgeDocument activo -> indexado -> retrieval
```

### 8.5 Uso en tiempo real

#### Operador humano

```text
mensaje actual + contexto conversacional + conocimiento aprobado
-> sugerencias opcionales
```

#### Agente IA

```text
query actual + retrieval aprobado
-> mejor grounding
```

## 9. Integración con el agente actual

### 9.1 Lo que no cambia

- LangChain no pasa a orquestar conocimiento
- backend sigue validando
- `ai-agent-service` sigue siendo runtime conversacional
- `KnowledgeDocument` aprobado sigue siendo la base confiable de retrieval

### 9.2 Lo que sí cambia

#### A. Nuevo flujo de extracción

El backend debe poder pedir una extracción de conocimiento estructurado al runtime IA.

Contrato interno sugerido:

```ts
extractKnowledgeCandidate({
  tenantKey,
  scope,
  conversation,
  message,
  messageElements,
  previousMessages,
})
```

Respuesta esperada:

```ts
{
  relevant: boolean,
  confidence: number,
  detectedIntent: string | null,
  problemSummary: string | null,
  contextSummary: string | null,
  suggestedResponse: string | null,
  tags: string[],
  duplicateHints: string[],
}
```

#### B. Retrieval IA

El runtime debe seguir usando solo:

- `KnowledgeDocument` activos
- aprobados
- scope-safe

Nunca:

- observaciones crudas
- candidatos pendientes

#### C. Sugerencias al humano

El inbox/admin debe poder pedir sugerencias con un endpoint backend específico, sin meter esa lógica dentro del transcript del cliente.

## 10. Endpoints sugeridos

### 10.1 Sobre conocimiento activo

Nuevos endpoints recomendados:

- `POST /api/ai/knowledge/ingestion/runs/conversations`
- `GET /api/ai/knowledge/ingestion/runs`
- `GET /api/ai/knowledge/observations`
- `GET /api/ai/knowledge/observations/:id`
- `POST /api/ai/knowledge/observations/:id/extract`
- `POST /api/ai/knowledge/observations/:id/discard`

### 10.2 Sobre review

Extender o reutilizar:

- `GET /api/ai/knowledge/candidates`
- `POST /api/ai/knowledge/candidates/:id/review`

Agregar, si hace falta:

- `POST /api/ai/knowledge/candidates/:id/merge`
- `POST /api/ai/knowledge/candidates/:id/request-changes`

### 10.3 Sobre sugerencias en tiempo real

- `POST /api/ai/knowledge/suggestions`
- `POST /api/ai/knowledge/suggestions/feedback`

Payload típico:

```ts
{
  conversationId,
  messageId,
  scope,
  tenantKey,
  draftText?,
}
```

## 11. Estrategia de embeddings

### 11.1 Recomendación inicial

No introducir otra pieza nueva si no es necesaria.

Primera fase:

- seguir con PostgreSQL
- seguir con `KnowledgeDocumentEmbedding`
- mantener ranking híbrido:
  - lexical
  - vector
  - intent/tags/scope

### 11.2 Evolución posterior

Si el volumen crece:

- `pgvector` como opción preferible antes que meter una vector DB separada demasiado pronto
- reindex asíncrono por cola/job
- versionado de embeddings por modelo

## 12. Ejemplo mínimo de implementación en Node.js

### 12.1 Servicio de ingesta

```ts
// backend/src/knowledge/active-ingestion/knowledge-ingestion.service.ts
export class KnowledgeIngestionService {
  async ingestConversationMessage(messageId: string, actorUserId?: number) {
    const message = await this.loadConversationMessage(messageId)
    if (!this.isRelevantForKnowledge(message)) {
      return { created: false, reason: 'not_relevant' }
    }

    const observation = await this.createObservationFromMessage(message)
    const extraction = await this.knowledgeExtractor.extractFromObservation(observation)

    if (!extraction.relevant) {
      await this.markObservationDiscarded(observation.id, extraction)
      return { created: false, reason: 'extractor_rejected' }
    }

    const candidate = await this.createOrUpdateCandidate(observation, extraction, actorUserId)
    return { created: true, observationId: observation.id, candidateId: candidate.id }
  }
}
```

### 12.2 Servicio de sugerencias

```ts
// backend/src/knowledge/active-ingestion/operator-suggestion.service.ts
export class OperatorSuggestionService {
  async suggestForConversation(input) {
    const retrieval = await this.knowledge.retrieve({
      tenantKey: input.tenantKey,
      scope: input.scope,
      query: input.currentMessage,
      limit: 5,
    })

    return retrieval.items.map((item) => ({
      documentId: item.id,
      title: item.title,
      suggestedText: item.summary || item.content,
      score: item.score,
    }))
  }
}
```

## 13. Fases incrementales recomendadas

### Fase 1 — Formalizar observaciones

Objetivo:

- agregar `KnowledgeObservation`
- capturar mensajes relevantes desde conversaciones
- no automatizar todavía la promoción

Entrega:

- tablas nuevas
- endpoint de list/view
- creación manual o semiautomática desde conversación

### Fase 2 — Extracción IA estructurada

Objetivo:

- usar IA para convertir observaciones en candidatos estructurados

Entrega:

- extractor híbrido
- `CreateKnowledgeCandidate` enriquecido
- cola de revisión mejorada

### Fase 3 — UI HITL real

Objetivo:

- revisar, editar, aprobar o fusionar candidatos

Entrega:

- pantalla de revisión operativa
- vínculo al mensaje original
- diff entre sugerido y aprobado

### Fase 4 — Suggestion Engine para operadores

Objetivo:

- sugerencias opcionales en tiempo real durante la respuesta humana

Entrega:

- endpoint de sugerencias
- feedback de aceptación/edición/rechazo

### Fase 5 — Aprendizaje continuo

Objetivo:

- métricas
- dedupe
- conflictos
- revisión periódica

## 14. Riesgos a evitar

- publicar conocimiento derivado sin aprobación
- usar mensajes crudos con PII como retrieval confiable
- duplicar archivos binarios en las tablas de conocimiento
- mezclar feedback de operador con verdad aprobada sin versionado
- volver el sistema dependiente de un vector DB antes de que el flujo humano esté maduro
- meter este pipeline dentro de prompts o documentos dinámicos en vez de modelarlo en backend

## 15. Recomendación final

El camino correcto no es “más RAG” sino:

- observación estructurada
- extracción híbrida
- validación humana
- publicación controlada
- sugerencia opcional
- feedback trazable

La implementación actual ya tiene casi todas las piezas base:

- conversaciones canónicas
- runtime IA separado
- extracción multimodal
- knowledge store
- review de candidatos

Lo que falta es convertirlas en un **circuito activo, continuo y gobernado**.

Ese debe ser el siguiente paso del sistema de conocimiento.
