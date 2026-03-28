# AI Conversation-to-Knowledge Draft Design

## 1. Propósito

Este documento define el diseño técnico concreto del slice productivo `conversation-to-knowledge-draft`.

Objetivo:

- observar conversaciones reales ya persistidas
- sintetizar borradores de conocimiento abstracto y reutilizable
- mantener trazabilidad fuerte hacia bundles, candidatos y eventos origen
- pasar siempre por revisión humana antes de impactar conocimiento activo
- reutilizar el módulo `knowledge` actual sin crear un subsistema paralelo

Debe leerse junto con:

- [AI_ACTIVE_KNOWLEDGE_INGESTION_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_ACTIVE_KNOWLEDGE_INGESTION_PLAN.md)
- [AI_RUNTIME_MINIMAL_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_RUNTIME_MINIMAL_DESIGN.md)
- [AI_KNOWLEDGE_ADMIN_ABM_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_KNOWLEDGE_ADMIN_ABM_PLAN.md)
- [AI_KNOWLEDGE_SNAPSHOT_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_KNOWLEDGE_SNAPSHOT_PLAN.md)
- [AI_CONVERSATIONAL_BEHAVIOR_ANALYSIS.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATIONAL_BEHAVIOR_ANALYSIS.md)

## 2. Alcance y regla central

Este slice no reemplaza:

- `KnowledgeRawEvent`
- `KnowledgeCandidate`
- `KnowledgeConversationBundle`
- `KnowledgeDocument`
- `KnowledgeSnapshot`

Los ordena en una tubería productiva nueva:

```text
Conversation / Bundle / Candidate / Feedback
  -> selección elegible
  -> síntesis abstracta
  -> KnowledgeDocument(status=DRAFT)
  -> revisión HITL
  -> promote to ACTIVE / reject / merge
  -> reindex + snapshot stale
```

Regla central:

- QA sigue midiendo comportamiento
- producción sigue observando comportamiento
- solo HITL promueve conocimiento activo

## 3. Qué se reutiliza y qué se agrega

### 3.1 Reutilización obligatoria

Se reutiliza el modelo actual:

- [schema.prisma](/Users/rodrigo/git/personal/react_admin_dashboard/backend/prisma/schema.prisma)
  - `KnowledgeRawEvent` como observación cruda ya normalizada
  - `KnowledgeCandidate` como unidad puntual revisable
  - `KnowledgeConversationBundle` como unidad multi-turno
  - `KnowledgeDocument` como artefacto final, incluyendo borradores con `status=DRAFT`

Esto evita crear una entidad paralela tipo `DraftDocument`.

### 3.2 Agregados mínimos nuevos

Se agregan solo dos piezas persistidas nuevas:

1. `KnowledgeDraftSynthesisRun`
- traza una corrida productiva de síntesis
- guarda selección, métricas y errores

2. `KnowledgeDraftSource`
- liga cada `KnowledgeDocument(status=DRAFT)` con sus fuentes exactas
- permite auditoría y diff por origen

Todo lo demás se apoya inicialmente en `metadata` y `tags` de modelos ya existentes.

## 4. Modelo de datos concreto

## 4.1 Reutilización directa de `KnowledgeDocument`

La salida del slice productivo debe ser un `KnowledgeDocument` ya real:

- `status = DRAFT`
- `sourceType = CONVERSATION_DERIVED`
- `sourceKey = synth:{tenantKey}:{scope}:{clusterKeyOrRunId}`

Esto permite:

- listar borradores sin una tabla nueva de documentos
- usar el mismo ABM de documentos para edición/promoción
- mantener un solo punto de publicación hacia retrieval

## 4.2 Nuevos enums

```prisma
enum KnowledgeDraftSynthesisRunStatus {
  RUNNING
  COMPLETED
  FAILED
  CANCELED
}

enum KnowledgeDraftSourceKind {
  KNOWLEDGE_RAW_EVENT
  KNOWLEDGE_CANDIDATE
  KNOWLEDGE_CONVERSATION_BUNDLE
  KNOWLEDGE_NEGATIVE_EXAMPLE
  KNOWLEDGE_FEEDBACK
}

enum KnowledgeDraftSourceRole {
  PRIMARY_PATTERN
  SECONDARY_PATTERN
  POSITIVE_EXAMPLE
  NEGATIVE_EXAMPLE
  CONSTRAINT
  SUPPORTING_CONTEXT
}
```

## 4.3 Nuevos modelos

```prisma
model KnowledgeDraftSynthesisRun {
  id                  String                          @id @default(cuid())
  tenantKey           String
  scope               KnowledgeDocumentScope
  status              KnowledgeDraftSynthesisRunStatus @default(RUNNING)
  triggerType         String
  sourceMode          String
  selectionFilter     Json?
  processedBundleCount Int                            @default(0)
  processedEventCount Int                             @default(0)
  createdDraftCount   Int                             @default(0)
  mergedDraftCount    Int                             @default(0)
  skippedCount        Int                             @default(0)
  errorCount          Int                             @default(0)
  metadata            Json?
  createdByUserId     Int?
  createdByUser       User?                           @relation("KnowledgeDraftSynthesisRunCreatedByUser", fields: [createdByUserId], references: [id], onDelete: SetNull)
  startedAt           DateTime                        @default(now())
  finishedAt          DateTime?
  createdAt           DateTime                        @default(now())
  updatedAt           DateTime                        @updatedAt

  @@index([tenantKey, scope, status, startedAt])
  @@index([createdByUserId, startedAt])
}

model KnowledgeDraftSource {
  id          String                   @id @default(cuid())
  tenantKey   String
  documentId  String
  document    KnowledgeDocument        @relation(fields: [documentId], references: [id], onDelete: Cascade)
  runId       String?
  sourceKind  KnowledgeDraftSourceKind
  sourceId    String
  sourceRole  KnowledgeDraftSourceRole
  excerpt     String?
  metadata    Json?
  createdAt   DateTime                 @default(now())
  updatedAt   DateTime                 @updatedAt

  @@index([documentId])
  @@index([tenantKey, runId, createdAt])
  @@index([sourceKind, sourceId])
}
```

## 4.4 Extensiones mínimas a modelos existentes

No conviene abrir una expansión fuerte de columnas en el primer slice. Para minimizar migraciones:

- `KnowledgeDocument.metadata` guarda la forma estructurada del draft sintetizado
- `KnowledgeConversationBundle.metadata` guarda elegibilidad y última síntesis
- `KnowledgeCandidate.metadata` guarda hints de síntesis y cluster

Campos nuevos persistidos solo si pasan a ser críticos de consulta. En esta fase:

- `runId`
- `draftKind`
- `questionPatterns`
- `genericFacts`
- `responseFlow`

quedan dentro de `KnowledgeDocument.metadata`.

## 4.5 Forma exacta del borrador sintetizado

`KnowledgeDocument.metadata` para `status=DRAFT` y `sourceType=CONVERSATION_DERIVED`:

```json
{
  "draftKind": "behavior_playbook",
  "synthesis": {
    "runId": "run_123",
    "triggerType": "manual_bundle_selection",
    "sourceMode": "bundle_cluster",
    "clusterKey": "quote_request.measurements.followup",
    "confidence": 0.87,
    "anonymized": true,
    "tenantSpecificity": "tenant_specific",
    "behaviorClass": "quote_request"
  },
  "questionPatterns": [
    {
      "label": "consulta inicial amplia",
      "intentKey": "customer.product_inquiry",
      "examples": [
        "consulta amplia de producto",
        "pedido de orientación sin datos completos"
      ]
    }
  ],
  "genericFacts": [
    {
      "key": "ask_minimum_required_data",
      "kind": "operational_rule",
      "value": "pedir solo el dato mínimo faltante",
      "confidence": 0.84
    }
  ],
  "responseFlow": [
    {
      "stepKey": "clarify_then_offer_next_step",
      "objective": "guiar sin reiniciar la conversación",
      "responseGuidance": "responder corto, confirmar comprensión y pedir un único dato",
      "askFor": ["medida", "variante", "zona"],
      "avoid": ["volcar catálogo completo", "pedir todos los datos otra vez"]
    }
  ],
  "sourceSummary": {
    "bundleCount": 4,
    "candidateCount": 7,
    "negativeExampleCount": 1
  }
}
```

`content` debe almacenar una versión markdown legible del mismo draft:

- resumen
- patrones de pregunta
- facts abstractos
- flujo sugerido de respuesta
- guardrails
- notas de revisión

No deben incluirse:

- precios exactos
- datos sensibles
- nombres propios
- ids internos

## 5. Backend: estructura de archivos concreta

Ubicación propuesta:

```text
backend/src/knowledge/draft-synthesis/
  knowledge-draft-synthesis.controller.ts
  knowledge-draft-synthesis.service.ts
  knowledge-draft-generation.service.ts
  knowledge-draft-selection.service.ts
  knowledge-draft-source.service.ts
  knowledge-draft-review.service.ts
  dto/
    create-knowledge-draft-run.dto.ts
    list-knowledge-draft-runs.dto.ts
    review-knowledge-draft.dto.ts
    merge-knowledge-draft.dto.ts
  jobs/
    conversation-observation-backfill.job.ts
    conversation-bundle-refresh.job.ts
    knowledge-draft-synthesis.job.ts
    knowledge-draft-dedupe.job.ts
```

Integración mínima con archivos ya existentes:

- [knowledge.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/knowledge/knowledge.service.ts)
  - sigue siendo el facade principal para documents/candidates/search/index
- [knowledge.controller.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/knowledge/knowledge.controller.ts)
  - mantiene listados y detalle
  - delega nuevas acciones de draft al submódulo

## 6. Endpoints concretos

## 6.1 Runs de síntesis

```text
POST /api/ai/knowledge/draft-synthesis/runs
GET  /api/ai/knowledge/draft-synthesis/runs
GET  /api/ai/knowledge/draft-synthesis/runs/:id
POST /api/ai/knowledge/draft-synthesis/runs/:id/retry
POST /api/ai/knowledge/draft-synthesis/runs/:id/cancel
```

Uso:

- disparar síntesis manual desde bundles/candidates/overview
- inspeccionar métricas y errores
- relanzar una corrida fallida

Payload recomendado para crear run:

```json
{
  "scope": "CUSTOMER_PUBLIC",
  "triggerType": "manual_bundle_selection",
  "sourceMode": "bundle_cluster",
  "selection": {
    "bundleIds": ["bun_1", "bun_2"],
    "candidateIds": [],
    "includeApprovedOnly": false,
    "includeNegativeExamples": true,
    "maxSources": 20
  }
}
```

## 6.2 Listado y detalle de borradores

No hace falta un endpoint totalmente nuevo si el backend ya soporta listados de documentos con filtros.

Se extiende:

```text
GET /api/ai/knowledge/documents?status=DRAFT&sourceType=CONVERSATION_DERIVED
GET /api/ai/knowledge/documents/:id
PATCH /api/ai/knowledge/documents/:id
```

Filtros nuevos recomendados:

- `draftKind`
- `runId`
- `tenantSpecificity`
- `behaviorClass`

Esos filtros pueden mapear inicialmente a `metadata`.

## 6.3 Fuentes y trazabilidad del borrador

```text
GET /api/ai/knowledge/documents/:id/sources
```

Respuesta:

- documento draft
- fuentes ligadas en `KnowledgeDraftSource`
- resumen por tipo:
  - bundles
  - candidates
  - negative examples
  - feedback

## 6.4 Review HITL del borrador

```text
POST /api/ai/knowledge/documents/:id/review
POST /api/ai/knowledge/documents/:id/promote
POST /api/ai/knowledge/documents/:id/reject
POST /api/ai/knowledge/documents/:id/merge
```

Reglas:

- `review` guarda edición sin publicar
- `promote` cambia `status=DRAFT -> ACTIVE`, define aprobador y dispara index/snapshot stale
- `reject` archiva o elimina del backlog con motivo
- `merge` consolida dos borradores en uno y deja trazabilidad cruzada

## 6.5 Creación puntual desde superficies existentes

```text
POST /api/ai/knowledge/conversation-bundles/:id/create-draft
POST /api/ai/knowledge/candidates/:id/create-draft
POST /api/ai/knowledge/negative-examples/:id/create-draft
```

Estas rutas son atajos UI. Internamente deben delegar a `draft-synthesis/runs`.

## 7. Jobs concretos

## 7.1 `conversation-observation-backfill.job.ts`

Objetivo:

- asegurar que mensajes ya persistidos tengan `KnowledgeRawEvent`
- completar `messageElements`, `messageContextOrigin` y señales de comportamiento

Trigger:

- manual
- scheduled
- después de imports/crawl relevantes

## 7.2 `conversation-bundle-refresh.job.ts`

Objetivo:

- recalcular `KnowledgeConversationBundle`
- actualizar conteos, preview, intents, elegibilidad y `metadata.lastSynthesizedAt`

Trigger:

- al cerrar una conversación
- al aprobar/rechazar candidatos
- por corrida manual

## 7.3 `knowledge-draft-synthesis.job.ts`

Objetivo:

- tomar bundles/candidates/negative examples seleccionados
- agrupar por cluster conversacional
- generar uno o más `KnowledgeDocument(status=DRAFT)`
- persistir `KnowledgeDraftSource`

Salida mínima por draft:

- título abstracto
- resumen reutilizable
- patrones de pregunta
- facts genéricos
- flujo sugerido de respuesta
- guardrails y exclusiones

## 7.4 `knowledge-draft-dedupe.job.ts`

Objetivo:

- detectar drafts muy similares
- sugerir merge
- no fusionar automáticamente sin HITL

Señales:

- `clusterKey`
- `behaviorClass`
- solapamiento alto de `questionPatterns`
- mismas fuentes primarias

## 8. Pantallas admin concretas

## 8.1 `Knowledge Drafts`

Ruta:

- `/app/settings/ai/knowledge/drafts`

Objetivo:

- cola principal de borradores sintéticos

Columnas:

- título
- scope
- draft kind
- behavior class
- run
- estado
- última actualización
- fuentes

Acciones rápidas:

- abrir detalle
- editar
- promover
- rechazar
- merge

## 8.2 `Knowledge Draft Detail`

Ruta:

- `/app/settings/ai/knowledge/drafts/:id`

Bloques:

- resumen editable
- `questionPatterns`
- `genericFacts`
- `responseFlow`
- guardrails / exclusiones
- diff contra documento activo similar
- fuentes trazables
- historial de review

## 8.3 `Knowledge Draft Runs`

Ruta:

- `/app/settings/ai/knowledge/draft-runs`

Bloques:

- lista de corridas
- filtros por scope/trigger/status
- métricas por corrida
- errores
- accesos directos a drafts creados

## 8.4 Integración con superficies existentes

Extensiones mínimas sobre pantallas ya presentes:

- [AiKnowledgeConversationBundles](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/settings/AiKnowledgeConversationBundles/index.tsx)
  - botón `Create draft`
- [AiKnowledgeCandidates](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/settings/AiKnowledgeCandidates/index.tsx)
  - acción `Send to synthesis`
- [AiKnowledgeNegativeExamples](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/settings/AiKnowledgeNegativeExamples/index.tsx)
  - acción `Create guardrail draft`
- [AiKnowledgeOverview](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/settings/AiKnowledgeOverview/index.tsx)
  - widget `Recent draft runs`

## 9. Flujo operativo completo

```text
Conversation closes or reaches reviewable state
  -> Raw events exist / are backfilled
  -> Bundle is refreshed
  -> Operator or scheduled rule launches synthesis run
  -> Run groups sources and generates KnowledgeDocument(status=DRAFT)
  -> Sources are persisted in KnowledgeDraftSource
  -> Admin reviews and edits
  -> Promote to ACTIVE
  -> Reindex approved document
  -> Mark snapshot stale and regenerate
```

## 10. Relación con QA y herramientas ya existentes

Estas herramientas no pasan a ser fuente de verdad productiva:

- `tools/qa/generate-simulated-runtime-conversations.mjs`
- `tools/qa/evaluate-real-conversation-set.mjs`

Sí pueden seguir aportando:

- patrones para cobertura
- hipótesis de comportamiento
- señal para seleccionar qué conversaciones revisar

Pero el slice productivo debe leer solo datos ya persistidos en:

- conversaciones
- raw events
- bundles
- candidates
- feedback
- negative examples

## 11. Rollout incremental recomendado

### Fase 1

- crear `KnowledgeDraftSynthesisRun`
- crear `KnowledgeDraftSource`
- crear run manual desde bundles
- generar `KnowledgeDocument(status=DRAFT)` con metadata estructurada
- exponer `GET /documents/:id/sources`

### Fase 2

- agregar review/promote/reject/merge explícitos
- agregar pantallas `Drafts` y `Draft Runs`
- invalidar snapshot e index al promover

### Fase 3

- scheduled synthesis con filtros controlados
- dedupe suggestions
- métricas de throughput y ratio de promoción

## 12. Criterio de aceptación de este slice

El slice queda bien resuelto cuando:

- un operador puede seleccionar bundles/candidatos y lanzar una síntesis
- la salida queda persistida como `KnowledgeDocument(status=DRAFT)`
- cada draft muestra fuentes exactas revisables
- el draft puede editarse y promoverse desde admin
- la promoción actualiza index y snapshot sin tocar contenido no aprobado
- no aparece un subsistema paralelo de documentos fuera de `knowledge`
