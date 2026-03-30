# AI Chat Automation Closure Priorities

## Objetivo de cierre
Cerrar el gap entre el estado actual y un chatbot reusable que sea:
- fluido
- coherente
- correcto
- flexible en wording
- capaz de ejecutar tareas completas
- usable tanto en storefront como en admin

## Estado base ya resuelto
- continuidad conversacional y `thread resolver`
- intents base customer
- quote profiles por tenant
- handoff enriquecido
- agenda customer con captura multi-turno
- `conversationContext` explícito
- `supportContext` explícito
- orchestrator `conversation-first / flow-second`
- `AI-assisted decision engine` acotado por acciones permitidas
- coalescing natural de fragmentos inbound en chat
- wording híbrido con overrides fuera de código
- capability profiles y kill switches
- instalación modelada como política estructurada
- ABM de perfiles y políticas desde UI
- runtime AI con `response template registry` configurable
- runtime AI con `intent registry híbrido` configurable para customer fallback

## Prioridad 1: mayor valor para cerrar fluidez + correctitud

### 0. Loop profundo de evaluación del webchat sobre corpus real
Problema:
- el runtime ya responde mejor, pero todavía falla en foco, continuidad de tema y cambio de contexto

Resultado buscado:
- una iteración repetible de prueba -> ajuste -> re-prueba hasta acercar el comportamiento al nivel esperado del corpus real

Implementación:
- usar el corpus real de WhatsApp como benchmark de calidad
- medir coherencia, continuidad, correctitud, cambio de tema y cierre útil por turno
- separar errores de estado/contexto de errores de wording
- verificar que el agente responda natural pero mantenga dirección
- verificar que detecte correctamente cuándo pasar de conversación exploratoria a flujo guiado
- agregar fallback mínimo universal cuando no se pueda cerrar la resolución final

Estado 2026-03-29:
- set muestra y set profundo del runtime base ya quedaron en `100`
- los desvíos de `payment proof continuity` y `quote -> service pivot` quedaron cerrados
- el próximo gap real pasa a ser la capa de `rewrite híbrido`, que todavía puede empeorar respuestas correctas de la base
- criterio nuevo fijado:
  - señales conversacionales reusables en español -> base semántica
  - vocabulario de soporte/producto -> capa de dominio
  - aliases y reglas comerciales -> capa tenant/configurable
  - verbos ambiguos no pueden gatillar flujo por sí solos; necesitan frase operacional o contexto activo
  - response templates customer -> configurables fuera de código
  - hybrid intent registry customer -> configurable fuera de código
  - LLM -> interpretación y lenguaje, no decisión de negocio

Actualización 2026-03-29 sobre corpus ampliado:
- corpus reingestado: `149` conversaciones reales de WhatsApp
- proposals derivados: `466`
- benchmark `deep mixed`: `47` escenarios
- benchmark `category_focus`: `21` escenarios
- score promedio base `deep mixed`: `90`
- score promedio assisted `deep mixed`: `90`
- score promedio base `category_focus`: `91`
- score promedio assisted `category_focus`: `90`
- mejoras concretas cerradas:
  - follow-ups cortos de pago
  - follow-ups visuales/materiales en hilos comerciales
  - adjuntos puros con continuidad mínima útil
  - soporte + visita + condición de pago en un mismo turno
  - dirección/teléfono/horario reaprovechados como continuidad de agenda en hilos operativos
  - aclaración de presupuesto ya emitido sin reiniciar intake
- gaps que siguen prioritarios:
  - multimodal con poco o nulo texto extraído
  - reenganches largos de postventa que todavía pueden caer a presupuesto genérico
  - utilidad real del `rewrite híbrido` en casos compuestos
  - naturalidad más rica sin perder dirección
  - artefacto de revisión profunda disponible en:
    - [runtime-real-question-answer-review-2026-03-29.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/deep-2026-03-29/runtime-real-question-answer-review-2026-03-29.md)

Actualización 2026-03-30 sobre cierre del slice profundo:

- deep current: `46` escenarios
- score promedio base: `100`
- score promedio assisted: `100`
- delta promedio: `+0`
- regresiones assisted: `0`
- mejora assisted localizada: no necesaria para sostener el score final del set actual
- arquitectura cerrada en esta pasada:
  - `conversationContext`
  - `supportContext`
  - clasificación explícita de modo conversacional
  - orchestrator con política `understand first -> choose lane -> ask next useful thing`
  - `decision assist` configurable desde runtime AI
  - perfiles de wording por canal:
    - `chat`
    - `email`
  - espera natural y coalescing de mensajes cortos antes de responder
- criterio de test fijado:
  - memoria/contexto no necesitan una llamada obligatoria al provider para considerarse correctos
  - el bloque contextual y el guard de snippets crudos se testean por estado y salida, no por dependencia artificial del LLM

Artefactos vigentes para revisión real:

- [runtime-real-set-evaluation-deep-current.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/deep-2026-03-29/runtime-real-set-evaluation-deep-current.md)
- [runtime-real-question-answer-review-current.md](/Users/rodrigo/git/personal/react_admin_dashboard/.qa/external-real-conversations/whatsapp/generated/deep-2026-03-29/runtime-real-question-answer-review-current.md)

### Próximos Pasos Del MVP De Respuesta Automatizada Por IA

Objetivo inmediato:

- consolidar un agente que responda naturalmente
- mantenga dirección
- detecte cuándo pasar a flujo o handoff
- sostenga continuidad útil en webchat y WhatsApp

Siguiente corte recomendado:

1. corpus real + prueba manual continua
   - seguir usando WhatsApp real y pruebas manuales como fuente principal de ajuste
   - abrir desvíos solo cuando aparezcan en conversación real o benchmark
2. decisión asistida acotada
   - ampliar el `decision assist` solo en carriles donde mejore continuidad sin perder control
   - mantener lista cerrada de acciones permitidas
3. perfiles por canal
   - consolidar `chat` y `email` con distinto tono, estructura y longitud desde el registry
4. fallback operativo mínimo universal
   - si no puede cerrar la resolución final, identificar necesidad, pedir el dato crítico faltante y dejar continuidad clara para operador
5. límite explícito del MVP
   - no buscar cobertura de “todos los casos”
   - sí buscar comprensión robusta de clases de conversación:
     - cotización
     - aclaración
     - agenda
     - soporte/postventa
     - pago/comprobante
     - reenganche

Puntos que quedaron cerrados:

- continuidad multimodal de cotización
- reenganches largos de postventa sin volver a presupuesto genérico
- follow-ups cortos de medios de pago sin degradación del carril assisted
- preguntas de franja u horario dentro de una coordinación ya abierta
- follow-ups de soporte sobre compatibilidad de materiales o viabilidad de revisión
- agradecimientos sobre presupuesto ya emitido sin reabrir el intake
- subject de quote saneado frente a preguntas meta o texto no temático
- `response template registry` ya usable por perfil de canal:
  - `chat`
  - `email`

Regla operativa nueva para siguientes iteraciones:

- no expandir `rewrite híbrido` por intención completa
- expandirlo sólo por `wordingKey` y subtipo conversacional probado
- bloquear rewrite en carriles:
  - multimodal
  - soporte operativo
  - follow-up corto de pagos
  - reemplazo / assessment sobre instalado

### 1. Estado compartido entre soporte/postventa y agenda
Problema:
- un pedido de revisión o service todavía puede volver a cotización o romper el hilo

Resultado buscado:
- `support_request -> schedule_request` sin pérdida de motivo ni contexto

Implementación:
- estado operativo explícito por conversación
- `supportContext` explícito, análogo a `quoteContext` y `scheduleContext`
- `conversationContext` superior para decidir si el hilo está en exploración, flujo o aclaración
- motivo inferido persistente
- producto instalado persistido
- problema o necesidad persistida
- slots de agenda reaprovechables desde soporte, cotización y visita técnica
- regla estricta:
  - no volver a preguntar un dato ya presente en estado

Decisión de arquitectura:
- mantener la pila actual `LLM + reglas + orchestrator`
- no incorporar un framework externo tipo Rasa como pieza central en esta etapa
- evaluar Rasa sólo como NLU auxiliar futuro si se justifica por dataset etiquetado o fallback local

### 2. Rewrites híbridos adicionales sobre claves seguras
Problema:
- todavía hay respuestas correctas pero demasiado rígidas o repetitivas
- en paralelo, la capa asistida todavía puede degradar algunas respuestas que la base ya resuelve correctamente

Resultado buscado:
- más naturalidad sin perder control semántico

Implementación:
- ampliar solo en claves de bajo riesgo
- mantener fuente de verdad determinística
- IA opcional solo para variación superficial grounded
- mantener perfiles de salida por canal en el registry:
  - `chat` más ágil
  - `email` más formal y estructurado

### 3. Fallbacks operativos más ricos
Problema:
- algunos casos quedan demasiado genéricos cuando el intake ya está completo

Resultado buscado:
- cierres más útiles según caso:
  - `quote_handoff`
  - `information_then_handoff`
  - `material_followup`

### 4. Sanitización backend por proceso crítico
Problema:
- hoy ya existe saneamiento global, pero falta endurecimiento semántico por acción

Resultado buscado:
- payloads correctos y seguros antes de ejecutar:
  - productos
  - presupuestos
  - pagos
  - agenda
  - customer updates

## Prioridad 2: mayor valor para cierre funcional end-to-end

### 5. Política estructurada de instalación completa
Problema:
- hoy existe resolución comercial básica, pero faltan reglas más finas

Resultado buscado:
- decidir con datos si:
  - está incluida
  - va aparte
  - se ofrece como add-on
  - se comunica como exacto, `a partir de`, o no se publica

Implementación:
- `installationResolutionMode`
- `installationChargeScope`
- `installationPricePresentationMode`
- producto/servicio relacionado
- posible regla por categoría, producto y override puntual

### 6. Fórmulas variables de instalación
Problema:
- hoy ya existe soporte estructural para distintos scopes, pero no fórmulas ricas por tenant

Resultado buscado:
- soportar variación por:
  - medidas
  - tipo de producto
  - zona
  - combinación de factores

## Prioridad 3: mayor valor para capacidades ejecutivas

### 7. Cobertura completa de acciones en todos los canales
Resultado buscado:
- todo lo que hoy ejecuta webchat debe poder ejecutarse también en WhatsApp
- todo lo que ejecuta customer/admin debe compartir contratos y ownership claros

### 8. Centralización de ownership por proceso crítico
Procesos:
- productos
- pedidos
- pagos
- actividades / agenda
- presupuestos
- knowledge / curación

Regla:
- cada proceso debe tener una sola fuente de verdad
- el runtime no decide negocio, orquesta
- backend resuelve y valida

## Prioridad 4: escala reusable del producto

### 9. Capability profiles por solución
- `content_only`
- `ecommerce_assistant`
- `scheduling_assistant`
- `full_assistant`

### 10. Embebido reusable por script
Objetivo:
- instalar el widget por snippet
- activar solo capacidades necesarias según el cliente

## Criterio de cierre práctico
Se considera “chat automatizado fluido y usable” cuando:
- mantiene contexto multi-turno sin mezclar productos o flujos
- evita reactivar cotización por preguntas laterales
- agenda y cotización comparten estado cuando corresponde
- responde con wording flexible, no robótico
- cubre también conversaciones operativas frecuentes y no solo venta
- si no puede cerrar la resolución final, igual identifica la necesidad y comunica continuidad por operador
- ejecuta tareas reales con payloads completos y validados
- cae a humano de forma limpia cuando no puede resolver

## Slice prioritario inmediato ya abierto
WhatsApp QR ya queda como canal transversal configurable desde UI.

Pendientes de ese slice, priorizados:
1. enriquecer `quote_handoff` cuando el intake ya está completo
2. cerrar `support_request -> schedule_request` con estado compartido
3. ampliar más claves seguras del rewrite híbrido
4. modelar instalación variable por medida/tipo/producto relacionado
5. completar paridad de ejecución en storefront, admin y WhatsApp
6. endurecer sanitización backend por proceso crítico

Pendientes operativos del canal Meta:
1. definir la URL pública real del `channel-adapter`
2. terminar la suscripción del webhook en Meta usando el `Callback URL`
   `/webhooks/meta` y el `Verify Token` configurado

## Pendientes estratégicos ya priorizados para próximas iteraciones

1. convertir `General Site / Storefront` en scopes persistidos de CMS
2. unificar locale e idioma del chat según el usuario
3. unificar moneda de respuesta del chat según preferencia/contexto del usuario
4. reconciliación de historial e identidad después de desconexión o restore de WhatsApp
5. estructura `frequently bought together` y relación de instalación como add-on comercial
6. capa posterior de `Growth / Insights` para Google y Meta

Referencia consolidada:
- [PLATFORM_NEXT_ITERATIONS_ROADMAP.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/PLATFORM_NEXT_ITERATIONS_ROADMAP.md)
- [WEBCHAT_DEEP_EVALUATION_AND_SCOPE.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/WEBCHAT_DEEP_EVALUATION_AND_SCOPE.md)
