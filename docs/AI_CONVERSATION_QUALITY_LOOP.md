# AI Conversation Quality Loop

Define el ciclo base para estabilizar conversaciones de `storefront`, `admin` y canales convergidos sin depender de testing manual constante ni de fixes puntuales aislados.

Debe leerse junto con:

- [AI_CONVERSATIONAL_BEHAVIOR_ANALYSIS.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATIONAL_BEHAVIOR_ANALYSIS.md)
- [AI_CONVERSATIONAL_CLOSURE_PLAN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CONVERSATIONAL_CLOSURE_PLAN.md)

## Objetivo

Medir y bloquear degradaciones en:

- fluidez
- claridad
- correctitud
- sintaxis
- coherencia multi-turno
- grounding sobre knowledge aprobada
- multimodalidad real
- guardrails y autorización

La regla operativa es simple:

- cada bug conversacional real debe transformarse en regresión automatizada
- el cierre de un fix no se valida por percepción, sino por bloque QA repetible

## Qué se evalúa

### 1. Fluidez

Busca que la conversación avance sin fricción artificial.

Criterios automatizables:

- saludo corto y natural
- no repetir aclaraciones ya respondidas
- no caer en fallback genérico cuando ya existe contexto o knowledge
- follow-ups cortos resueltos con continuidad
- no mezclar respuestas de contacto/catálogo cuando el tópico es puntual

Señales existentes a revisar en runtime:

- `auditPayload.metrics.followUpDetected`
- `auditPayload.metrics.followUpResolvedWithoutProvider`
- `auditPayload.metrics.clarificationRequested`
- `auditPayload.metrics.clarificationResolved`

### 2. Claridad

Busca respuestas comprensibles, accionables y sin ruido.

Criterios automatizables:

- pedir solo el dato mínimo faltante
- no usar jerga técnica interna
- no devolver títulos de documentos o snippets crudos como respuesta final
- no exponer texto de debug, provider o auditoría al usuario

### 3. Correctitud

Busca que los hechos sean consistentes con knowledge aprobada y permisos.

Criterios automatizables:

- business FAQs resueltas desde knowledge antes del proveedor
- facts sensibles protegidas por scope/autenticación/pertenencia
- no usar contenido no aprobado como verdad operativa
- distinguir `quota exceeded`, `rate limit`, `auth failure` y `bad request`

### 4. Sintaxis y forma

Busca calidad mínima de redacción aun cuando la respuesta sea determinística.

Criterios automatizables:

- capitalización inicial correcta
- cierre de frase razonable
- longitud acotada para saludos y aclaraciones
- evitar duplicaciones como `Sí. Sí.` o `Estamos en ... además ...` truncado
- evitar títulos o listados comerciales pegados como salida final

### 5. Coherencia

Busca continuidad real dentro del hilo.

Criterios automatizables:

- conservar tópico previo en follow-ups elípticos
- resetear memoria cuando el tema cambia de verdad
- no tratar `sí/no` como confirmación si no existe estado pendiente
- mantener consistencia entre storefront, admin y backend canónico

### 6. Multimodalidad

Busca que texto, imágenes, audios, videos y documentos participen del flujo real.

Criterios automatizables:

- adjuntos visibles en transcript
- no duplicar preview + metadata innecesaria
- `messageElements` y `attachments` coherentes
- admin y storefront renderizan el mismo mensaje de forma compatible

## Capas del ciclo

### Capa A. Runtime determinístico

Valida la lógica de conversación sin navegador.

Cobertura objetivo:

- greeting
- generic help
- incomplete
- gibberish
- frustration
- multi-intent
- FAQs knowledge-first
- follow-up corto
- grounded rewrite opcional
- guardrails
- ownership/auth
- multimodal context usage

Fuente actual:

- [agent.test.js](/Users/rodrigo/git/personal/react_admin_dashboard/services/ai-agent-service/src/ai/agent.test.js)

Escenarios golden agregados sobre conversaciones completas:

- saludo + product inquiry amplio + follow-ups cortos (`cortinas` -> `roller` -> `blackout` -> `venecianas`)
- normalización de opening imperfecto + price inquiry amplia (`hola necsto info` -> `precios cortnas`)
- cambio de tema con contexto previo (`quiero cortinas` -> `roller` -> `también necesito saber horarios`)

Gap explícito actual:

- flujo customer de agenda multi-turno (`quiero agendar una visita` -> `mañana` -> `sí`) queda registrado como `todo` hasta formalizar estado, slots y confirmaciones sin ambigüedad

### Capa B. Retrieval, conversaciones y knowledge

Valida que el backend entregue contexto correcto y persista lo necesario.

Cobertura objetivo:

- persistencia canónica de mensajes
- `messageElements` por mensaje
- assets y render contract
- extraction / snapshot / facts derivados
- reglas de attachments y formatos reales

Fuentes actuales:

- [conversations.service.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/conversations/__tests__/conversations.service.spec.ts)
- [knowledge.service.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/knowledge/__tests__/knowledge.service.spec.ts)

### Capa C. E2E admin/storefront

Valida comportamiento real con UI, polling, transcript y handoff.

Cobertura objetivo:

- webchat público
- webchat autenticado
- continuidad post-reload
- proyección a inbox admin
- render de tipos de mensaje
- reply flow
- email/chat surfaces relevantes

Fuentes actuales:

- [storefront-webchat.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/e2e/storefront-webchat.spec.ts)
- [storefront-webchat-authenticated-memory.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/e2e/storefront-webchat-authenticated-memory.spec.ts)
- [admin-conversations-inbox-regression.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/e2e/admin-conversations-inbox-regression.spec.ts)
- [admin-conversations-message-types.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/e2e/admin-conversations-message-types.spec.ts)
- [admin-conversations-subroles.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/e2e/admin-conversations-subroles.spec.ts)
- [admin-conversations-email-reply.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/e2e/admin-conversations-email-reply.spec.ts)

### Capa D. Observación y retroalimentación

Usa conversaciones reales para decidir qué regresión agregar.

Fuente externa dinámica hoy soportada:

- exports `.zip` de WhatsApp en `/Users/rodrigo/Downloads/whatsapp`

Ese corpus:

- no se carga como knowledge operativa
- no se considera verdad aprobada para respuestas
- se usa como input de QA para detectar patrones reales, proponer regresiones y reforzar wording/fluidez

Salidas generadas automáticamente:

- `.qa/external-real-conversations/whatsapp/index.json`
- `.qa/external-real-conversations/whatsapp/summary.md`
- `.qa/external-real-conversations/whatsapp/manifests/*.json`
- `.qa/external-real-conversations/whatsapp/proposals/*.json`

Qué hace la ingesta de QA:

1. lee cada `.zip`
2. normaliza transcript + adjuntos
3. clasifica la conversación por tipo
4. propone fixtures/regresiones candidatas
5. deja el corpus listo para futuros ciclos sin tocar la base de conocimiento

Cada fallo real debe etiquetarse en una sola capa principal:

- `normalization`
- `classification`
- `context_continuity`
- `knowledge_retrieval`
- `response_shaping`
- `authorization`
- `multimodal_rendering`
- `channel_projection`

Y luego terminar en:

1. fix de código
2. test nuevo o actualizado
3. ejecución del bloque QA

## Bloque QA operativo

Queda disponible un bloque específico:

- `ai-conversation-quality`
- `real-whatsapp-corpus-sync`

Comando:

```bash
node tools/qa/run-qa.mjs --block ai-conversation-quality
```

Qué corre:

1. sync del corpus real externo de WhatsApp
2. health check de `ai-agent-service`
3. suite de runtime conversacional
4. suites backend de conversaciones y knowledge
5. E2E relevantes de webchat/admin

Sync manual del corpus real:

```bash
node tools/qa/ingest-whatsapp-real-corpus.mjs
```

Etiquetas finas actualmente detectadas en el corpus real:

- `outbound_follow_up`
- `abandoned_thread`
- `reengagement_after_gap`
- `operational_thread_switch`
- `system_message_interference`

Perfiles QA explícitos del hilo:

- `customer_initiated`
- `business_initiated`
- `channel_interfered`

Nota:

- `off_hours_auto_reply` queda pendiente hasta tener una fuente confiable de horarios operativos en backend. No se infiere solo por texto.

Resultados:

- `.qa/latest.json`
- `.qa/runs/<run-id>.json`
- `.qa/runs/<run-id>/*.log`
- `.qa/latest.conversation-quality.json`
- `.qa/latest.conversation-quality.md`
- `.qa/runs/<run-id>.conversation-quality.json`
- `.qa/runs/<run-id>.conversation-quality.md`

Comando directo del analizador sobre el último run:

```bash
node tools/qa/analyze-conversation-quality.mjs --latest
```

## Modo de uso recomendado

### Durante desarrollo de fixes conversacionales

Usar esta secuencia corta:

```bash
npm --prefix services/ai-agent-service run test:conversation-quality
```

Si el cambio toca retrieval/persistencia:

```bash
node tools/qa/run-qa.mjs --block ai-conversation-quality
```

### Antes de retomar testing exploratorio

Correr siempre:

```bash
node tools/qa/run-qa.mjs --block ai-conversation-quality
```

### Antes de cerrar un bloque de estabilidad

Repetir:

```bash
node tools/qa/run-qa.mjs --block ai-conversation-quality --repeat 2
```

La repetición sirve para detectar:

- polling inestable
- carreras entre persistencia y UI
- flakes en handoff o refresh
- variaciones no deseadas en E2E

## Criterio de aprobación del ciclo

El bloque se considera aceptable cuando:

- no hay fallos en runtime
- no hay fallos en retrieval/conversations backend
- no hay fallos E2E de webchat/admin
- no aparecen nuevas respuestas crudas o inconsistentes en regresiones conocidas
- cualquier bug nuevo detectado manualmente queda convertido en test antes del siguiente cierre

## Anti-patrones a evitar

- corregir wording puntual sin agregar regresión
- depender de prueba manual como única validación
- usar el proveedor para “maquillar” una mala interpretación base
- introducir knowledge nueva sin bloquear raw leakage
- aceptar E2E verdes si el runtime base ya está degradado

## Próxima evolución útil

Sobre esta base, el siguiente salto recomendable es agregar un `conversation quality report` derivado del runtime y del QA runner, con métricas agregadas por corrida:

- tasa de fallback
- tasa de clarificación
- follow-ups resueltos
- raw snippet leakage detectado
- respuestas knowledge-first
- provider calls evitadas

Ese reporte ya queda generado automáticamente por `run-qa` para bloques conversacionales. No reemplaza las pruebas. Las vuelve auditables, agrupables por patrón y comparables entre corridas.
