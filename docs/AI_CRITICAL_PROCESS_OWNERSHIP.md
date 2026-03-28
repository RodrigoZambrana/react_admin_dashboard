# AI Critical Process Ownership

## 1. Objetivo

Este documento define la fuente de verdad y la capa responsable para los procesos críticos que hoy toca el runtime conversacional.

Regla base:

- el runtime conversacional interpreta, ordena y decide la siguiente acción
- la lógica operativa crítica vive en backend
- frontend solo puede hacer preview visual o edición asistida
- ningún cálculo crítico debe existir duplicado como autoridad en más de una capa

Debe leerse junto con:

- [AI_RUNTIME_MINIMAL_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_RUNTIME_MINIMAL_DESIGN.md)
- [AI_QUOTE_PROFILES_AND_DERIVED_TAXONOMY_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_QUOTE_PROFILES_AND_DERIVED_TAXONOMY_DESIGN.md)
- [AI_ACTION_INPUT_CONTRACTS_AND_SANITIZATION.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_ACTION_INPUT_CONTRACTS_AND_SANITIZATION.md)
- [canonical-messaging-contract.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/canonical-messaging-contract.md)

## 2. Regla de ownership

### 2.1 Runtime conversacional

Responsable de:

- detectar intención
- mantener contexto e hilos
- decidir si pedir aclaración, responder, derivar o ejecutar
- capturar intake mínimo por flujo
- elegir la herramienta/backend call correcta
- renderizar respuesta humana a partir del resultado operativo

No responsable de:

- calcular precio final por cuenta propia
- validar disponibilidad real de agenda por su cuenta
- decidir estados de pedidos/pagos por fuera del backend

### 2.2 Backend operativo

Responsable de:

- pricing real
- búsqueda real de productos, pedidos, pagos y citas
- persistencia y validación
- side effects
- reglas de negocio críticas

### 2.3 Frontend

Responsable de:

- edición
- previsualización local
- feedback visual
- captura de inputs

No responsable de:

- ser la fuente final del cálculo
- ser la fuente final del estado de negocio

## 3. Productos y pricing

### 3.1 Fuente de verdad

- búsqueda de productos: `backend/src/ai/ai.service.ts`
- preview autoritativo de cotización inmediata: `backend/src/ai/ai.service.ts::previewProductQuote`
- lógica base por unidad de venta: `backend/src/orders/sales-documents.service.ts::previewSalesUnitPricing`

### 3.2 Rol del runtime

- usar `search_products` para confirmar existencia real en catálogo
- usar `previewProductQuote` para precio inmediato
- usar `prepareAberturasQuote` solo cuando el flujo sea paramétrico o exact-match externo

### 3.3 Rol del frontend

Archivos actuales como:

- [salesUnitCalculation.ts](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/utils/salesUnitCalculation.ts)
- [salesDocumentCalculations.ts](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/utils/salesDocumentCalculations.ts)

deben considerarse:

- helpers de edición
- preview local para tablas/formularios
- soporte UI

No deben considerarse:

- pricing autoritativo para respuestas del agente
- criterio final de negocio

### 3.4 Criterio operativo

- `UNIT`: precio inmediato solo vía catálogo/backend
- `SQUARE_METER`: cálculo inmediato solo vía backend
- `LINEAR_METER`: cálculo inmediato solo vía backend
- `PARAMETRIC` o equivalente: resolver exact-match si backend lo soporta; si no, handoff

## 4. Cotizaciones customer

### 4.1 Fuente de verdad del intake

- `quote profiles` curados por tenant
- `topic taxonomy` curada/derivada por tenant
- `KnowledgeDerivedArtifact` como proyección reutilizable

### 4.2 Fuente de verdad del pricing

- backend product preview
- backend parametric quote preparation

### 4.3 Regla de resolución

- si el producto existe y tiene pricing inmediato confiable: responder en el momento
- si el producto existe a nivel informacional pero no hay pricing inmediato: `information -> intake -> handoff`
- si la conversación mezcla estrategias distintas: usar el camino menos optimista y derivar

### 4.4 Particularidad tenant-specific

La presupuestación paramétrica de `urucortinas` es tenant-specific.

No debe contaminar el baseline general del SaaS.

El baseline general solo asume:

- `immediate_unit_price`
- `immediate_square_meter`
- `handoff_only`

`parametric_exact_or_handoff` debe activarse solo por perfil del tenant.

## 5. Agenda y visitas técnicas

### 5.1 Fuente de verdad

- disponibilidad real: `calendarEvent`
- creación/actualización: endpoints `/api/ai/appointments`

### 5.2 Qué no es fuente de verdad

- board de `activities`
- vistas agregadas de proyecto
- cache del frontend

Esas son proyecciones o UI de trabajo.

### 5.3 Regla de runtime

El runtime puede:

- capturar día, horario, dirección, contacto y motivo desde la conversación
- inferir motivo operativo si hace falta
- consultar disponibilidad real
- crear la visita si hay disponibilidad

El runtime no debe:

- inventar disponibilidad
- confirmar una visita sin validación de backend

## 6. Pedidos, presupuestos y pagos

### 6.1 Pedidos y presupuestos

Fuente de verdad:

- backend de documentos comerciales
- estados y estructura solo desde backend

El runtime:

- busca
- propone
- actualiza vía herramientas autorizadas

### 6.2 Pagos

Fuente de verdad:

- backend de pagos y settlement

El runtime:

- busca pagos
- registra/actualiza solo por tools backend
- no recalcula montos ni estados localmente

## 7. Knowledge y taxonomía

### 7.1 Fuente de verdad

- `KnowledgeDocument` aprobado
- `KnowledgeDerivedArtifact` activo

### 7.2 Regla

- curado explícito gana sobre derivado
- derivado gana sobre heurística residual
- si se elimina el documento fuente, deben invalidarse sus derivados

## 8. Duplicaciones actuales a controlar

### 8.1 Unidad de venta y cálculo visual

Existe lógica repartida entre backend y frontend para `UNIT`, `SQUARE_METER` y `LINEAR_METER`.

Criterio:

- backend = cálculo autoritativo
- frontend = preview local no autoritativo

### 8.2 Agenda vs activities

Existe lenguaje de UI que sigue hablando de `activities`.

Criterio:

- `calendarEvent` = entidad operativa
- `activities` = superficie de trabajo/proyección

### 8.3 Cotización conversacional

Existe riesgo de duplicar negocio entre:

- runtime
- knowledge
- backend pricing

Criterio:

- runtime capta y decide
- knowledge define requisitos y lenguaje
- backend calcula y valida

## 9. Plan de centralización

### 9.1 Inmediato

- mantener `previewProductQuote` como único cálculo autoritativo de cotización inmediata
- mantener `calendarEvent` como único control de disponibilidad
- mantener `quote profiles` y `topic taxonomy` fuera del código

### 9.2 Próximo

- exponer un contrato backend explícito de `pricing capability` por producto
- marcar en backend si un producto resuelve por `UNIT`, `SQUARE_METER`, `LINEAR_METER`, `PARAMETRIC` o `HANDOFF`
- hacer que frontend lea esa capacidad en lugar de inferirla desde varias capas

### 9.3 Posterior

- consolidar helpers de unidad de venta del frontend en una sola librería UI
- evitar reimplementar reglas de cálculo en cada pantalla
- documentar ownership por acción/tool del runtime

## 10. Criterio final

Si una conversación necesita:

- entender lo que el usuario quiere
- ordenar el flujo
- pedir faltantes
- decidir si deriva o ejecuta

eso lo resuelve el runtime.

Si necesita:

- calcular
- validar disponibilidad
- confirmar existencia real
- persistir cambios

eso lo resuelve backend.
