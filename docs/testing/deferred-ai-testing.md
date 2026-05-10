# Deferred AI Testing

Fecha de clasificación: `2026-05-08`

Todo lo relacionado con IA queda fuera de la fase actual de recovery de calidad.

## Alcance diferido

Queda diferido, sin prioridad operativa inicial, todo testing relacionado con:

- agentes IA
- respuestas automáticas
- chat automation
- conversational flows
- generación IA
- workflows LLM
- asistentes automáticos
- IA contextual
- clasificación automática IA
- respuestas generadas dinámicamente
- integrations AI-first
- embeddings
- vector search
- RAG
- semantic pipelines
- inference runtimes

## Razón de la decisión

Estas áreas:

- son altamente variables
- introducen flakiness temprano
- dependen de infraestructura externa
- no son prioridad del recovery inicial del ecommerce core
- complican el cierre de suites determinísticas

## Estado esperado

Todo lo relacionado a IA debe:

- quedar documentado
- quedar inventariado
- quedar clasificado como `deferred`
- quedar fuera del recovery inicial

## Inventario de superficies AI diferidas

### `ai-platform/backend`

- [ai-platform/backend/package.json](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/backend/package.json)
- [ai-platform/backend/jest.config.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/backend/jest.config.ts)
- Suite grande de tests sobre runtime, prompt policy, guardrails, grounding, document knowledge, tenant scoping y chat orchestration.

### `ai-platform/frontend`

- [ai-platform/frontend/package.json](/Users/rodrigo/Git/personal/react_admin_dashboard/ai-platform/frontend/package.json)
- No expone tests declarados.

### Ecommerce / QA conversacional

- [ecommerce/e2e/storefront-webchat.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/storefront-webchat.spec.ts)
- [ecommerce/e2e/storefront-webchat-authenticated-memory.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/storefront-webchat-authenticated-memory.spec.ts)
- [ecommerce/e2e/admin-conversations*.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/)
- [ecommerce/e2e/admin-aberturas-ai-flows.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/admin-aberturas-ai-flows.spec.ts)
- [ecommerce/e2e/aberturas-chat-persistence-cross-scope.spec.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/ecommerce/e2e/aberturas-chat-persistence-cross-scope.spec.ts)

### Backend AI-related

- [backend/src/ai](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/src/ai)
- [backend/src/knowledge](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/src/knowledge)
- [backend/src/analytics/ai-insights.service.ts](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/src/analytics/ai-insights.service.ts)
- [backend/src/qa](/Users/rodrigo/Git/personal/react_admin_dashboard/backend/src/qa)

### Channel adapter conversational surfaces

- [services/channel-adapter/src](/Users/rodrigo/Git/personal/react_admin_dashboard/services/channel-adapter/src)

## Recovery rule

No se debe invertir tiempo inicial en:

- validación de prompts
- testing de calidad de respuestas IA
- validación semántica
- snapshots de respuestas IA
- browser testing de agentes
- automatización conversacional
- suites dependientes de modelos externos

## Seguimiento posterior

Estas superficies no se eliminan del sistema de calidad. Se mantienen inventariadas y se reactivan cuando la fase de recovery determinístico esté estable.
