# Analytics Sync Report - 2026-04-29

## Scope
- Source of truth: backend sync only.
- Sources evaluated: Google Analytics 4, Google Ads, Google Search Console.
- No CSV/manual baseline used for the operational report.

## Execution Result

All 3 sources completed manual incremental sync successfully through backend processes.

## Executive Summary

- The site already receives meaningful demand, but it is not yet converting that demand into measurable business outcomes with the same strength.
- Search demand is present and visible, especially around product intent such as persianas, roller and enrollables PVC.
- Brand demand exists, but there is still room to strengthen positioning so branded searches translate into better capture.
- Ads is useful today for acquisition analysis, but not yet strong enough to judge final ROI because conversion measurement is still incomplete.
- The operational question now is not "do we have data?" but "are we turning the available demand into captured opportunities?"

## Executive Actions

### What to build next
- Crear **/productos/persianas-de-enrollar** para responder mejor a **persianas de enrollar**. Incluir: explicación simple del producto, para qué sirve, tipos o variantes, beneficios principales, fotos reales, preguntas frecuentes, botón visible de WhatsApp, botón de llamada. La búsqueda ya existe; la página debe hacer que esa demanda llegue a consulta en vez de irse a otra marca.
- Crear **/productos/persianas-de-pvc** para responder mejor a **persianas de pvc**. Incluir: explicación simple del producto, para qué sirve, tipos o variantes, beneficios principales, fotos reales, preguntas frecuentes, botón visible de WhatsApp, botón de llamada. La búsqueda ya existe; la página debe hacer que esa demanda llegue a consulta en vez de irse a otra marca.
- Crear **/productos/cortinas-de-enrollar-pvc** para responder mejor a **cortinas de enrollar pvc**. Incluir: explicación simple del producto, para qué sirve, tipos o variantes, beneficios principales, fotos reales, preguntas frecuentes, botón visible de WhatsApp, botón de llamada. La búsqueda ya existe; la página debe hacer que esa demanda llegue a consulta en vez de irse a otra marca.
- Crear **/productos/precios-persianas-pvc** para responder mejor a **precios persianas pvc**. Incluir: rango de precios orientativo, explicación simple del producto, para qué sirve, tipos o variantes, beneficios principales, fotos reales, preguntas frecuentes, botón visible de WhatsApp, botón de llamada, qué cambia el precio. La búsqueda ya existe; la página debe hacer que esa demanda llegue a consulta en vez de irse a otra marca.

### What to improve on the current site
- Make the brand easier to recognize in search results.
- Turn generic product searches into dedicated pages instead of sending everyone to broad catalog pages.
- Add clear calls to action so the person who already has intent can contact the business fast.

### What to expect after those changes
- More search traffic from the terms people already use.
- Better click-through from Google because the page matches the search intent.
- More WhatsApp, calls and lead forms from people who are already close to buying.

### What the report is really saying
- People are already searching for products the site sells.
- The site is visible, but not always specific enough to win the click.
- The next move is not "more data"; it is "better pages for the demand that already exists."

| Source | Sync Status | Quality | Notes |
|---|---|---:|---|
| GA4 | Success | buena | GA4 con volumen suficiente para análisis |
| ADS | Success | regular | sync exitoso con señal de conversiones todavía no confiable |
| SEARCH_CONSOLE | Success | buena | query/page signal rica y estable |

## Manual Sync Runs

- GA4
  - `connectionId`: cmoj6wl44000enz35y4wccc8o
  - `status`: success
  - `recordsFetched`: 0
  - `recordsUpserted`: 0

- ADS
  - `connectionId`: cmojehg7g0b2in334zoxs3u35
  - `status`: success
  - `recordsFetched`: 0
  - `recordsUpserted`: 0

- SEARCH_CONSOLE
  - `connectionId`: cmojehg7u0b2jn33403e67i4t
  - `status`: success
  - `recordsFetched`: 0
  - `recordsUpserted`: 0

## Persisted Data Volumes

- `analyticsReportingDaily`: 701 rows
- `analyticsAdsDailyMetric`: 2 rows
- `analyticsSearchConsoleDailyMetric`: 565 rows
- `eventFact`: 0 rows

## Latest Sync Runs

- SEARCH_CONSOLE
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 60
  - `recordsUpserted`: 60
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- ADS
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 4
  - `recordsUpserted`: 4
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- GA4
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 79
  - `recordsUpserted`: 79
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- SEARCH_CONSOLE
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 60
  - `recordsUpserted`: 60
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- ADS
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 4
  - `recordsUpserted`: 4
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- GA4
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 79
  - `recordsUpserted`: 79
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- SEARCH_CONSOLE
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 60
  - `recordsUpserted`: 60
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- ADS
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 4
  - `recordsUpserted`: 4
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- GA4
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 78
  - `recordsUpserted`: 78
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- SEARCH_CONSOLE
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 60
  - `recordsUpserted`: 60
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- ADS
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 4
  - `recordsUpserted`: 4
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- GA4
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 78
  - `recordsUpserted`: 78
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- SEARCH_CONSOLE
  - `jobType`: incremental_sync
  - `status`: failed
  - `recordsFetched`: 0
  - `recordsUpserted`: 0
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- ADS
  - `jobType`: incremental_sync
  - `status`: failed
  - `recordsFetched`: 0
  - `recordsUpserted`: 0
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- GA4
  - `jobType`: incremental_sync
  - `status`: failed
  - `recordsFetched`: 0
  - `recordsUpserted`: 0
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- SEARCH_CONSOLE
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 60
  - `recordsUpserted`: 60
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- ADS
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 4
  - `recordsUpserted`: 4
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- GA4
  - `jobType`: incremental_sync
  - `status`: success
  - `recordsFetched`: 77
  - `recordsUpserted`: 77
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- SEARCH_CONSOLE
  - `jobType`: initial_sync
  - `status`: success
  - `recordsFetched`: 2005
  - `recordsUpserted`: 2005
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- GA4
  - `jobType`: initial_sync
  - `status`: success
  - `recordsFetched`: 874
  - `recordsUpserted`: 874
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

## Latest Successful Sync Snapshot

- SEARCH_CONSOLE
  - `jobType`: incremental_sync
  - `recordsFetched`: 60
  - `recordsUpserted`: 60
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- ADS
  - `jobType`: incremental_sync
  - `recordsFetched`: 4
  - `recordsUpserted`: 4
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

- GA4
  - `jobType`: incremental_sync
  - `recordsFetched`: 79
  - `recordsUpserted`: 79
  - `startedAt`: 2026-04-29
  - `finishedAt`: 2026-04-29

## GA4 Highlights

- **Display** muestra el mayor volumen visible en la muestra. La señal es clara: hay tráfico y engagement, pero todavía falta madurez de conversión para traducir ese interés en negocio con precisión.
- GA4 hoy sirve para entender qué canal trae volumen y dónde se generan señales de interés, pero la lectura ejecutiva todavía depende de cerrar mejor el funnel y la medición.



Top reporting rows:
- 2026-04-07 | Display | Montevideo Canelones Maldonado | sessions=711 users=605 revenue=0.00 orders=0 cost=0.00 keyEvents=0 ga4PurchaseProxy=0
- 2026-04-11 | Display | Montevideo Canelones Maldonado | sessions=606 users=520 revenue=0.00 orders=0 cost=0.00 keyEvents=0 ga4PurchaseProxy=0
- 2026-04-20 | Display | Montevideo Canelones Maldonado | sessions=575 users=503 revenue=0.00 orders=0 cost=0.00 keyEvents=0 ga4PurchaseProxy=0
- 2026-04-06 | Display | Montevideo Canelones Maldonado | sessions=529 users=461 revenue=0.00 orders=0 cost=0.00 keyEvents=0 ga4PurchaseProxy=0
- 2026-04-17 | Display | Montevideo Canelones Maldonado | sessions=528 users=437 revenue=0.00 orders=0 cost=0.00 keyEvents=0 ga4PurchaseProxy=0

## Ads Highlights

Latest persisted rows show:
- campaign-level daily metrics
- cost and click signal present
- conversions remain low or zero while measurement matures

- **10566079907** concentra el mayor volumen visible: 1048 clicks, 13215 impresiones y costo 8.88. Ads sirve hoy para entender adquisición, aunque todavía no para cerrar performance financiero.
- La segunda señal visible confirma el mismo patrón: tráfico y gasto están presentes, pero la conversión aún no permite decidir con confianza si el presupuesto está siendo rentable.
- Mientras las conversiones no estén maduras, Ads debe leerse como mapa de adquisición y no como juicio final de rentabilidad.

- 2026-04-29 | campaign `10566079907` | clicks=1048 impressions=13215 cost=8.88 conversions=0 conversionValue=0.00 hasConversionData=no
- 2026-04-29 | campaign `20186259998` | clicks=1 impressions=1 cost=0.01 conversions=0 conversionValue=0.00 hasConversionData=no

## Search Console Highlights

Latest persisted rows show:
- query/page-level signal
- impressions, clicks, CTR and position persisted

Brand positioning readout:
- La marca todavía no aparece con suficiente peso propio; falta reforzar posicionamiento de marca en búsquedas directas.

High-demand landing opportunities:
- **persianas de enrollar**: 16 impresiones, CTR 0.0%, posición 5.3. hay demanda real pero todavía no se captura clics. Crear o reforzar https://urucortinas.com.uy/productos/cortinas-de-enrollar.html porque está cerca de competir en la primera página.
- **persianas de pvc**: 14 impresiones, CTR 0.0%, posición 11.1. hay demanda real pero todavía no se captura clics. Crear o reforzar https://urucortinas.com.uy/productos/cortinas-de-enrollar.html porque está cerca de competir en la primera página.
- **cortinas de enrollar pvc**: 13 impresiones, CTR 0.0%, posición 11.1. hay demanda real pero todavía no se captura clics. Crear o reforzar https://urucortinas.com.uy/productos/cortinas-de-enrollar-pvc.html porque está cerca de competir en la primera página.
- **precios persianas pvc**: 6 impresiones, CTR 0.0%, posición 6.0. hay demanda real pero todavía no se captura clics. Crear o reforzar https://urucortinas.com.uy/productos/cortinas-de-enrollar.html porque está cerca de competir en la primera página.
- **persianas**: 5 impresiones, CTR 0.0%, posición 11.6. hay demanda real pero todavía no se captura clics. Crear o reforzar https://urucortinas.com.uy/productos/cortinas-de-enrollar.html porque está cerca de competir en la primera página.

- 2026-04-29 | `persianas de enrollar` -> https://urucortinas.com.uy/productos/cortinas-de-enrollar.html | clicks=0 impressions=16 ctr=0.00 position=5.31
- 2026-04-29 | `persianas de pvc` -> https://urucortinas.com.uy/productos/cortinas-de-enrollar.html | clicks=0 impressions=14 ctr=0.00 position=11.07
- 2026-04-29 | `cortinas de enrollar pvc` -> https://urucortinas.com.uy/productos/cortinas-de-enrollar-pvc.html | clicks=0 impressions=13 ctr=0.00 position=11.08
- 2026-04-29 | `precios persianas pvc` -> https://urucortinas.com.uy/productos/cortinas-de-enrollar.html | clicks=0 impressions=6 ctr=0.00 position=6.00
- 2026-04-29 | `persianas` -> https://urucortinas.com.uy/productos/cortinas-de-enrollar.html | clicks=0 impressions=5 ctr=0.00 position=11.60

## Quality Classification

  - **GA4: buena**
  - GA4 con volumen suficiente para análisis

  - **Google Ads: regular**
  - sync exitoso con señal de conversiones todavía no confiable

  - **Search Console: buena**
  - query/page signal rica y estable

- **Overall: regular**
  - Las tres fuentes están activas, pero Ads todavía requiere madurez de medición.

## Base Questions

### Qué está funcionando
- GA4 sigue mostrando volumen y engagement suficientes para analizar comportamiento real.
- Search Console ya confirma demanda clara de mercado: hay búsquedas de marca e intención alta.
- Ads ya trae tráfico, costo y volumen de campañas, así que sirve para entender adquisición aunque todavía no cierre performance financiero.

### Qué está fallando
- Ads todavía no tiene conversiones confiables, así que no conviene declarar rentabilidad o pérdida confirmada.
- La conversión en GA4 sigue siendo muy baja frente al volumen de tráfico, por lo que la medición final todavía no está madura.
- Hay búsquedas con impresiones altas y CTR bajo: el sitio está recibiendo demanda, pero no siempre la está capturando.

### Dónde se pierde dinero
- No se puede afirmar desperdicio confirmado en Ads hasta validar conversiones.
- Las keywords no-brand con costo y sin señal de conversión siguen siendo la zona de mayor riesgo.
- Si la conversión del sitio está subcontada, el ROAS real sigue invisible y cualquier evaluación financiera queda incompleta.

### Dónde hay oportunidades
- Crear páginas propias para términos con demanda real como persianas de enrollar, cortinas de enrollar PVC y persianas de PVC.
- En cada página incluir qué es el producto, para qué sirve, variantes, beneficios, fotos reales, preguntas frecuentes y un botón visible de WhatsApp.
- Fortalecer posicionamiento de marca para capturar mejor búsquedas directas y diferenciarse de la demanda genérica.

### Qué acciones tomar ahora
- Cerrar la medición de conversiones en el sitio nuevo y en Ads.
- Priorizar SEO sobre consultas de impresiones altas y CTR bajo, creando landings propias donde hoy la demanda no está bien capturada.
- Mantener Ads útil hoy para adquisición y análisis de tráfico mientras maduran las conversiones.

## Fix Applied

Backend sync was executed through standard application services, not through the UI. Conversion tracking was instrumented in the frontend and the Ads measurement gate remains explicit so conclusions about performance are not overstated while conversions are not fully configured.

## Overall Result

- Overall synchronization quality: **Regular**
- GA4 and Search Console are producing operationally useful data.
- Ads sync is successful and usable now, but still remains regular until conversion measurement matures.
