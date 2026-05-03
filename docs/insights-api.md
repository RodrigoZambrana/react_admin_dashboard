# Insights API

La capa `insights` expone datos de producción de forma controlada, sin acceso directo a la base para consumidores externos o herramientas internas.

## Auth

Todos los requests requieren:

```http
Authorization: Bearer <token>
```

Se aceptan dos tipos de bearer token:

- JWT de usuario admin del sistema
- API key de servicio almacenada en `SecureConfig` bajo `INSIGHTS_API_AUTH`

### Service keys

La API key de servicio se administra desde la UI de analytics en:

- `/app/analytics/data-access`

Desde esa pantalla un admin puede:

- ver la calidad de las fuentes conectadas
- consultar un snapshot resumido de la DAL
- emitir una nueva API key para consumo externo

La clave se persiste cifrada en `SecureConfig` y solo se expone en texto plano una vez al crearla.

### Scopes

Los endpoints validan scopes lógicos:

- `read:products`
- `read:search`
- `read:analytics`
- `read:ads`
- `read:funnels`

## Respuesta

Cada endpoint responde con:

```json
{
  "data": {
    "items": [],
    "normalized": [],
    "summary": {}
  },
  "meta": {
    "version": "v1",
    "source": "internal | ga | ads | search_console | mixed",
    "generated_at": "",
    "cache": "hit | miss",
    "date_range": {
      "from": "",
      "to": ""
    },
    "tenant_id": "",
    "requested_scopes": [],
    "quality": {
      "sources": []
    }
  }
}
```

## Endpoints

- `GET /api/insights/products/search`
- `GET /api/insights/products/performance`
- `GET /api/insights/search/queries`
- `GET /api/insights/search/performance`
- `GET /api/insights/analytics/funnels`
- `GET /api/insights/analytics/ctas`
- `GET /api/insights/analytics/sessions`
- `GET /api/insights/external/ga/traffic`
- `GET /api/insights/external/ads/campaigns`
- `GET /api/insights/sources/quality`
- `GET /api/insights/service-keys`
- `POST /api/insights/service-keys`

## Fuentes

- Productos: `storefront.service`
- Funnels y sesión: `analytics.service` y tablas normalizadas
- Search Console, GA4 y Ads: tablas persistidas normalizadas

## Cache

La capa usa cache en backend para evitar consultas pesadas en tiempo real. El `meta.cache` indica si la respuesta vino de `hit` o `miss`.

## Auditoría

Cada request se registra en `analytics_endpoint_usage`.
