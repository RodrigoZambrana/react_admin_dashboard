# SEO + Analytics Consolidated Brief

Fecha: 2026-04-29

Este documento consolida tres fuentes que deben leerse juntas:

- [Informe SEO data-driven](/Users/rodrigo/Git/personal/react_admin_dashboard/outputs/seo-data-driven-report/seo-data-driven-report.md)
- [Informe SEO data-driven JSON](/Users/rodrigo/Git/personal/react_admin_dashboard/outputs/seo-data-driven-report/seo-data-driven-report.json)
- [Comparación de baseline local vs sync automático](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/analytics-ai-comparison.md)

Objetivo operativo:

- convertir señales de Search Console, Ads, GA4 y calidad de datos en backlog accionable;
- mantener explícita la diferencia entre performance real y medición no validada;
- evitar duplicar análisis manuales cuando ya existe un reporte reproducible.

## Resumen ejecutivo

La demanda orgánica está concentrada en familias claras de producto: `persianas de enrollar`, `persianas de pvc`, `persianas` y `cortinas de enrollar pvc`. La marca está defendida: `urucortinas` tiene posición media `1.03` y CTR `33.77%`, así que no hay una señal fuerte de marca débil. El problema principal es de cobertura semántica, estructura del sitio y alineación entre intención de búsqueda y landings.

Ads concentra gasto en términos con intención clara, pero las conversiones exportadas siguen en cero. Eso no debe interpretarse como pérdida confirmada: el sistema marca esa señal como `measurement_issue` o `low_confidence_signal` hasta validar el tracking. GA4 todavía muestra un mix con peso fuerte de pago, especialmente `Display`, `Paid Video` y `Paid Search`, mientras que Semrush local expone competencia visible como `sodimac.com.uy`, `bork.com.uy` y `cortiluz.com.uy`.

La conclusión operativa es simple: hay oportunidad real en SEO, pero antes de mover presupuesto o asumir pérdida de negocio hay que resolver la lectura de medición en Ads.

## Fuentes y confianza

| Fuente | Estado | Confianza | Uso correcto |
| --- | --- | ---: | --- |
| GA4 | ok | 90% | Mix de canales, volumen histórico y señales de comportamiento. |
| Search Console | ok | 95% | Queries, clics, impresiones, CTR y posición por página/consulta. |
| Google Ads | warning | 70% | Coste y cobertura, pero no conversiones confirmadas sin validación de tracking. |
| Semrush | reference | 55% | Contexto competitivo y semántico, no verdad operativa. |
| Sync normalizado backend | parcial | alto para GA4, bajo para Ads/GSC | Fuente operativa, pero incompleta para Ads y Search Console persistidos. |

## Señales clave por dominio

### SEO orgánico

- `urucortinas` está defendida y no muestra debilidad de marca.
- `cortinas de enrollar` es la mayor oportunidad orgánica de la muestra.
- `persianas de enrollar` y `persianas de pvc` tienen volumen suficiente para justificar una landing dedicada o una mejora estructural fuerte.
- `cortinas de enrollar pvc` tiene espacio claro para subir CTR con una pieza más semántica.

### Paid synergy

- Hay gasto significativo en `cortinas`, `cortinas de enrollar`, `cerramientos de aluminio`, `reparacion de cortinas`, `aberturas de aluminio` y `cortinas roller`.
- Las conversiones exportadas aparecen en cero, por lo que no corresponde concluir desperdicio confirmado.
- La decisión correcta es separar cobertura pagada de medición y usar SEO para capturar la intención genérica más cara.

### Content gap

- Falta una landing de familia para `persianas`.
- `cortinas de enrollar` necesita mejor alineación entre query, título, meta y bloque inicial.
- `cortinas de enrollar pvc` necesita foco comercial propio.
- `dvh` tiene impresiones pero CTR muy bajo, lo que sugiere una pieza débil o mal posicionada semánticamente.

### Technical / structure

- La arquitectura debería reflejar familias de producto:
  - Cortinas de enrollar
  - Persianas
  - Aberturas
  - Toldos y cerramientos
  - Reparación y mantenimiento
- La home debe funcionar como hub, no solo como portada.
- Falta interlinking por intención y por familia.
- Faltan módulos de comparación y FAQ donde el usuario ya está comparando precio, material, instalación y mantenimiento.

### CRO

- Las landings con más impresiones necesitan un primer bloque visible más explícito.
- Reparación debe responder urgencia, cobertura, tiempos y CTA directo.
- Las páginas de producto necesitan ayudar a decidir, no solo describir.

## Hallazgos prioritarios

| Prioridad | Activo | Evidencia | Acción recomendada | Impacto | Esfuerzo |
| --- | --- | --- | --- | --- | --- |
| 1 | `/productos/cortinas-de-enrollar.html` | `27,776` impresiones, CTR `1.63%`, posición `10.92` | Reescribir title, meta, H1, bloque above-the-fold, FAQ y comparativas | Alto | Bajo |
| 2 | `/productos/persianas-de-enrollar.html` | Query `persianas` `1,527` impresiones; `persianas de pvc` `1,889` impresiones | Crear o consolidar landing de familia para persianas | Alto | Medio |
| 3 | `/productos/cortinas-de-enrollar-pvc.html` | `8,120` impresiones, CTR `0.97%`, posición `13.73` | Reescribir como landing comercial de PVC con comparativa y precios | Alto | Medio |
| 4 | `/servicios/reparacion-cortinas-y-persianas.html` | `6,133` impresiones, CTR `1.57%` | Convertirla en landing de servicio urgente con CTA claro | Alto | Bajo |
| 5 | Home / navegación | Mix orgánico y tracción de home | Reordenar la navegación para reflejar familias de intención | Alto | Bajo |
| 6 | `/productos/aberturas-aluminio.html` | `7,479` impresiones, CTR `3.08%`, posición `6.55` | Mejorar contenido y conectar con comparativas, medidas y terminaciones | Medio-Alto | Medio |
| 7 | `/articulos/dvh.html` | `3,319` impresiones, CTR `0.33%` | Reescribir para capturar mejor la intención de decisión | Medio | Medio |
| 8 | `/productos/toldos-y-cerramientos.html` | `3,751` impresiones, CTR `3.68%` | Ordenar por casos de uso y FAQs | Medio | Medio |

## Backlog accionable

### SEO orgánico

1. Actualizar title y meta description de `/productos/cortinas-de-enrollar.html`.
2. Ajustar el contenido above-the-fold de `/productos/cortinas-de-enrollar.html` para que responda precio, material, uso e instalación.
3. Crear o consolidar `/productos/persianas-de-enrollar.html` como landing de familia.
4. Reescribir `/productos/cortinas-de-enrollar-pvc.html` con comparativa PVC vs aluminio.
5. Optimizar `/productos/aberturas-aluminio.html` para captar más clics sin perder posición.

### Paid synergy

1. Mantener en Ads las consultas de marca y defensa competitiva mientras dure la señal de marca fuerte.
2. Migrar a SEO los términos genéricos de producto que hoy dependen de pago.
3. No cerrar conclusiones de ROAS o pérdida de negocio mientras conversiones exportadas sigan en cero sin validación de tracking.

### Content gap

1. Crear páginas por material y uso cuando haya soporte en intención:
   - PVC
   - aluminio
   - black out
   - exterior
   - sin albañilería
2. Crear páginas por decisión:
   - precios
   - medidas
   - comparativas
   - instalación
   - mantenimiento
3. Crear o reforzar páginas de servicio inmediato:
   - reparación
   - urgencias
   - cobertura geográfica

### Technical / structure

1. Reorganizar la navegación principal por familias de producto.
2. Añadir interlinking entre landings, FAQs, servicios y páginas vecinas.
3. Agregar módulos de comparación y preguntas frecuentes.

### CRO

1. Hacer que cada landing principal responda en el primer pliegue qué es, para quién sirve y por qué elegirla.
2. Convertir reparación en una entrada de respuesta rápida, no en una página genérica.
3. Usar FAQ schema donde ya existen dudas repetidas sobre precios, medidas, instalación y materiales.

## Recomendaciones por URL

| URL | Qué mejorar | Qué incluir | Resultado esperado |
| --- | --- | --- | --- |
| `/productos/cortinas-de-enrollar.html` | On-page y bloque principal | Tipos, usos, materiales, precios, medidas, instalación, mantenimiento y comparativas | Mejor CTR orgánico |
| `/productos/persianas-de-enrollar.html` | Crear o convertir en hub de familia | Persiana, persianas de enrollar, PVC, aluminio, automatización, FAQ | Captura de intención genérica |
| `/productos/cortinas-de-enrollar-pvc.html` | Enfoque comercial semántico | Beneficios del PVC, comparativa con aluminio, casos de uso, precios | Mejor CTR y mejor destino de Ads |
| `/servicios/reparacion-cortinas-y-persianas.html` | Servicio urgente | Falla típica, cobertura, tiempos, disponibilidad, CTA | Más leads de servicio |
| `/productos/aberturas-aluminio.html` | Refuerzo transaccional | Tipos de abertura, medidas, terminaciones, precios, FAQ | Más cobertura de alto valor |
| `/articulos/dvh.html` | Relevancia de decisión | Uso, ventajas, relación con aberturas y cierre a producto/servicio | Mejor respuesta a la query |
| `/productos/toldos-y-cerramientos.html` | Estructura y navegación | Materiales, aplicaciones, exteriores, instalación, mantenimiento | Mejor relevancia semántica |

## Sinergia SEO + Ads

### Mantener en Ads por ahora

- `urucortinas`
- `uru cortinas`
- `bork cortinas`
- `cortifast`
- `gala`

### Migrar a SEO

- `cortinas de enrollar`
- `cortinas roller`
- `cortifast`
- `bork cortinas`
- `cortinas roller black out`
- `urucortinas`

### Nota de medición

Las conversiones exportadas aparecen en cero. Hasta validar tracking, esa señal debe leerse como `measurement_issue` o `low_confidence_signal`, no como desperdicio confirmado.

## Comparación con el baseline local

El baseline local de Search Console sí trae consultas, páginas, países y dispositivos. La capa normalizada actual del backend sigue incompleta para Ads y Search Console persistidos, aunque sí es útil para GA4 y trazabilidad general.

Implicaciones:

- el baseline local sirve como referencia histórica;
- la base normalizada del backend es la verdad operativa;
- cuando ambas divergen, la decisión debe ser conservadora con conversiones y ROAS;
- Search Console local sigue siendo la mejor señal para priorización SEO mientras la persistencia normalizada no se complete.

## Calidad de datos

- GA4: buena para lectura de mix y comportamiento.
- Search Console: muy buena para priorización SEO.
- Google Ads: utilizable para gasto, cobertura y CTR, pero no para conclusiones de conversiones hasta validar medición.
- Semrush: solo referencia competitiva.

## Siguiente acción

Ejecutar el backlog en este orden:

1. `/productos/cortinas-de-enrollar.html`
2. `/productos/persianas-de-enrollar.html`
3. `/productos/cortinas-de-enrollar-pvc.html`
4. `/servicios/reparacion-cortinas-y-persianas.html`
5. Validación de tracking de Ads antes de tocar presupuesto

## Referencias conservadas

Los documentos originales siguen disponibles y no fueron reemplazados:

- [docs/seo-data-driven-report.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/seo-data-driven-report.md)
- [outputs/seo-data-driven-report/seo-data-driven-report.md](/Users/rodrigo/Git/personal/react_admin_dashboard/outputs/seo-data-driven-report/seo-data-driven-report.md)
- [outputs/seo-data-driven-report/seo-data-driven-report.json](/Users/rodrigo/Git/personal/react_admin_dashboard/outputs/seo-data-driven-report/seo-data-driven-report.json)
- [docs/analytics-ai-comparison.md](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/analytics-ai-comparison.md)

