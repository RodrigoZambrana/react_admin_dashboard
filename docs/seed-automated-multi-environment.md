# Sistema de seed automatizado multi-ambiente

## Fase 0 - Análisis estructural

### A. Datos obligatorios

- `CONFIG_ENCRYPTION_KEY`: necesario para almacenar secretos en `SecureConfig`.
- `JWT_SECRET`: requerido para autenticación JWT.
- `COOKIE_SECRET`: requerido para firmar cookies de sesión.

### B. Datos necesarios con defaults

- `DEFAULT_USER_TEMP_PASSWORD`, `STOREFRONT_GENERIC_CUSTOMER_PASSWORD`.
- `EMAIL_PROVIDER`, `EMAIL_FROM_DEFAULT`, `EMAIL_FROM_NAME_DEFAULT`.
- `PAYMENTS_PROVIDER`, `MP_COUNTRY`, `MP_TIMEOUT_MS`.
- `GOOGLE_OAUTH_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`.
- `RECAPTCHA_ENABLED`, `ADMIN_RECAPTCHA_ENABLED`, `STOREFRONT_RECAPTCHA_ENABLED`.
- `ALLOWED_ORIGINS`, `DEFAULT_ALLOWED_ORIGINS`, `NEXT_PUBLIC_SITE_URL`.
- `SESSION_TTL_HOURS`, `STOREFRONT_COOKIE_SECURE`, `STOREFRONT_COOKIE_SAMESITE`, `STOREFRONT_COOKIE_DOMAIN`.

### C. Datos no necesarios para seed inicial

- Productos, pedidos, clientes, usuarios finales.
- Eventos, actividades, tickets operativos.
- Mensajes, conversaciones y ejecuciones de IA.
- Datos demo amplios o catálogos importados desde fixtures históricos.

## Configuración persistida

- `SystemConfig` ya cubre `taxRate`, `currencyBase`, `currencies`, `themeConfig` y banderas legacy de storefront.
- `SecureConfig` ya cubre credenciales de email, inbox, Google e integraciones de pagos.
- `Setting` centraliza el snapshot seedable de configuración crítica para evolución futura.

## Dominios del seed

- `settings.seed.ts`: valores declarativos de configuración funcional.
- `integrations.seed.ts`: credenciales y secretos persistidos en `SecureConfig`.
- `config.seed.ts`: defaults de sistema y compatibilidad legacy con `SystemConfig`.

## Reglas de ejecución

- Idempotente: las filas seedables se crean solo si no existen.
- Multi-ambiente: el valor se etiqueta con `NODE_ENV`.
- Bootstrap-first: `.env` actúa como input inicial; la DB queda como fuente persistente.
- Validación: el seed falla antes de escribir si faltan secretos críticos.
- Precedencia: si una configuración ya existe por vía administrativa, el seed la respeta y no la pisa.
- Alcance: el seed inicializa una base operativa rápida; la administración posterior sigue viviendo en las pantallas existentes.
