# Comparación de baseline local vs sync automático

Fecha de referencia:
- Baseline local descargado: `2026-04-28`
- Estado normalizado en backend: `2026-04-29`

## Qué existe en el baseline local

La carpeta histórica `/Users/rodrigo/Personal/Proyectos/urucortinas/analitycs` contiene:
- `Informe_panorámico.csv` con 6.296 filas no comentadas.
- Un export de Search Console con 7 archivos:
  - `Gráfico.csv` con 485 filas de serie temporal.
  - `Consultas.csv` con 1.000 filas.
  - `Páginas.csv` con 27 filas.
  - `Países.csv` con 144 filas.
  - `Dispositivos.csv` con 3 filas.
  - `Aparición en búsquedas.csv` con 1 fila.
  - `Filtros.csv`.

Señales destacadas del baseline local de Search Console:
- Query `urucortinas`: 208 clics, 616 impresiones, CTR 33.77%, posición 1.03.
- Query `persianas de enrollar`: 64 clics, 3.661 impresiones, CTR 1.75%, posición 8.32.
- Página `/productos/cortinas-de-enrollar.html`: 452 clics, 27.776 impresiones, CTR 1.63%, posición 10.92.
- El tráfico de Uruguay domina la muestra, con Estados Unidos y Argentina por detrás.

## Qué existe hoy en el sync automático

En la base normalizada actual del repo:
- `analytics_reporting_daily`: 698 filas.
- `analytics_ga4_daily_metrics`: 215 filas.
- `analytics_ads_daily_metrics`: 0 filas.
- `analytics_search_console_daily_metrics`: 0 filas.
- `analytics_connections`: 1 fila.
- `analytics_sync_runs`: 6 filas.
- `analytics_report_reconciliations`: 59 filas.
- `analytics_baseline_snapshots`: 0 filas.
- `analytics_data_quality_checks`: 0 filas.

Muestra del sync automático:
- Hay filas diarias de `analytics_reporting_daily` con sesiones y engagement.
- Todavía no hay cobertura persistida de Ads ni Search Console en las tablas normalizadas del sync automático.
- La reconciliación canónica ya está produciendo gaps y partials, por lo que la confianza del análisis debe bajar cuando la señal depende de esas áreas.

## Similitudes

- Ambos lados trabajan con métricas agregadas, no con raw events.
- Ambos permiten análisis temporal por día y por segmento.
- Ambos son útiles para detectar oportunidades SEO y señales de rendimiento por canal.

## Diferencias clave

- El baseline local de Search Console sí trae consultas, páginas, países y dispositivos.
- El sync automático todavía no pobló Search Console ni Ads en la capa normalizada.
- El baseline local sirve como referencia histórica y sanity check.
- El sync automático es la verdad operativa del sistema, pero hoy está incompleto para conclusiones fuertes de conversiones y ROAS.

## Qué significa para la IA de decisión

- No se debe marcar `conversiones = 0` como desperdicio confirmado si la medición no está validada.
- Si la medición no está lista, la IA debe clasificar el hallazgo como:
  - `measurement_issue`
  - `low_confidence_signal`
- Solo cuando el gate `conversion_measurement_ready = true` esté satisfecho la IA puede emitir conclusiones de negocio fuertes sobre conversiones y ROAS.
- La decisión final sale del modelo sobre un bundle semántico, no de la carpeta local ni de las reglas aisladas.

## Oportunidades inmediatas

- Poblar Search Console normalizado para activar oportunidades SEO de alto volumen y CTR bajo.
- Poblar Ads normalizado para separar costo real de problemas de medición.
- Usar el baseline local como referencia secundaria, no como fuente operativa.
- Mantener la priorización basada en:
  - impacto económico
  - variación temporal
  - calidad de datos
  - facilidad de acción

## Conclusión operativa

La IA ya puede responder qué está funcionando y qué está fallando en GA4 y en la capa de calidad, pero todavía debe ser conservadora con conversiones y ROAS hasta que la medición quede validada y las tablas de Ads/Search Console estén pobladas de forma consistente.
