# Conversion Mapping Layer

Esta capa traduce eventos internos del sistema en conversiones canónicas para Google Ads.

## Objetivo

- Convertir eventos estructurales internos en conversiones Ads válidas.
- Evitar duplicación.
- Mantener el backend como fuente de verdad para compras y leads confirmados.
- Conservar trazabilidad completa en `analytics_conversion_receipts`.

## Flujo

1. El frontend captura atribución (`gclid`, `wbraid`, `gbraid`, `utm_*`) y la persiste en `localStorage` y cookie.
2. `trackAnalyticsEvent()` envía el evento a `/api/analytics/events`.
3. Si el evento es de conversión, también reenvía el mismo payload a `/api/conversions/track`.
4. El backend mapea el evento interno a una conversión canónica.
5. El backend deduplica por `transaction_id` en compras o por `event_id` en el resto.
6. Si hay evidencia suficiente y configuración Ads válida, hace server-side upload a Google Ads.
7. El resultado se guarda en `analytics_conversion_receipts`.

## Mapeo canónico

- `purchase` / `purchase_completed` -> `purchase`
- `form_submit` / `lead_created` / `lead_form_submit` / `email_submit` -> `generate_lead`
- `whatsapp_click` / `phone_click` -> `contact`

## Reglas de validación

- `purchase` requiere `transaction_id` y `value`.
- `generate_lead` requiere evidencia de contacto o identificador publicitario.
- `contact` puede registrarse con el evento interno, pero solo se sube a Google Ads si hay evidencia suficiente.

## Endpoints

- `POST /conversions/track`
- `GET /conversions/receipts`

## Persistencia

El receipt guarda:

- evento interno
- conversión canónica
- `transaction_id`
- `event_id`
- identificadores Ads (`gclid`, `wbraid`, `gbraid`)
- valor y moneda
- estado del upload
- request/response
- razón de skip o error

## Fuente de verdad Ads

La capa usa la configuración existente de Google Ads:

- `growth_config`
- conexión OAuth de Google Ads en `analytics_connections`
- credenciales persistidas en `analytics_connection_credentials`

