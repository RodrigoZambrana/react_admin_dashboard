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
- wording híbrido con overrides fuera de código
- capability profiles y kill switches
- instalación modelada como política estructurada
- ABM de perfiles y políticas desde UI

## Prioridad 1: mayor valor para cerrar fluidez + correctitud

### 1. Estado compartido entre soporte/postventa y agenda
Problema:
- un pedido de revisión o service todavía puede volver a cotización o romper el hilo

Resultado buscado:
- `support_request -> schedule_request` sin pérdida de motivo ni contexto

Implementación:
- estado operativo explícito por conversación
- motivo inferido persistente
- slots de agenda reaprovechables desde soporte, cotización y visita técnica

### 2. Rewrites híbridos adicionales sobre claves seguras
Problema:
- todavía hay respuestas correctas pero demasiado rígidas o repetitivas

Resultado buscado:
- más naturalidad sin perder control semántico

Implementación:
- ampliar solo en claves de bajo riesgo
- mantener fuente de verdad determinística
- IA opcional solo para variación superficial grounded

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
