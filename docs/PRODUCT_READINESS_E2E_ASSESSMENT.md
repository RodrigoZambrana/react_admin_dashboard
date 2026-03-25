# Product Readiness / E2E Commerce Assessment

## Propósito

Relevamiento técnico-operativo inicial del flujo comercial end-to-end para determinar:

- qué ya existe en código y runtime,
- qué está parcial,
- qué falta cerrar para considerar al producto listo para una compra real de punta a punta.

Fecha de referencia: `2026-03-22`

## Criterio de lectura

- `Operativo`: existe y ya forma parte usable del flujo actual.
- `Parcial`: existe, pero tiene huecos funcionales, operativos o de integración.
- `Pendiente`: no está resuelto o no tiene definición suficiente para operar.

## Resumen ejecutivo

Estado general de la Subfase 8.1:

- `Catálogo y navegación pública`: operativo.
- `Carrito`: operativo a nivel UX básica, pero parcial a nivel operación real.
- `Checkout`: parcial.
- `Mercado Pago`: parcial con gaps críticos de consistencia.
- `Mails transaccionales`: parcial.
- `Datos de envío/entrega`: parcial y todavía subdefinido para operación real.
- `Notificaciones`: parcial.

Conclusión:

El producto ya tiene una base funcional real para compra pública, pero todavía no está en condición de considerarse `E2E commerce ready`. El principal cuello de botella no es catálogo o storefront, sino la coherencia entre checkout, pago, mails, notificaciones, stock y post-compra.

## 1. Catálogo y stock público

### Estado actual

`Operativo con observaciones`

- El storefront lista categorías y productos reales desde backend.
- Los endpoints públicos resuelven:
  - categorías,
  - listado de productos,
  - detalle de producto,
  - recomendaciones,
  - producto paramétrico y cotización paramétrica.
- El catálogo público filtra productos `published=true` y `productType=PHYSICAL`.
- El storefront soporta:
  - productos simples,
  - variantes,
  - productos paramétricos.
- La UI pública ya consume slugs reales y categorías reales.

### Hallazgos

- La disponibilidad pública usa `stock`, `status`, `permanentStock` y stock por variante para mostrar inventario.
- En el flujo de creación de orden sí hay validación de existencia/publicación y de stock de variante agotada.
- No aparece en este relevamiento una reserva/descuento explícito de stock al crear la orden desde el storefront.

### Lectura operativa

- El catálogo está suficientemente maduro para seguir con E2E.
- El control de inventario todavía no se puede considerar completamente cerrado para operación comercial real hasta confirmar política de:
  - reserva,
  - descuento,
  - sobreventa,
  - productos permanentes vs stock finito.

## 2. Carrito

### Estado actual

`Operativo con límites`

- El carrito funciona en storefront activo.
- Soporta:
  - producto simple,
  - producto con variante,
  - producto paramétrico con configuración persistida.
- La UX base de agregar, quitar y modificar cantidad está resuelta.

### Hallazgos

- El carrito vive en `localStorage` del navegador (`storefront.cart.v1`).
- No hay persistencia server-side del carrito.
- No hay reserva de inventario en etapa carrito.
- No hay revalidación fuerte de stock hasta el momento de crear orden.

### Lectura operativa

- Sirve para el flujo comercial base.
- No alcanza todavía para operación robusta multi-dispositivo o prevención de conflictos de inventario.

## 3. Checkout

### Estado actual

`Parcial`

- El checkout público existe y está dividido en:
  - datos,
  - pago,
  - revisión.
- Se precarga información del usuario autenticado.
- El payload de creación de orden contempla:
  - cliente,
  - dirección de envío,
  - dirección de facturación opcional,
  - ítems,
  - notas,
  - `paymentIntentId`,
  - `checkoutToken`,
  - moneda.

### Hallazgos

- La UI actual captura solo el mínimo:
  - nombre,
  - apellido,
  - email,
  - teléfono,
  - dirección,
  - país,
  - departamento/ciudad.
- El `zip` se deriva por default; no hay captura operativa más rica.
- No hay selección pública de:
  - método de entrega,
  - retiro vs envío,
  - franja/agenda,
  - costo de entrega dinámico,
  - proveedor logístico.
- `billingAddress` no está realmente trabajado como flujo diferenciado en UI pública.

### Lectura operativa

- El checkout actual alcanza para pruebas controladas.
- No alcanza todavía como flujo final cerrado hasta relevar y fijar datos reales de entrega y fulfillment.

## 4. Mercado Pago

### Estado actual

`Parcial con hallazgos críticos`

- Existe integración pública para:
  - crear preferencia,
  - capturar pago con brick,
  - webhook de Mercado Pago,
  - sincronización de `StorefrontPaymentIntent`,
  - exposición de configuración pública (`publicKey`, país, enabled).
- El storefront ya monta el brick y procesa respuesta.
- La orden puede vincularse a un `paymentIntentId`.

### Hallazgos críticos

- El flujo actual permite continuar con la compra cuando el pago queda en estados como `pending` o `in_process`.
- En `createOrder`, si llega `paymentIntentId`, la orden pasa a `PAID` tras vincular el intent, sin una comprobación adicional de estado final confirmado del pago dentro de ese paso.
- El webhook sincroniza `StorefrontPaymentIntent` y actualiza/crea `Payment`, pero en este relevamiento no aparece un disparo equivalente de:
  - `notifyPaymentReceived`,
  - timeline de pago,
  - cierre funcional de post-pago desde el flujo storefront.
- Las notificaciones de pago confirmado sí existen, pero hoy aparecen conectadas al flujo de `accounting/payments`, no claramente al ciclo automático de Mercado Pago storefront.

### Lectura operativa

- La integración existe, pero todavía no puede considerarse cerrada a nivel negocio.
- Este es hoy el tramo más crítico del E2E junto con envío/entrega.

## 5. Mails transaccionales

### Estado actual

`Parcial`

- La infraestructura de mails ya está implementada con:
  - React Email,
  - templates persistidos,
  - cola,
  - categorías `ORDERS`, `PAYMENTS`, `AUTH`,
  - configuración por provider y destinatarios.
- Existen envíos para:
  - orden recibida,
  - pago recibido,
  - cambios de estado,
  - recuperación de contraseña.

### Hallazgos

- `notifyOrderReceived` sí se dispara al crear una orden nueva.
- La capa de email depende de:
  - provider configurado,
  - recipients configurados,
  - flags de categoría.
- Los defaults actuales de notificaciones/email dejan desactivados por defecto los emails al cliente para varios eventos clave:
  - `ORDER_RECEIVED` customer email: `false`,
  - `PAYMENT_RECEIVED` customer email: `false`,
  - `ORDER_STATUS_CHANGED` customer email: `false`.
- Admin email sí aparece habilitado por defecto para orden recibida y pago recibido.

### Lectura operativa

- La infraestructura está.
- La experiencia transaccional real para el comprador todavía no puede darse por cerrada hasta validar:
  - provider real,
  - destinatarios,
  - contenido final,
  - flags efectivos por evento.

## 6. Datos de envío y entrega

### Estado actual

`Parcial`

- El modelo de orden soporta:
  - dirección de envío/facturación,
  - `shippingVendor`,
  - `deliveryFees`,
  - `estimatedMin`,
  - `estimatedMax`.
- El admin ya tiene edición de entrega y shipping en el dominio de órdenes.

### Hallazgos

- El storefront no consume todavía un modelo de fulfillment realmente definido.
- Falta relevar formalmente qué necesita el negocio para concretar entrega:
  - envío o retiro,
  - datos exactos de dirección,
  - localidad/departamento,
  - observaciones,
  - teléfono de contacto,
  - costo,
  - plazo estimado,
  - proveedor o modalidad.
- Hoy el flujo público no selecciona ni calcula entrega.

### Lectura operativa

- Este tramo todavía está técnicamente modelado, pero funcionalmente incompleto.
- Requiere relevamiento antes de implementarse de forma definitiva.

## 7. Notificaciones

### Estado actual

`Parcial`

- Existe sistema de notificaciones:
  - `IN_APP`,
  - `EMAIL`,
  - con settings por evento/audiencia/canal.
- El storefront tiene API y UI para notificaciones del cliente:
  - listado,
  - unread count,
  - mark as read,
  - stream SSE.
- Existen eventos previstos para:
  - orden recibida,
  - pago recibido,
  - cambio de estado de orden.

### Hallazgos

- `ORDER_RECEIVED` y `ORDER_STATUS_CHANGED` están claramente conectados al dominio de órdenes.
- `PAYMENT_RECEIVED` existe como evento, pero no queda demostrado en este relevamiento que el flujo automático de Mercado Pago storefront lo dispare de forma consistente.

### Lectura operativa

- La base de notificaciones está madura.
- El cierre del flujo depende de atar mejor pagos reales del storefront al orquestador de notificaciones.

## 8. Superficies administrativas ya disponibles

El proyecto ya cuenta con piezas del admin que ayudan a operar esta fase:

- productos y publicación,
- precios/paramétricos,
- órdenes,
- pagos contables,
- perfil de empresa,
- configuración de Mercado Pago,
- configuración de email,
- templates de email,
- producción y delivery sobre órdenes.

Lectura:

- La carencia principal no es ausencia de panel operativo.
- El problema es cerrar el puente entre storefront público y operación real de esas piezas.

## 9. Gaps críticos a resolver antes de considerar cierre E2E

1. Definir la semántica real del pago en storefront:
   - `pending` / `in_process` no deberían equivaler automáticamente a compra cerrada.

2. Corregir consistencia entre `paymentIntent`, `Payment`, timeline y estado final de la orden.

3. Confirmar disparo real de:
   - mail al comprador,
   - mail al admin,
   - notificación al cliente,
   - notificación al admin,
   cuando el pago efectivamente queda confirmado.

4. Relevar y definir el modelo mínimo de envío/entrega del negocio.

5. Decidir política de stock en compra pública:
   - validación final,
   - reserva,
   - decremento,
   - sobreventa tolerada o no.

## 10. Prioridad recomendada para la Subfase 8.2+

Orden recomendado:

1. Semántica y cierre real de pagos.
2. Post-pago:
   - estado de orden,
   - timeline,
   - notificaciones,
   - mails.
3. Datos de envío/entrega y fulfillment.
4. Validación de stock en operación real.
5. QA funcional y testing exploratorio integral.

## 11. Conclusión operativa

El proyecto ya tiene base suficiente para avanzar a cierre del flujo comercial, pero todavía no está listo para presentarse como ecommerce end-to-end resuelto.

Hoy el mayor riesgo no es de interfaz sino de coherencia operacional:

- cuándo una compra se considera realmente pagada,
- qué se comunica al cliente,
- qué se comunica al sitio,
- qué datos de entrega se capturan,
- y cómo queda trazado el estado posterior.
