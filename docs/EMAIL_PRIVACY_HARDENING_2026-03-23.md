# Email And Privacy Hardening

Fecha: 2026-03-23

## Alcance de esta ronda

- cerrar inconsistencias reales de locale en emails transaccionales storefront;
- definir reglas operativas mínimas para templates/settings;
- implementar un primer slice real de masking de PII sobre superficies administrativas.

## Implementado

### 1. Locale por audiencia en emails transaccionales

Cambios:

- [backend/src/email/email.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email.service.ts)
- [backend/src/email/__tests__/email.service.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/__tests__/email.service.spec.ts)

Resultado:

- `sendPaymentReceived()` ya no usa un único locale compartido.
- El email al cliente usa `customer.preferredLocale` cuando existe.
- El email a admin queda en locale operativo admin (`es`).
- `sendSalesDocumentStatusEmail()` ahora arma payloads separados para:
  - cliente,
  - administración.

Impacto:

- evita mezclas como contenido en inglés con estados/local labels en español;
- deja consistente el comportamiento con `sendOrderReceived()`.

Validación:

- `cd backend && npm test -- src/email/__tests__/email.service.spec.ts`
- `cd backend && npm run lint`
- `cd backend && npm run build`

### 1.b. Flujo storefront de emails enriquecido y activado

Cambios:

- [backend/src/email/email.types.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email.types.ts)
- [backend/src/email/email.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email.service.ts)
- [backend/src/email/templates/definitions.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/templates/definitions.ts)
- [backend/src/notifications/notification-settings.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/notifications/notification-settings.service.ts)
- [backend/src/email/__tests__/email.service.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/__tests__/email.service.spec.ts)

Resultado:

- el circuito storefront cubre y deja activos por defecto:
  - mail a cliente por `pedido recibido`,
  - mail a cliente por `pago recibido`,
  - mail a cliente por `cambio de estado de pedido`,
  - aviso admin por `pedido recibido`,
  - aviso admin por `pago recibido`,
  - aviso admin por `cambio de estado de pedido`;
- `NotificationSettingsService` ya crea nuevos defaults con esos canales `EMAIL` activos;
- además aplica un patch conservador sobre instalaciones viejas que todavía tenían los defaults legacy apagados y nunca fueron tocados.

Contenido agregado:

- mails de pedido/admin ahora incluyen teléfono del cliente cuando existe;
- mails de pago ahora incluyen:
  - número y fecha de pedido,
  - estado del pedido,
  - monto del pago,
  - pagado acumulado,
  - saldo pendiente,
  - total del pedido,
  - método,
  - referencia interna/proveedor,
  - resumen de items,
  - CTA a pedido/portal según audiencia;
- cliente ve claramente si el pago dejó el pedido totalmente saldado o si sigue parcial.

Alcance real del flujo activo:

- compra storefront:
  - `order.received`
  - `payment.received`
  - `order.status.*`
- autenticación:
  - `password reset`
  - `password changed / recovery notice`
- onboarding:
  - `welcome email` para registro directo storefront,
  - `welcome email` también para alta inicial por Google OAuth.

Pendiente explícito, no implementado todavía:

- email verification / activación de cuenta,
- mails operativos de abandono de checkout.

Esos dos siguen sin soporte funcional completo en el flujo actual y quedaron como backlog futuro porque requieren infraestructura adicional:

- verificación:
  - token/modelo de activación,
  - estado verificado en `Customer`,
  - endpoints y UI de confirmación;
- abandono de checkout:
  - política temporal clara,
  - job recurrente,
  - reglas de exclusión cuando ya existe orden o pago.

### 1.c. Flujo de efectivo coherente

Cambios:

- [backend/src/storefront/storefront.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/storefront.service.ts)
- [backend/src/email/email-template.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email-template.service.ts)
- [ecommerce/src/app/(storefront)/(checkout)/review/ReviewClient.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(storefront)/(checkout)/review/ReviewClient.tsx)
- [ecommerce/src/lib/utils/order-status.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/lib/utils/order-status.ts)
- [ecommerce/src/page-sections/customer-dashboard/orders/OrderStatus.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/page-sections/customer-dashboard/orders/OrderStatus.tsx)
- [ecommerce/src/translations/es.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/translations/es.ts)
- [ecommerce/src/translations/en.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/translations/en.ts)

Resultado:

- el pedido en efectivo se registra y puede avanzar como orden;
- el pago no se trata como confirmado hasta que administración lo registre;
- storefront expone `pending_confirmation` como estado explícito de pago;
- review, resumen de pago y timeline del cliente ya no lo presentan como `pedido confirmado/pago confirmado`;
- emails de `order.received` para cliente y admin ahora distinguen el caso efectivo y explican que la confirmación del pago queda pendiente del equipo.

Regla operativa vigente:

1. `storefront + efectivo`:
- se crea la orden,
- se crea además un `Payment` interno en estado `REGISTERED`,
- ese pago ya queda visible para administración dentro del circuito actual,
- se envía notificación de pedido recibido,
- no se dispara `payment.received`,
- el pago queda pendiente de confirmación manual.

2. `admin registra pago manual`:
- administración no crea el pago desde cero: confirma o marca fallido el pago ya registrado;
- cuando pasa a confirmado se genera `payment.received`,
- el timeline pasa por parcial/completo según corresponda,
- y recién ahí la orden puede considerarse saldada.

### 2. Masking inicial de PII en logs de email

Cambios:

- [backend/src/common/privacy/masking.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/common/privacy/masking.ts)
- [backend/src/common/privacy/__tests__/masking.spec.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/common/privacy/__tests__/masking.spec.ts)
- [backend/src/email/email-log.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email-log.service.ts)

Resultado:

- `EmailLogService.listLogs()` y `getLog()` ya no devuelven emails completos al panel admin;
- `toAddress`, `ccAddresses` y `bccAddresses` salen en formato enmascarado;
- la búsqueda sigue funcionando sobre los valores persistidos, pero la respuesta pública del endpoint ya no expone la dirección completa.

Primer criterio aplicado:

- se mantiene suficiente legibilidad operativa para identificar destinatario;
- se reduce exposición innecesaria en UI y payload de API.

## Gobernanza operativa recomendada

### Templates/settings

1. Roles
- `ADMIN/SUPERADMIN` puede editar configuración SMTP, recipientes admin y templates.
- edición de plantillas debe quedar restringida a perfiles explícitos; no abrir a roles comerciales generales.

2. Publicación
- una plantilla activa por combinación:
  - categoría,
  - variante (`CUSTOMER` / `ADMIN`),
  - locale.
- edición nueva debe generar versión nueva, no sobreescribir sin trazabilidad.

3. Preview/test
- toda modificación debe validarse con:
  - preview HTML/text,
  - test send controlado,
  - escenario explícito.

4. Locale
- emails a cliente: locale del cliente o fallback configurado;
- emails a admin: locale operativo interno;
- no mezclar payload/render de diferentes audiencias.

5. Recipients
- recipientes admin por categoría deben mantenerse por settings;
- evitar direcciones hardcodeadas fuera de settings o defaults documentados.

## Inventario PII inicial

### Superficies identificadas

1. Email logs
- destinatarios `to/cc/bcc`
- subject y errores
- estado: primer masking implementado

2. Order details / admin sales
- nombre, email, teléfono, direcciones, notas
- estado: pendiente inventario fino por vista/rol

3. Notifications / timeline
- metadatos de pedido, cliente y pagos
- estado: pendiente review de masking selectivo

4. Exports/reportes
- potencial exposición masiva de email/teléfono/dirección
- estado: pendiente relevamiento

5. Storefront account
- el cliente ve su propia PII; no aplica masking como en admin
- sí aplica minimización y evitar exposición de datos internos

## Política mínima propuesta

1. Backend sigue siendo fuente de verdad, pero no toda PII debe salir a cada UI.
2. Los endpoints administrativos deben exponer solo el nivel de detalle necesario para operar.
3. Los logs y listados deben usar masking por defecto cuando no requieran dato completo.
4. Exportes y vistas con PII completa deben evaluarse por rol.
5. La retención/anonymización queda pendiente como fase siguiente.

## Pendiente inmediato

1. evidencia real end-to-end de emails storefront:
- orden recibida,
- pago recibido,
- aviso admin.

2. gobernanza ejecutable en admin:
- documentar flujo draft/published/versioning,
- validar si la UI ya cubre completamente ese ciclo o si requiere ajustes.

3. siguiente slice de privacidad:
- inventario de PII por vista administrativa,
- masking por rol en `orders/customers/notifications`,
- propuesta de retención y anonimización.

4. futuros no implementados todavía:
- verificación/activación por email,
- abandono de checkout con job y reglas de elegibilidad.

## Estado

- subfase iniciada;
- código real aplicado en:
  - locale por audiencia,
  - payloads enriquecidos de compra/pago,
  - activación por defecto del circuito storefront,
  - masking inicial de logs;
- evidencia end-to-end de envío real todavía pendiente.
