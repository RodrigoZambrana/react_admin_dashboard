# AI Multimodal Execution Backlog

## 1. Propósito

Este documento convierte el plan de cierre conversacional multimodal en un backlog ejecutable por fases sobre la arquitectura actual.

Objetivo:

- cerrar la comprensión conversacional usando:
  - texto
  - imágenes
  - audios
  - documentos
  - archivos tabulares
- mantener backend como autoridad final
- no reescribir el sistema
- no mover lógica de negocio al modelo
- poder implementar en slices pequeños, verificables y seguros para producción

Debe leerse junto con:

- [AI_OPERATING_MODEL.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_OPERATING_MODEL.md)
- [AI_IMPLEMENTATION_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_IMPLEMENTATION_PLAN.md)
- [AI_CONVERSATIONAL_CLOSURE_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATIONAL_CLOSURE_PLAN.md)
- [AI_RUNTIME_MINIMAL_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_RUNTIME_MINIMAL_DESIGN.md)

## 2. Principios de ejecución

- cada fase debe poder salir a producción sin romper los flujos actuales
- primero wrappers compatibles, después migración de uso, después limpieza
- el runtime propio sigue orquestando
- LangChain sigue limitado a:
  - acceso al modelo
  - tool calling
  - structured output
- toda acción real sigue validándose y ejecutándose en backend
- los adjuntos primero se extraen y normalizan; recién después pueden influir en intención, contexto o drafts

## 3. Orden y dependencias

### 3.1 Orden recomendado

1. Fase 1: Message Element Interpreter
2. Fase 2: Intent Engine
3. Fase 3: Agent State
4. Fase 4: Outcome Renderer
5. Fase 5: Action Registry
6. Fase 6: Canales y superficies multimodales
7. Fase 7: Lifecycle ampliado y QA E2E

### 3.2 Dependencias entre fases

- Fase 2 depende de Fase 1
- Fase 3 depende de Fase 2
- Fase 4 depende de Fase 2 y se beneficia de Fase 3
- Fase 5 depende de Fase 2 y Fase 3
- Fase 6 depende de Fase 1 y Fase 4
- Fase 7 depende de Fases 1 a 6

## 4. Fase 1 — Message Element Interpreter

### 4.1 Objetivo

Dejar de razonar sobre `texto + adjuntos sueltos` y pasar a una representación canónica de elementos del mensaje.

### 4.2 Slice 1.1 — Tipos canónicos de elemento

Archivos a crear:

- `services/ai-agent-service/src/ai/message-elements/message-element-types.js`
- `services/ai-agent-service/src/ai/message-elements/__tests__/message-element-types.test.js`

Archivos a tocar:

- `backend/src/ai/extraction/extracted-asset.types.ts`
- `backend/src/conversations/dto/conversation-message-attachment.dto.ts`

Contrato mínimo:

```ts
type MessageElement =
  | { kind: 'text'; text: string; source: 'message' | 'ocr' | 'transcript' | 'document_text' }
  | { kind: 'image'; assetId: string | null; caption?: string | null; extractedText?: string | null }
  | { kind: 'audio'; assetId: string | null; transcript?: string | null; language?: string | null }
  | { kind: 'document'; assetId: string | null; title?: string | null; extractedText?: string | null; pages?: number[] }
  | { kind: 'table'; assetId: string | null; columns: string[]; rows: Array<Record<string, unknown>> }
```

Dependencias:

- ninguna

Criterio de aceptación:

- existe un contrato único para `text`, `image`, `audio`, `document` y `table`
- el contrato puede construirse a partir de `ExtractedAsset`
- no rompe DTOs ni serialización actual

### 4.3 Slice 1.2 — Intérprete de mensaje

Archivos a crear:

- `services/ai-agent-service/src/ai/message-elements/interpret-message-elements.js`
- `services/ai-agent-service/src/ai/message-elements/build-message-context.js`
- `services/ai-agent-service/src/ai/message-elements/__tests__/interpret-message-elements.test.js`

Archivos a tocar:

- `services/ai-agent-service/src/ai/agent.js`
- `services/channel-adapter/src/normalization/unified-message.js`
- `services/channel-adapter/src/normalization/unified-message.ts`
- `backend/src/ai/extraction/ai-asset-extraction.service.ts`

Dependencias:

- Slice 1.1

Criterio de aceptación:

- un turno puede producir `messageElements[]` a partir de texto y adjuntos
- el runtime puede consumir esos elementos sin cambiar todavía la lógica principal de intención
- `auditPayload` puede registrar qué elementos se usaron

### 4.4 Slice 1.3 — Persistencia y trazabilidad del origen

Archivos a crear:

- `backend/src/conversations/dto/message-element.dto.ts`

Archivos a tocar:

- `backend/src/conversations/conversations.service.ts`
- `backend/src/conversations/dto/agent-reply.dto.ts`
- `backend/src/conversations/dto/dispatch-webchat-message.dto.ts`
- `backend/src/conversations/dto/ingest-inbound-message.dto.ts`

Dependencias:

- Slice 1.2

Criterio de aceptación:

- cada mensaje puede persistir referencias a elementos interpretados sin contaminar `finalUserText`
- admin puede auditar el origen conversacional usado por el runtime

## 5. Fase 2 — Intent Engine

### 5.1 Objetivo

Converger a una única entrada de intención:

```ts
detectIntent(message, context) => IntentDetection
```

### 5.2 Slice 2.1 — Wrapper compatible

Archivos a crear:

- `services/ai-agent-service/src/ai/intents/intent-types.js`
- `services/ai-agent-service/src/ai/intents/detect-intent.js`
- `services/ai-agent-service/src/ai/intents/__tests__/detect-intent.test.js`

Archivos a tocar:

- `services/ai-agent-service/src/ai/agent.js`

Dependencias:

- Fase 1 completada o, como mínimo, Slice 1.2

Criterio de aceptación:

- `agent.js` usa `detectIntent()` como punto único de entrada
- `detectIntent()` sigue reutilizando:
  - `deriveIntentKey`
  - `findActionIntent`
  - `inferActionIntentFromConversationContext`
- se emite output estándar:

```json
{
  "intent": "appointments.create",
  "confidence": 0.91,
  "source": "rule"
}
```

### 5.3 Slice 2.2 — Intent Registry central

Archivos a crear:

- `services/ai-agent-service/src/ai/intents/intent-registry.js`
- `services/ai-agent-service/src/ai/intents/detectors/rule-detectors.js`
- `services/ai-agent-service/src/ai/intents/detectors/contextual-detectors.js`
- `services/ai-agent-service/src/ai/intents/detectors/hybrid-detectors.js`

Archivos a tocar:

- `services/ai-agent-service/src/ai/agent.js`
- `services/ai-agent-service/src/ai/agent.test.js`

Dependencias:

- Slice 2.1

Criterio de aceptación:

- al menos estos intents viven ya en el registry:
  - `customer.light`
  - `admin.light`
  - `admin.capabilities`
  - `appointments.create`
  - `products.create`
  - `aberturas.register`
- `auditPayload` guarda:
  - `intent`
  - `confidence`
  - `source`
  - `decisionPath`

### 5.4 Slice 2.3 — Detección híbrida multimodal

Archivos a crear:

- `services/ai-agent-service/src/ai/intents/detectors/message-element-detectors.js`

Archivos a tocar:

- `services/ai-agent-service/src/ai/intents/detect-intent.js`
- `services/ai-agent-service/src/ai/model/openai-provider.js`

Dependencias:

- Fase 1 completa
- Slice 2.2

Criterio de aceptación:

- `detectIntent()` puede usar texto, OCR, transcript o texto documental como señales secundarias
- si la regla pura no alcanza, puede pedir una pista estructurada al modelo sin delegar la decisión final
- la fuente queda marcada como `hybrid`

## 6. Fase 3 — Agent State

### 6.1 Objetivo

Hacer explícito el estado del agente sobre el `taskState` actual.

### 6.2 Slice 3.1 — Tipos y transición mínima

Archivos a crear:

- `services/ai-agent-service/src/ai/state/state-types.js`
- `services/ai-agent-service/src/ai/state/transition-state.js`
- `services/ai-agent-service/src/ai/state/__tests__/transition-state.test.js`

Archivos a tocar:

- `services/ai-agent-service/src/ai/agent.js`

Dependencias:

- Slice 2.1

Criterio de aceptación:

- `taskState` soporta explícitamente:
  - `IDLE`
  - `INTENT_DETECTED`
  - `DRAFT_CREATED`
  - `WAITING_CONFIRMATION`
  - `EXECUTING`
  - `COMPLETED`
  - `FAILED`
  - `HANDED_OFF`
- las transiciones inválidas no se aplican silenciosamente

### 6.3 Slice 3.2 — Persistencia en Redis snapshot

Archivos a crear:

- `services/ai-agent-service/src/ai/state/state-machine.js`

Archivos a tocar:

- `services/ai-agent-service/src/ai/memory/redis-conversation-store.js`
- `services/ai-agent-service/src/ai/memory/in-memory-conversation-store.js`
- `services/ai-agent-service/src/ai/memory/memory-store.ts`

Dependencias:

- Slice 3.1

Criterio de aceptación:

- el snapshot guarda `taskState.state`
- los estados sobreviven entre turnos y reloads
- no se rompe continuidad actual ni confirmaciones pendientes

### 6.4 Slice 3.3 — Historial de transiciones

Archivos a crear:

- `services/ai-agent-service/src/ai/state/build-state-transition-audit.js`

Archivos a tocar:

- `services/ai-agent-service/src/ai/agent.js`
- `backend/src/conversations/conversations.service.ts`

Dependencias:

- Slice 3.2

Criterio de aceptación:

- `auditPayload` guarda `state` y `stageHistory`
- admin puede ver estado actual y transiciones relevantes sin ensuciar el transcript

## 7. Fase 4 — Outcome Renderer

### 7.1 Objetivo

Unificar el render final de:

- `success`
- `blocked`
- `missing-data`
- `low-confidence`
- `handoff`
- `provider-failure`
- `execution-failure`
- `partial-batch`

### 7.2 Slice 4.1 — Renderer común

Archivos a crear:

- `services/ai-agent-service/src/ai/outcomes/outcome-types.js`
- `services/ai-agent-service/src/ai/outcomes/render-outcome.js`
- `services/ai-agent-service/src/ai/outcomes/__tests__/render-outcome.test.js`

Archivos a tocar:

- `services/ai-agent-service/src/ai/agent.js`

Dependencias:

- Slice 2.1

Criterio de aceptación:

- el runtime produce siempre:
  - `finalUserText`
  - `debugSummary`
  - `auditPayload`
- la semántica base de outcome es compartida entre cliente y admin
- solo cambia el remate contextual por audiencia

### 7.3 Slice 4.2 — Integración backend y surfaces

Archivos a crear:

- `ecommerce/src/components/ai-chat/MessageOutcomeBadge.tsx`

Archivos a tocar:

- `backend/src/conversations/dto/agent-reply.dto.ts`
- `backend/src/conversations/conversations.service.ts`
- `frontend/src/services/ConversationsService.ts`
- `frontend/src/views/crm/ConversationsV2/ConversationsV2.tsx`
- `ecommerce/src/types/conversations.ts`
- `ecommerce/src/lib/api/conversations.ts`
- `ecommerce/src/components/ai-chat/WebchatDrawer.tsx`

Dependencias:

- Slice 4.1

Criterio de aceptación:

- storefront sigue viendo solo el texto limpio
- admin ve `debugSummary` y `auditPayload` separados
- el render de éxito, error y handoff es consistente entre superficies

## 8. Fase 5 — Action Registry

### 8.1 Objetivo

Separar de forma explícita:

- detección de intención
- decisión de acción
- creación de draft
- ejecución backend
- verificación

### 8.2 Slice 5.1 — Registro mínimo de acciones

Archivos a crear:

- `services/ai-agent-service/src/ai/actions/action-types.js`
- `services/ai-agent-service/src/ai/actions/action-registry.js`
- `services/ai-agent-service/src/ai/actions/resolve-action.js`
- `services/ai-agent-service/src/ai/actions/__tests__/action-registry.test.js`

Archivos a tocar:

- `services/ai-agent-service/src/ai/agent.js`
- `services/ai-agent-service/src/ai/tools/tool-registry.js`

Dependencias:

- Fase 2
- Fase 3

Criterio de aceptación:

- existe un descriptor formal por acción con:
  - `action`
  - `requiresAuth`
  - `requiresConfirmation`
  - `executeWith`
- al menos estas acciones ya salen del registry:
  - `appointments.create`
  - `appointments.delete`
  - `products.create`
  - `products.update`
  - `aberturas.register`

### 8.3 Slice 5.2 — Contrato runtime/backend

Archivos a crear:

- `backend/src/ai/dto/execute-ai-action.dto.ts`

Archivos a tocar:

- `services/ai-agent-service/src/clients/backend-ai.client.js`
- `backend/src/ai/ai.controller.ts`
- `backend/src/ai/ai.service.ts`

Dependencias:

- Slice 5.1

Criterio de aceptación:

- la ejecución backend usa un contrato homogéneo
- el modelo nunca ejecuta directamente
- backend sigue revalidando permisos y payload

### 8.4 Slice 5.3 — Batch y delete homogéneos

Archivos a tocar:

- `services/ai-agent-service/src/ai/actions/action-registry.js`
- `services/ai-agent-service/src/ai/outcomes/render-outcome.js`
- `services/ai-agent-service/src/ai/agent.js`

Dependencias:

- Slice 5.2
- Fase 4

Criterio de aceptación:

- `delete` usa el mismo lifecycle y no devuelve enlaces muertos
- `batch` responde con resumen por ítem:
  - ejecutados
  - fallidos
  - omitidos

## 9. Fase 6 — Canales y superficies multimodales

### 9.1 Objetivo

Hacer visible y usable la multimodalidad en admin y storefront.

### 9.2 Slice 6.1 — Ingesta homogénea por canal

Archivos a crear:

- `services/channel-adapter/src/normalization/build-message-elements-payload.js`

Archivos a tocar:

- `services/channel-adapter/src/channels/webchat/webchat.adapter.js`
- `services/channel-adapter/src/channels/email/email.adapter.js`
- `services/channel-adapter/src/channels/meta/meta.adapter.js`
- `services/channel-adapter/src/normalization/unified-message.js`
- `services/channel-adapter/src/normalization/unified-message.ts`

Dependencias:

- Fase 1

Criterio de aceptación:

- los tres canales generan payload homogéneo de texto + adjuntos + referencias
- el runtime recibe el mismo contrato base sin importar el canal

### 9.3 Slice 6.2 — Render multimodal en admin

Archivos a crear:

- `frontend/src/views/crm/ConversationsV2/ConversationMessageElement.tsx`
- `frontend/src/views/crm/ConversationsV2/ConversationMessageElement.module.css`

Archivos a tocar:

- `frontend/src/views/crm/ConversationsV2/ConversationsV2.tsx`
- `frontend/src/views/crm/ConversationsV2/conversations-v2.css`
- `frontend/src/services/ConversationsService.ts`

Dependencias:

- Slice 1.3
- Slice 4.2

Criterio de aceptación:

- admin puede distinguir y previsualizar:
  - texto
  - imagen
  - audio
  - documento
  - tabla
- si una decisión usó un adjunto como contexto, eso queda visible en auditoría

### 9.4 Slice 6.3 — Render multimodal en storefront

Archivos a crear:

- `ecommerce/src/components/ai-chat/MessageElementRenderer.tsx`
- `ecommerce/src/components/ai-chat/MessageElementRenderer.module.css`

Archivos a tocar:

- `ecommerce/src/components/ai-chat/WebchatDrawer.tsx`
- `ecommerce/src/state/webchat-context.tsx`
- `ecommerce/src/types/conversations.ts`
- `ecommerce/src/lib/api/conversations.ts`

Dependencias:

- Slice 1.3
- Slice 4.2

Criterio de aceptación:

- cliente puede ver correctamente texto, previews y adjuntos soportados
- el transcript no pierde contexto entre reloads
- el estado `AI / HUMAN / HYBRID` sigue coherente

## 10. Fase 7 — Lifecycle ampliado y QA

### 10.1 Objetivo

Cerrar el flujo multimodal y confirmable de punta a punta.

### 10.2 Slice 7.1 — Contexto multimodal aplicado a drafts

Archivos a tocar:

- `services/ai-agent-service/src/ai/agent.js`
- `services/ai-agent-service/src/ai/actions/action-registry.js`
- `backend/src/ai/extraction/ai-asset-extraction.service.ts`

Dependencias:

- Fases 1 a 5

Criterio de aceptación:

- un adjunto puede enriquecer:
  - detección de intención
  - completado de campos
  - draft
- si la confianza sigue baja, el sistema no ejecuta y escala

### 10.3 Slice 7.2 — Matriz E2E multimodal

Archivos a crear:

- `ecommerce/e2e/storefront-webchat-multimodal.spec.ts`
- `ecommerce/e2e/admin-conversations-multimodal.spec.ts`

Archivos a tocar:

- `ecommerce/e2e/support/admin-api.ts`
- `tools/qa/manifest.json`

Dependencias:

- Slice 7.1
- Fase 6

Criterio de aceptación:

- existe al menos un E2E por caso:
  - imagen + consulta comercial
  - audio + soporte
  - pdf/documento + contexto interno
  - csv/xlsx + batch
  - follow-up ambiguo resuelto con contexto
  - handoff por baja confianza

### 10.4 Slice 7.3 — Criterio de cierre

Una fase de cierre conversacional multimodal puede considerarse lograda cuando:

- texto y adjuntos entran al mismo marco de análisis
- la intención puede usar contexto textual y no textual sin delegar la decisión al modelo
- los drafts multimodales siguen el lifecycle común
- admin puede auditar de dónde salió la interpretación
- cliente recibe respuestas naturales y limpias
- ante baja confianza, el sistema no inventa y escala correctamente

## 11. Backlog diferido

Estos puntos no bloquean el primer cierre multimodal y deben quedar diferidos:

- razonamiento visual avanzado por dominio específico
- clasificación automática compleja de documentos por tenant
- OCR/ASR propietarios por canal
- búsquedas semánticas profundas sobre historiales largos fuera de la ventana activa
- automatizaciones autónomas que decidan acciones sin confirmación humana en operaciones críticas

## 12. Próximo slice recomendado

El siguiente corte correcto, por impacto y riesgo, es:

1. Slice 1.1 — Tipos canónicos de elemento
2. Slice 1.2 — Intérprete de mensaje
3. Slice 2.1 — `detectIntent()` wrapper compatible

Ese bloque ya deja:

- contrato multimodal estable
- entrada única de intención
- base concreta para seguir sin reescritura
