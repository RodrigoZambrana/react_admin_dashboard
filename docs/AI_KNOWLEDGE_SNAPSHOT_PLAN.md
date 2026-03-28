# AI Knowledge Snapshot Plan

## Objetivo

Definir una capa explícita de `Knowledge Snapshot` o `Agent Knowledge Digest` que permita responder con trazabilidad:

- qué conocimiento está usando hoy el sistema
- qué reglas positivas y negativas están activas
- de qué fuentes sale cada afirmación
- qué vacíos, conflictos o riesgos existen
- qué cambió después de una reingesta, aprobación o refresh

El foco no es describir “lo que sabe el LLM en sus pesos”. El foco es describir el conocimiento aprobado y operativo que el runtime puede usar hoy.

## Problema que resuelve

Hoy el sistema ya tiene:

- `Knowledge Documents`
- `Knowledge Candidates`
- `Knowledge Raw Events`
- `Knowledge Feedback`
- `Knowledge Conversation Bundles`
- `Knowledge Negative Examples`

Pero todavía no existe una vista consolidada y trazable de:

- qué conocimiento efectivo está vigente
- qué afirmaciones, reglas y respuestas salen de esas fuentes
- qué guardrails negativos están condicionando ranking o reuse
- qué contenido entró en conflicto o quedó obsoleto

Sin ese artefacto, es difícil alinear:

- lo que el equipo espera que el agente “sepa”
- lo que el sistema realmente está usando
- la fuente exacta que introdujo una desviación

## Principio central

El snapshot debe distinguir tres capas distintas.

### 1. Conocimiento aplicado

Forma parte de lo que el sistema considera vigente hoy.

Incluye:

- documentos activos aprobados
- candidatos aprobados/promovidos
- conversation bundles aprobados para uso operativo
- negative examples aprobados como guardrail activo

### 2. Señales de revisión

No forman parte del conocimiento operativo vigente, pero deben ser visibles como backlog, riesgo o trabajo pendiente.

Incluye:

- candidates pendientes
- raw events sin revisión
- bundles pendientes
- negative examples sin aprobar
- contenido archivado u obsoleto pendiente de limpiar

### 3. Señales históricas

No gobiernan la respuesta actual, pero sirven para auditoría y diff.

Incluye:

- versiones previas
- fuentes reemplazadas
- documentos archivados
- feedback histórico
- snapshots previos

## Aclaración sobre contenido no aprobado

La regla “no usar contenido no aprobado” requiere matiz.

No debe usarse contenido no aprobado para afirmar “esto es lo que sabe hoy el sistema”.

Pero sí debe poder mostrarse como:

- señal pendiente de revisión
- riesgo de conocimiento
- candidato a guardrail
- posible contradicción

En particular:

- `negative examples` aprobados sí forman parte del snapshot activo como guardrails negativos
- `negative examples` pendientes no forman parte del snapshot activo, pero sí deben aparecer como señales de revisión

## Resultado esperado

El sistema debe poder producir dos salidas complementarias.

### A. Snapshot estructurado

Pensado para UI, auditoría, diff y automatizaciones.

### B. Digest en texto plano

Pensado para revisión humana rápida.

Debe permitir leer:

- qué sabe hoy el agente
- qué límites y guardrails tiene
- qué cobertura tiene por tema/scope
- qué fuentes exactas respaldan cada bloque
- qué vacíos y conflictos existen

## Modelo de datos propuesto

No reemplaza el modelo actual. Lo extiende.

### 1. `KnowledgeSnapshot`

Representa una generación completa del estado del conocimiento para un tenant y un scope.

Campos sugeridos:

```ts
type KnowledgeSnapshot = {
  id: string
  tenantKey: string
  scope: 'customer_public' | 'admin_internal'
  status: 'building' | 'ready' | 'failed' | 'stale'
  version: number
  generatedAt: string
  generatedByUserId: number | null
  generationReason:
    | 'manual_refresh'
    | 'document_changed'
    | 'candidate_reviewed'
    | 'bundle_changed'
    | 'negative_example_changed'
    | 'scheduled_refresh'
  summaryText: string | null
  summaryMarkdown: string | null
  metrics: Record<string, unknown> | null
  coverageScore: number | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}
```

### 2. `KnowledgeSnapshotEntry`

Representa una unidad concreta del snapshot.

Puede ser:

- afirmación positiva
- guardrail negativo
- vacío conocido
- conflicto detectado
- recomendación operativa

Campos sugeridos:

```ts
type KnowledgeSnapshotEntry = {
  id: string
  snapshotId: string
  tenantKey: string
  scope: 'customer_public' | 'admin_internal'
  entryType:
    | 'topic_summary'
    | 'approved_rule'
    | 'approved_response_pattern'
    | 'guardrail_negative'
    | 'known_gap'
    | 'conflict'
    | 'operational_note'
  key: string
  title: string
  plainText: string
  normalizedIntent: string | null
  topicKey: string | null
  confidence: number | null
  priority: 'low' | 'medium' | 'high' | null
  appliesToChannels: string[] | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}
```

### 3. `KnowledgeSnapshotSource`

Conecta cada entry con sus fuentes exactas.

Campos sugeridos:

```ts
type KnowledgeSnapshotSource = {
  id: string
  snapshotEntryId: string
  sourceKind:
    | 'knowledge_document'
    | 'knowledge_candidate'
    | 'knowledge_raw_event'
    | 'knowledge_conversation_bundle'
    | 'knowledge_negative_example'
    | 'knowledge_feedback'
  sourceId: string
  sourceVersion: number | null
  sourceStatus: string | null
  role:
    | 'primary_support'
    | 'secondary_support'
    | 'guardrail'
    | 'counterexample'
    | 'conflict_source'
  excerpt: string | null
  metadata: Record<string, unknown> | null
}
```

### 4. `KnowledgeSnapshotDiff`

Permite comparar dos snapshots.

Campos sugeridos:

```ts
type KnowledgeSnapshotDiff = {
  id: string
  previousSnapshotId: string
  nextSnapshotId: string
  tenantKey: string
  scope: 'customer_public' | 'admin_internal'
  summaryText: string | null
  addedEntries: number
  removedEntries: number
  changedEntries: number
  sourceChanges: number
  createdAt: string
}
```

## Formato del snapshot

### Snapshot estructurado

```json
{
  "id": "snap_20260327_01",
  "tenantKey": "urucortinas",
  "scope": "customer_public",
  "status": "ready",
  "version": 4,
  "generatedAt": "2026-03-27T22:00:00Z",
  "coverageScore": 0.72,
  "metrics": {
    "approvedDocuments": 24,
    "approvedCandidates": 18,
    "approvedBundles": 2,
    "approvedNegativeExamples": 6,
    "pendingSignals": 14,
    "conflicts": 1,
    "knownGaps": 3
  },
  "entries": [
    {
      "entryType": "topic_summary",
      "key": "orders.status",
      "title": "Seguimiento de pedidos",
      "plainText": "El agente puede orientar consultas de seguimiento, pedir identificadores faltantes y evitar confirmar estados no verificados.",
      "normalizedIntent": "orders.status",
      "topicKey": "orders",
      "sources": [
        {
          "sourceKind": "knowledge_document",
          "sourceId": "doc_123",
          "role": "primary_support"
        },
        {
          "sourceKind": "knowledge_candidate",
          "sourceId": "cand_456",
          "role": "secondary_support"
        }
      ]
    },
    {
      "entryType": "guardrail_negative",
      "key": "orders.status.no_false_confirmation",
      "title": "No confirmar estados no verificados",
      "plainText": "No afirmar que un pedido salió o fue entregado si el sistema no lo confirmó.",
      "sources": [
        {
          "sourceKind": "knowledge_negative_example",
          "sourceId": "neg_12",
          "role": "guardrail"
        }
      ]
    }
  ],
  "pendingSignals": [
    {
      "type": "negative_example_pending",
      "id": "neg_18",
      "title": "Respuesta riesgosa aún no revisada"
    }
  ],
  "conflicts": [
    {
      "key": "shipping.delay_policy",
      "description": "Dos fuentes activas describen plazos distintos."
    }
  ],
  "knownGaps": [
    "No hay conocimiento aprobado suficiente para devoluciones internacionales."
  ]
}
```

### Digest en texto plano

```txt
Scope: customer_public
Última actualización: 27/03/2026 19:00
Versión: 4

Qué interpreta hoy el sistema:
- seguimiento de pedidos
- consultas de productos publicados
- coordinación básica de visitas
- soporte inicial no técnico

Reglas activas:
- no confirma estados no verificados
- pide el dato mínimo faltante antes de avanzar
- no inventa políticas no aprobadas

Fuentes principales:
- doc_123 · Política de seguimiento
- cand_456 · Respuesta aprobada sobre estado de pedido
- neg_12 · Guardrail: no prometer entrega no validada

Vacíos detectados:
- devoluciones internacionales
- postventa compleja

Conflictos detectados:
- shipping.delay_policy
```

## Endpoints propuestos

### Lectura

#### `GET /api/ai/knowledge/snapshots`

Lista snapshots por tenant/scope.

Query:

- `tenantKey`
- `scope`
- `status`
- `page`
- `pageSize`
- `orderBy`
- `orderDir`

#### `GET /api/ai/knowledge/snapshots/:id`

Devuelve snapshot completo.

#### `GET /api/ai/knowledge/snapshots/latest`

Devuelve el snapshot vigente para un scope.

Query:

- `tenantKey`
- `scope`

#### `GET /api/ai/knowledge/snapshots/:id/plain-text`

Devuelve el digest exportable en texto plano.

#### `GET /api/ai/knowledge/snapshots/:id/diff/:nextSnapshotId`

Devuelve diff entre dos snapshots.

#### `GET /api/ai/knowledge/snapshots/:id/sources`

Lista fuentes agrupadas y trazables.

### Escritura / refresh

#### `POST /api/ai/knowledge/snapshots/generate`

Genera snapshot manual.

Body:

```json
{
  "tenantKey": "urucortinas",
  "scope": "customer_public",
  "reason": "manual_refresh"
}
```

#### `POST /api/ai/knowledge/snapshots/rebuild-all`

Regenera snapshots de ambos scopes.

#### `POST /api/ai/knowledge/snapshots/:id/mark-stale`

Marca snapshot como obsoleto.

## Flujo de generación

### 1. Recolección

Tomar fuentes del tenant/scope.

Incluir:

- `KnowledgeDocument` activos
- `KnowledgeCandidate` aprobados
- `ConversationBundle` aprobados
- `NegativeExample` aprobados

Incluir como señales pendientes:

- candidates pendientes
- bundles pendientes
- negative examples pendientes
- raw events relevantes sin resolver

### 2. Normalización

Transformar cada fuente a un formato común:

```ts
type SnapshotSourceObservation = {
  sourceKind: string
  sourceId: string
  scope: 'customer_public' | 'admin_internal'
  status: 'active' | 'pending' | 'archived'
  semanticRole: 'positive_knowledge' | 'negative_guardrail' | 'pending_signal'
  normalizedIntent: string | null
  topicKey: string | null
  plainText: string
  metadata: Record<string, unknown> | null
}
```

### 3. Agrupación

Agrupar por:

- `scope`
- `topicKey`
- `normalizedIntent`
- `semanticRole`

### 4. Detección de conflictos y vacíos

Conflictos:

- dos fuentes activas afirman cosas incompatibles
- una fuente positiva contradice un guardrail vigente

Vacíos:

- intents importantes sin suficiente respaldo
- temas con mucho raw event y poco conocimiento aprobado

### 5. Render del snapshot

Dos capas:

- determinística:
  - entries
  - métricas
  - fuentes
  - conflictos
  - vacíos
- opcional IA:
  - resumen humano en `summaryText`

La IA puede ayudar a redactar. No debe decidir qué entra al snapshot.

## Criterio de inclusión en el snapshot

### Entra como conocimiento activo

- documento `active`
- candidate `approved`
- bundle `approved`
- negative example `approved`

### No entra como conocimiento activo, pero sí como señal

- raw event `new` o `processed`
- candidate `pending`
- bundle `pending`
- negative example `pending`
- documento `archived`

### No debe gobernar el digest operativo

- fuentes rechazadas
- borradores sin validar
- observaciones crudas sin relación clara

## Pantallas de admin propuestas

### 1. `Knowledge Snapshot Overview`

Ruta sugerida:

- `/app/settings/ai/knowledge/snapshots`

Objetivo:

- mostrar qué interpreta hoy el sistema por scope

Bloques:

- selector `scope`
- última actualización
- cobertura
- knowledge activo
- guardrails activos
- vacíos
- conflictos
- fuentes principales
- botón `Regenerar snapshot`

### 2. `Knowledge Snapshot Detail`

Ruta sugerida:

- `/app/settings/ai/knowledge/snapshots/:id`

Objetivo:

- inspección completa del snapshot

Bloques:

- digest plano
- tabla de entries
- drill-down a fuentes
- diff contra snapshot anterior

### 3. `Knowledge Snapshot Sources`

Objetivo:

- ver de dónde sale cada bloque del snapshot

Necesario para:

- corregir rápido una fuente mala
- detectar desactualización
- reingestar y verificar impacto

### 4. Integración con `AI Home`

El hub `/app/settings/ai` debe mostrar:

- snapshot vigente por scope
- última actualización
- conflictos activos
- gaps críticos
- acceso directo a diff y fuentes

## Flujo de regeneración y refresh

### Refresh manual

1. operador edita documento / aprueba candidate / cambia guardrail
2. dispara `generate snapshot`
3. se crea nueva versión
4. se actualiza overview
5. queda diff visible respecto del snapshot anterior

### Refresh automático

Debe marcar snapshot como `stale` y disparar regeneración cuando cambie:

- `KnowledgeDocument` activo
- `KnowledgeCandidate` aprobado/rechazado/promovido
- `ConversationBundle`
- `NegativeExample`

Estrategia recomendada:

- marcar `stale` al evento
- consolidar y regenerar con job corto
- evitar regenerar síncronamente por cada cambio pequeño

## Integración con el runtime actual

El runtime no debe leer el digest plano para responder.

Debe seguir usando:

- retrieval
- action registry
- intent engine
- policy/guardrails

El snapshot sirve para:

- observabilidad
- diagnóstico
- diff de conocimiento
- UX administrativa
- feedback rápido de desalineación

Opcionalmente puede exponer al runtime hints de alto nivel:

- topics cubiertos
- guardrails activos
- gaps detectados

Pero siempre como señal secundaria, no como sustituto del retrieval real.

## Relación con `conversation bundles` y `negative examples`

### Conversation bundles

Sirven para representar conocimiento multi-turno.

Cuando estén aprobados:

- entran al snapshot activo
- alimentan entries tipo:
  - `response_pattern`
  - `handoff_pattern`
  - `follow_up_sequence`

### Negative examples

No son “conocimiento descartable”. Son parte importante del comportamiento esperado.

Cuando están aprobados:

- entran al snapshot como `guardrail_negative`
- penalizan ranking y reuse
- ayudan a explicar qué no debe responder o cómo no debe comportarse el sistema

Cuando no están aprobados:

- no entran al digest operativo
- sí aparecen en `pendingSignals`

## Evolución posible: `knowledge elements` derivados de fuentes manuales o documentales

Esta línea queda sujeta a análisis, pero es coherente con el diseño actual.

Idea:

- una misma fuente curada o documental puede producir varios `elements` reutilizables
- esos `elements` no son el documento entero; son unidades concretas y trazables

Fuentes posibles:

- texto ingresado manualmente en formularios
- documentos de texto subidos
- contenido curado en `Knowledge Documents`

Tipos posibles:

- regla positiva
- patrón de respuesta aprobado
- restricción operativa
- guardrail negativo

Ejemplos:

- “no revelar información sensible de la empresa” -> `guardrail_negative`
- “no usar lenguaje inapropiado” -> `guardrail_negative`
- “pedir identificador antes de confirmar el estado del pedido” -> `approved_rule`

Regla importante:

- la promoción a `element` no debe ser automática al guardar la fuente
- debe existir revisión humana
- cada element debe conservar trazabilidad completa:
  - sourceKind
  - sourceId
  - sourceVersion
  - fragmento textual exacto
  - scope
  - estado de revisión

Si esta línea se implementa, el snapshot debería poder consumir esos `elements` aprobados como una capa adicional de conocimiento estructurado, sin perder el vínculo con el documento o formulario de origen.

## Plan incremental de implementación

### Fase 1

- crear modelo persistido:
  - `KnowledgeSnapshot`
  - `KnowledgeSnapshotEntry`
  - `KnowledgeSnapshotSource`
- endpoint `latest`
- snapshot determinístico sin IA redactora

### Fase 2

- overview y detail en admin
- fuentes y diff
- refresh manual
- base runtime visible dentro del snapshot aun sin conocimiento aprobado suficiente

### Fase 3

- refresh automático con `stale -> regenerate`
- integración con bundles y negative examples aprobados
- detección básica de conflictos y vacíos

Estado actual:

- `conversation bundles` aprobados ya entran al snapshot persistido como `topic_summary`
- `negative examples` aprobados ya entran al snapshot persistido como `guardrail_negative`
- pendientes siguientes:
  - reflejar señales `pending` en overview sin mezclarlas con el digest activo
  - sumar E2E específicas de snapshot con bundles/negative examples

### Fase 4

- resumen IA sobre snapshot determinístico
- export plain text / markdown
- recomendaciones de corrección priorizadas

## Riesgos a evitar

- confundir snapshot con verdad del modelo
- meter fuentes pendientes dentro del digest activo
- usar raw events crudos como conocimiento vigente
- mezclar guardrails negativos con ruido no validado
- dejar el snapshot sin fuentes trazables
- regenerar demasiado seguido y volverlo inestable

## Criterio de cierre

Este módulo estará bien resuelto cuando permita:

- ver qué conocimiento activo usa hoy el sistema
- ver de qué fuentes exactas sale
- detectar conflictos y vacíos
- corregir fuente y refrescar rápido
- comparar antes/después de una reingesta o edición
- incluir guardrails negativos aprobados sin contaminar el conocimiento activo con señales aún no validadas
