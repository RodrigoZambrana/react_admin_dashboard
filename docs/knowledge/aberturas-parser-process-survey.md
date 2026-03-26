# Aberturas · Parser Process Survey

Resumen interno consolidado del proceso de parseo de `aberturas`, procesado a partir de:

- reglas ETL externas relevadas
- parser Python previo
- proyecto consolidado tipo enterprise
- contrato vivo implementado en este repo

Este documento existe para evitar dependencia operativa de rutas externas y dejar las reglas clave entendibles dentro del proyecto.

## Objetivo

Procesar mensajes de WhatsApp, texto libre y PDFs para convertirlos en:

- registros normalizados
- payloads listos para alta
- borradores listos para cotización

sin contaminación entre productos y con trazabilidad suficiente para revisión humana.

## Pipeline de referencia

1. Ingesta
- texto libre
- export de WhatsApp
- PDF

2. Limpieza
- lowercase controlado
- espacios normalizados
- remoción de prefijos conversacionales
- descarte de ruido conversacional

3. Segmentación
- dividir por `;`, `|`, `//`
- dividir por reaparición de keywords de aberturas
- objetivo: una abertura por línea/variante

4. Extracción
- familia
- serie
- color
- vidrio
- ancho y alto
- precio
- features

5. Enriquecimiento
- defaults controlados
- herencia contextual mínima
- snapshot/detalle

6. Validación
- score de confianza
- warnings
- compatibilidades
- faltantes críticos

7. Salida
- parseo estructurado
- insert-ready payload
- quote draft

## Reglas clave incorporadas

### Anti-contaminación

- nunca mezclar atributos entre líneas separadas
- nunca heredar precio o medidas
- solo permitir herencia de contexto en campos blandos y con continuidad clara:
  - serie
  - familia
  - color
  - vidrio
  - shutter system

### Medidas

- todo se lleva a mm
- `1.10 x 1.20` => `1100 x 1200`
- `0,80 x 2,00` => `800 x 2000`
- `160 x 120` puede interpretarse como `1600 x 1200` en dominio de aberturas
- conjuntos como `1.00 + 0.90 x 2.20` pueden derivar en ancho compuesto

### Serie / familia / color / vidrio

Normalizaciones relevantes:

- `probba` => `PROBBA`
- `gala cr` => `GALA`
- `corr`, `corrediza` => `VENTANA_CORREDIZA`
- `paño fijo`, `pano fijo`, `vidrio fijo` => `PANO_FIJO`
- `bco`, `bca`, `blanco` => `BLANCO`
- `dvh 4/9/5` => `DVH 4/9/5`
- `v/4mm` => `4 MM`

### Features

- mosquitero:
  - `mosq`
  - `c/mosq`
  - `con mosquitero`
- monoblock:
  - `monoblock`
  - `cortina`
  - `tambor`
- extras a preservar en snapshot:
  - `fenix`
  - `sirius`
  - `reja`
  - `motor`
  - `control`
  - `falleba`
  - `umbral`
  - `cierre`

## Validación y score

Score operativo base por línea:

- `+1` medida
- `+1` precio
- `+1` tipo/familia
- `+1` serie

Si el score es menor a `3`, no debe procesarse automáticamente para alta.

Warnings relevantes:

- `missing_family`
- `missing_serie`
- `missing_price`
- `missing_currency`
- `suspicious_dimension`
- `dvh_incompatible`
- `price_estimated`
- `requires_manual_review`

## Compatibilidades relevantes

- series `20` y `25`: no admiten DVH
- series `30`, `PROBBA`, `GALA`, `SUMMA`: sí admiten DVH

Si aparece una combinación incompatible:

- conservar lo detectado
- marcar warning
- no confirmar alta/cotización exacta

## Precio estimado vs precio confirmado

Los relevamientos externos contemplan estimación de precio por superficie.

En este repo la regla operativa consolidada es:

- estimación puede servir como señal interna en análisis o cotización asistida
- no habilita alta automática
- no debe presentarse como precio confirmado

## Alta vs cotización

### Alta al sistema

- no cotizar automáticamente
- si el texto trae precio explícito, conservarlo
- si falta precio o moneda, pedirlo
- solo generar `insertPayload` para líneas válidas

### Cotización

- puede usar pricing paramétrico real
- puede devolver match exacto o coincidencia cercana
- debe distinguir claramente lo listo de lo que sigue en revisión

## Contrato de salida recomendado

Campos mínimos de negocio:

- `family_id`
- `serie`
- `material`
- `color`
- `vidrio`
- `width_mm`
- `height_mm`
- `has_mosquitero`
- `has_shutter_monoblock`
- `shutter_system`
- `price`
- `currency`
- `detalle_snapshot`
- `reference_date`
- `confidence_score`

Campos de auditoría:

- `source_type`
- `source_name`
- `source_text`
- `inferred_fields`
- `warnings`
- `missingFields`
- `doubtfulFields`
- `validForInsert`
- `insertPayload`

## Implicancia para este sistema

El documento maestro [aberturas-admin-internal-master-prompt.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/knowledge/aberturas-admin-internal-master-prompt.md) es el contrato operativo consolidado para el agente.

Si hay diferencia entre este survey y el comportamiento implementado:

1. manda el código vivo
2. luego debe actualizarse el documento maestro
3. y después este survey, si corresponde
