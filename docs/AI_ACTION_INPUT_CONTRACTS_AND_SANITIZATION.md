# AI Action Input Contracts And Sanitization

## 1. Objetivo

Este documento fija el contrato entre:

- extracción/intake conversacional
- ejecución de acciones desde `ai-agent-service`
- validación y sanitización en backend

La regla operativa es:

- el runtime puede extraer y normalizar
- el backend decide si el payload está suficientemente completo y válido para ejecutar
- ningún flujo debe ejecutar side effects si faltan datos mínimos o si el formato no cumple el contrato esperado

Debe leerse junto con:

- [AI_CRITICAL_PROCESS_OWNERSHIP.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_CRITICAL_PROCESS_OWNERSHIP.md)
- [AI_QUOTE_PROFILES_AND_DERIVED_TAXONOMY_DESIGN.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_QUOTE_PROFILES_AND_DERIVED_TAXONOMY_DESIGN.md)
- [canonical-messaging-contract.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/canonical-messaging-contract.md)

## 2. Capas actuales de protección

## 2.1 Runtime conversacional

Responsable de:

- extraer entidades y slots
- mantener contexto e hilos
- no ejecutar si el intake todavía está incompleto
- construir payloads con formato backend-first

No responsable de:

- decidir validez final de negocio
- tolerar payloads maliciosos o inconsistentes como si fueran válidos

## 2.2 Backend AI

Hoy ya tiene dos capas globales:

- `SanitizeInputPipe`
  - archivo: [sanitize-input.pipe.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/common/pipes/sanitize-input.pipe.ts)
- `ValidationPipe`
  - archivo: [main.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/main.ts)

Contrato actual:

- `SanitizeInputPipe` limpia strings, remueve HTML peligroso y bloquea patrones obvios de SQL/XSS
- `ValidationPipe` usa `whitelist: true` y `transform: true`
- los DTO de `backend/src/ai/dto` son el contrato formal por endpoint

## 2.3 Service layer

El service backend agrega validación de negocio:

- citas:
  - no permite `endAt < startAt`
- stock:
  - no permite stock negativo
- pagos:
  - no permite registrar pagos contra pedidos inexistentes
- customer:
  - normaliza email/teléfono y mergea por match existente

## 3. Invariante por flujo

Antes de ejecutar una acción, deben cumplirse estas tres condiciones:

1. el runtime marcó el flujo como `ready` o `ready_to_schedule`, o el draft admin quedó `ready`
2. el payload cumple el DTO backend
3. el service backend acepta el payload según reglas de negocio

Si cualquiera falla:

- no se ejecuta side effect
- se responde con aclaración, corrección o handoff

## 4. Matriz de contratos por acción

## 4.1 Customer schedule request

Flujo:

- customer conversacional
- usa disponibilidad real y crea visita técnica

Runtime requiere:

- día exacto
- horario exacto
- dirección
- teléfono o email de contacto
- motivo/purpose

Payload backend:

- endpoint: `POST /api/ai/customer-appointments`
- DTO: [create-ai-appointment.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/create-ai-appointment.dto.ts)

Campos efectivos:

- `title`
- `startAt`
- `endAt` opcional
- `location`
- `description` opcional
- `metadata`

Normalización actual:

- fecha/hora -> ISO
- dirección -> texto limpio sin cola de contacto
- contacto -> teléfono/email
- motivo -> derivado desde conversación

Gap pendiente:

- validación semántica más estricta de dirección/contacto
- normalizador central de texto de ubicación
- allowlist de `metadata` para no aceptar cualquier clave arbitraria

## 4.2 Customer immediate quote preview

Flujo:

- customer conversacional
- solo para productos con pricing inmediato real

Payload backend:

- endpoint: `POST /api/ai/products/quote-preview`
- DTO: [preview-ai-product-quote.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/preview-ai-product-quote.dto.ts)

Campos posibles:

- `productId`
- `quantity`
- `widthMm`
- `heightMm`
- `lengthMm`
- `items[]`

Regla:

- el runtime convierte medidas visibles a mm canónicos
- el backend calcula usando lógica autoritativa de unidad de venta

Gap pendiente:

- endurecer validación semántica por `SalesUnit`
- impedir combinaciones inconsistentes, por ejemplo:
  - `UNIT` con medidas no aplicables
  - `SQUARE_METER` sin ancho/alto
  - `LINEAR_METER` sin largo

## 4.3 Customer handoff with complete intake

Flujo:

- información -> intake -> handoff
- aplica cuando el producto existe informacionalmente pero no tiene pricing inmediato confiable

Regla:

- no ejecuta pricing
- sí debe confirmar datos reunidos
- sí puede dejar trazabilidad/handoff

Contrato actual:

- el runtime ya controla esto
- todavía no existe un endpoint único de `handoff intake` consolidado

Gap pendiente:

- crear contrato backend explícito para registrar intake completo pendiente de operador

## 4.4 Admin customer create/update

Endpoints:

- `POST /api/ai/customers`
- `PUT /api/ai/customers/:id`

DTOs:

- [create-ai-customer.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/create-ai-customer.dto.ts)
- [update-ai-customer.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/update-ai-customer.dto.ts)

Campos mínimos actuales:

- create:
  - `name`
- update:
  - `id` válido en path
  - al menos un campo relevante a modificar

Validación actual:

- email
- phone
- max lengths

Gap pendiente:

- endurecer formato y normalización de `preferredLocale`
- evitar updates vacíos a nivel service

## 4.5 Admin appointment create/update/delete

Endpoints:

- `POST /api/ai/appointments`
- `PUT /api/ai/appointments/:id`
- `DELETE /api/ai/appointments/:id`

DTOs:

- [create-ai-appointment.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/create-ai-appointment.dto.ts)
- [update-ai-appointment.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/update-ai-appointment.dto.ts)

Campos mínimos:

- create:
  - `title`
  - `startAt`
- update:
  - `id` válido
  - algún cambio real

Gap pendiente:

- esquema explícito para `metadata`
- reglas de disponibilidad/colisión más formales si la cita se usa como booking crítico

## 4.6 Admin product create/update

Endpoints:

- `POST /api/ai/products`
- `PUT /api/ai/products/:id`

DTOs:

- [create-ai-product.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/create-ai-product.dto.ts)
- [update-ai-product.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/update-ai-product.dto.ts)

Campos relevantes:

- `name`
- `productType`
- `mode`
- `salePrice`
- `costPrice`
- `currency`
- `unitOfMeasure`
- `published`

Gap pendiente:

- validación semántica central por combinación:
  - `productType`
  - `mode`
  - `unitOfMeasure`
- restricciones explícitas por tenant/capability para evitar productos incoherentes

## 4.7 Admin order / quote create and structure updates

Endpoints:

- `POST /api/ai/orders`
- `POST /api/ai/quotes`
- `PUT /api/ai/orders/:id`
- `PUT /api/ai/quotes/:id`

DTOs:

- [create-ai-order.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/create-ai-order.dto.ts)
- [update-ai-document-structure.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/update-ai-document-structure.dto.ts)

Mínimos:

- `customerId`
- `items[]`
- por item:
  - `name`
  - `price`
  - `qty`

Gap pendiente:

- límites y validación semántica de shipping fields
- reglas contra items vacíos o payloads excesivamente grandes
- validación central de currency coherente en todo el documento

## 4.8 Admin payment create/update

Endpoints:

- `POST /api/ai/payments`
- `PUT /api/ai/payments/:id`
- `PUT /api/ai/payments/:id/status`

DTOs:

- [create-ai-payment.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/create-ai-payment.dto.ts)
- [update-ai-payment.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/update-ai-payment.dto.ts)
- [update-ai-payment-status.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/update-ai-payment-status.dto.ts)

Mínimos:

- create:
  - `orderId`
  - `amount`
  - `currency`
- update:
  - `id` válido
  - payload relevante

Gap pendiente:

- sanitización/normalización de `reference` y `method` por política más estricta
- reglas para evitar notas excesivas o referencias malformadas

## 4.9 Tenant-specific parametric quote preparation

Endpoints:

- `POST /api/ai/aberturas/prepare-quote`
- `POST /api/ai/aberturas/prepare-insert`

DTOs:

- [prepare-ai-aberturas-quote.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/prepare-ai-aberturas-quote.dto.ts)
- [prepare-ai-aberturas-insert.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/ai/dto/prepare-ai-aberturas-insert.dto.ts)

Regla:

- esto es tenant-specific de `urucortinas`
- no debe contaminar el baseline general del SaaS

Gap pendiente:

- extraer un contrato más estructurado que `text` libre cuando el flujo paramétrico quede estable

## 5. Confirmación sobre el estado actual

Hoy sí existe validación técnica básica en backend para todos los caminos principales de ejecución:

- sanitización global
- validación DTO
- validación de negocio en service
- control de permisos por tool y role

Por lo tanto, no estamos en un estado de “payload libre sin control”.

Lo que sigue pendiente no es la ausencia total de sanitización, sino endurecer:

- validación semántica por proceso
- allowlists por campos complejos
- restricciones de formato más específicas por acción
- contratos explícitos para handoff/intake no ejecutado

## 6. Pendientes documentados

Pendiente posterior, no bloqueante para el cierre actual:

### 6.1 Sanitización backend más estricta por proceso

Agregar una segunda capa específica por flujo, encima del sanitizado global:

- customer schedule:
  - dirección, contacto, metadata
- quote preview:
  - coherencia entre unidad de venta y medidas
- orders/quotes:
  - límites de items, shipping, currency
- payments:
  - method/reference/notes
- products:
  - coherencia `mode` + `productType` + `unitOfMeasure`

### 6.2 Contratos explícitos de payload ready-to-execute

Definir payload builders tipados y validados para:

- `customer technical visit`
- `customer complete quote handoff`
- `immediate product quote preview`
- `admin document structure mutation`

### 6.3 Policy layer

Agregar una política común que responda:

- qué campos son obligatorios por acción
- qué normalización se aplica antes del backend
- qué backend DTO valida
- qué service hace la validación final
- cuándo se rechaza
- cuándo se deriva

## 7. Criterio final

Para cualquier acción con side effects:

- extracción conversacional sin payload válido no alcanza
- normalización sin validación backend no alcanza
- DTO válido sin reglas de negocio no alcanza

La ejecución correcta requiere las tres capas:

- runtime
- contrato backend
- validación de negocio
