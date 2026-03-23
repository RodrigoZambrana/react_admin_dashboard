# Email And Privacy Operations Assessment

Fecha: 2026-03-22

## Objetivo

Dejar relevado el estado operativo real del bloque de:

- plantillas y configuración de emails,
- emails transaccionales storefront/admin,
- recuperación/autenticación,
- y privacidad/protección de datos personales,

con suficiente detalle para implementación posterior sin perder contexto.

## Estado actual

### 1. ABM/configuración de emails

Existe una superficie administrativa real, no placeholder.

- Backend:
  - [backend/src/email/email-admin.controller.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email-admin.controller.ts)
  - [backend/src/email/email-settings.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email-settings.service.ts)
  - [backend/src/email/email-template.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email-template.service.ts)
  - [backend/src/email/email.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email.service.ts)
- Admin:
  - [frontend/src/views/settings/EmailSettings](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/settings/EmailSettings)
  - [frontend/src/services/SettingsService.ts](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/services/SettingsService.ts)

Capacidades ya presentes:

- configuración SMTP,
- configuración inbox email,
- test de envío,
- listado/preview/update de templates,
- logs de email,
- reglas/categorías de settings.

## 2. Emails transaccionales ya cableados

Ya existen flujos backend para:

- orden recibida,
- pago recibido,
- cambio de estado de pedido,
- recuperación/cambio de contraseña,
- emails de prueba.

Referencias:

- [backend/src/email/email.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email.service.ts)
- [backend/src/email/templates/definitions.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/templates/definitions.ts)
- [backend/src/orders/order-payment-settlement.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/orders/order-payment-settlement.service.ts)
- [backend/src/notifications/notification-orchestrator.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/notifications/notification-orchestrator.service.ts)

## 3. Flujos auth/recovery ya presentes

Storefront ya soporta recuperación real por:

- email,
- teléfono/OTP,
- soporte Google para recovery/reauth.

Referencias:

- [backend/src/storefront/security/storefront-security.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/security/storefront-security.service.ts)
- [backend/src/storefront/oauth/google-oauth.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/oauth/google-oauth.service.ts)
- [backend/src/storefront/storefront.controller.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/storefront.controller.ts)

## Gaps operativos reales

### Plantillas/emails

1. No quedó validado end-to-end con evidencia real el flujo storefront de:
- orden recibida,
- pago recibido,
- aviso a administradores,
- cambio de estado posterior.

2. No quedó definido todavía si storefront debe emitir además:
- mail de bienvenida,
- verificación explícita de cuenta,
- confirmación de alta por email/SMS,
- o solo recuperación posterior.

3. Falta gobernanza operativa:
- permisos finos de edición/publicación,
- defaults por tenant,
- control de idioma por template,
- estrategia de versionado/publicación.

### Privacidad / PII

1. Ya existe cifrado de `SecureConfig`, pero no una política general de PII de clientes.

2. Ya existe masking puntual en eventos de seguridad/OTP, pero no un tratamiento homogéneo de:
- logs,
- timeline,
- auditoría,
- reportes,
- exportes,
- vistas admin.

3. No quedó definida todavía una política de:
- retención,
- anonimización,
- borrado lógico,
- minimización de datos visibles por rol.

## Recomendación de implementación

### Bloque A. Email operations hardening

1. Validar end-to-end real:
- compra storefront,
- orden recibida,
- pago recibido,
- aviso admin.

2. Definir política de cuenta:
- bienvenida sí/no,
- verificación de correo sí/no,
- OTP como obligatorio u opcional,
- tenant defaults.

3. Cerrar operación admin:
- permisos,
- draft/published,
- idioma,
- preview y test controlado.

### Bloque B. Privacy hardening

1. Inventario de PII por superficie:
- backend logs,
- admin order details,
- exports/reportes,
- storefront account/orders.

2. Implementar masking sistemático donde corresponda.

3. Definir retención/anulación:
- clientes inactivos,
- intents/pagos históricos,
- events/security logs.

4. Documentar criterio por rol:
- qué ve soporte,
- qué ve ventas,
- qué ve admin/superadmin.

## Prioridad recomendada

1. Emails transaccionales storefront con evidencia real.
2. Gobernanza de templates/settings.
3. Inventario de PII y masking.
4. Retención/anonymización.

## Estado

- relevado y documentado;
- no cerrado operativamente todavía;
- siguiente paso recomendado: abrir una subfase específica de `Email/Privacy Operations Hardening`.
