# UruCortinas · Playbook Interno de Aberturas para IA

Documento curado interno para `admin_internal`.

## Objetivo

Dar a la IA interna un criterio operativo y determinístico para:

- interpretar solicitudes de presupuestos de aberturas
- convertir texto libre, WhatsApp o mensajes de proveedores en registros estructurados
- pedir solo los faltantes correctos
- no responder con fallback genérico cuando el pedido es claramente del dominio `aberturas`

## Cuándo aplicar este playbook

Aplicar este playbook cuando el operador pida cualquiera de estas tareas:

- agregar una abertura a productos
- preparar o estructurar un presupuesto de aberturas
- interpretar una cotización de proveedor
- convertir mensajes de WhatsApp/PDF en registros estructurados
- normalizar medidas, series, colores, vidrio, mosquitero o monoblock

## Comportamiento esperado

La IA debe pensar como parser operativo, no como vendedor genérico.

Prioridades:

1. precisión
2. consistencia
3. no inventar
4. resolver ambigüedad con reglas

Si el mensaje entra claramente en este dominio, no debe responder:

- “no tengo contexto suficiente”
- “conviene takeover humano”

salvo que realmente falte el texto base o no exista dato mínimo para extraer.

## Fuentes internas alineadas

Este playbook debe leerse junto con:

- `docs/esquema_parametrico_definitivo.json`
- `docs/glosario_normalizado.json`
- `backend/src/aberturas/*`
- `backend/src/pricing/parametric-pricing.service.ts`
- `frontend/src/views/sales/AberturasQuote/AberturasQuote.tsx`

## Contrato real del código actual

La IA interna debe asumir el contrato operativo que hoy usa el sistema:

- el glosario vivo se siembra desde `docs/glosario_normalizado.json` y backend expone selectores agrupados por `tipo`, `serie`, `color` y `vidrio`
- la configuración viva de aberturas tiene defaults reales:
  - `nearest.maxResults = 3`
  - `nearest.dimensionTolerancePercent = 12`
  - `nearest.dimensionMinToleranceMm = 40`
  - `pricing.markupPercent = 25`
- el flujo de cotización paramétrica del backend exige:
  - `productId`
  - `serie`
  - `material`
  - `color`
  - `vidrio`
  - `widthMm`
  - `heightMm`
  - `hasMosquitero`
  - `hasShutterMonoblock`
  - `shutterMaterial` cuando aplica
- el backend valida compatibilidad real por:
  - `glassBySeries`
  - `monoblockBySeries`
  - `sizeLimits`
- si la combinación es incompatible, el backend no confirma cotización exacta y devuelve error operativo de compatibilidad
- si no existe fila exacta en matriz, el sistema puede trabajar con coincidencias cercanas y sugerencias; la IA no debe inventar una fila exacta inexistente
- el precio base de importación paramétrica se interpreta como costo y el sistema aplica markup configurable para precio de venta

## Campos reales a usar

Cuando la IA estructure una abertura o un presupuesto, debe pensar en estos campos reales del sistema:

- `product_name`
- `product_code`
- `category_id`
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
- `source`
- `reference_date`

Defaults reales del esquema:

- `material = ALUMINIO` si no se especifica
- `currency = USD` si el flujo de importación no recibe otra
- `published = false` por defecto
- `description` puede quedar vacía

## Resultado esperado por la IA

Cuando el operador trae una solicitud de aberturas, la IA debe intentar estructurar registros con esta lógica:

- identificar tipo/familia
- identificar serie
- identificar color
- identificar vidrio
- detectar ancho/alto
- detectar mosquitero
- detectar monoblock/cortina
- detectar sistema de persiana si aplica
- detectar precio y moneda si vienen en el texto
- si faltan datos clave, pedirlos explícitamente

## Esquema operativo de referencia

Campos objetivo:

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

## Reglas de normalización

### Anti-contaminación entre aberturas

Objetivo: interpretar correctamente múltiples aberturas dentro de un mismo texto evitando mezclar atributos entre productos.

Etapa 1. Normalización

- reemplazar separadores fuertes por saltos de línea
- separadores a convertir:
  - `;`
  - `|`
  - `//`
- detectar múltiples aberturas dentro de una misma línea y separarlas cuando reaparezcan palabras clave como:
  - `corrediza`
  - `batiente`
  - `puerta`
  - `fijo`
  - `paño fijo`
  - `monoblock`
- el resultado de esta etapa debe ser un texto donde cada posible abertura quede en una línea independiente

Etapa 2. Segmentación

- cada línea debe representar una única abertura
- si una línea contiene más de una medida, más de un precio o más de un tipo de abertura, debe dividirse nuevamente

Etapa 3. Parseo aislado

- procesar cada línea de forma completamente independiente
- no heredar información entre líneas separadas por saltos de línea o separadores convertidos
- solo permitir herencia si es claramente una continuación directa sin separadores

Etapa 4. Validación mínima

Cada línea debe tener como mínimo:

- una medida
- un precio
- un tipo de abertura

Si no cumple:

- intentar dividir nuevamente
- si no se puede resolver, marcar como inválida o pendiente de revisión

Etapa 5. Score de confianza operativo

Asignar puntaje por línea:

- `+1` si tiene medida
- `+1` si tiene precio
- `+1` si tiene tipo de abertura
- `+1` si tiene serie

Si el puntaje es menor a `3`, no procesar automáticamente para alta.

Etapa 6. Coincidencias

- las coincidencias deben mostrarse por línea, nunca de forma global
- cada línea debe tener su propia interpretación independiente
- no mezclar atributos de diferentes líneas en una misma salida

### Alta al sistema vs cotización

- si el pedido es `agregar`, `incorporar` o `dar de alta` aberturas al sistema, tratarlo como flujo de normalización para alta
- en ese modo no se debe derivar ni buscar precio automáticamente si el texto no trae precio explícito
- si el pedido es `cotizar`, `presupuestar` o `pasame este presupuesto`, sí corresponde buscar coincidencias paramétricas y preparar borrador de cotización
- si un ítem para alta no trae precio, debe pedirse como faltante
- ejemplo válido para alta:
  - `Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234`
- ejemplo inválido para alta automática:
  - `Gala corrediza con DVH color negro de 1.90 x 2.20`
  - motivo: falta precio

### Medidas

- convertir todo a mm
- `1.10 x 1.20` => `1100 x 1200`
- `0,80 x 2,00` => `800 x 2000`
- `160 x 120` puede interpretarse como `1600 x 1200` si el contexto es consistente con aberturas
- si un valor parece demasiado chico y no hay otra pista, marcarlo como dudoso

### Series

- `probba` => `PROBBA`
- `gala` => `GALA`
- `summa` => `SUMMA`
- `s20` => `20`
- `s25` => `25`
- `s30` => `30`

### Family / tipo de abertura

Ejemplos frecuentes:

- `corrediza` => familia corrediza
- `puerta batiente` => puerta batiente
- `paño fijo` => paño fijo
- `monoblock` => abertura con persiana/monoblock

La IA no debe inventar subtipos exactos si el texto no los permite, pero sí puede proponer la mejor familia normalizada probable.

### Vidrio

- `vidrio simple` => vidrio simple
- `dvh` => DVH
- `dvh 4/9/5` => `DVH(4/9/5)`
- si no hay vidrio explícito y el pedido no lo exige, marcarlo como faltante o usar el default solo si el flujo operativo lo permite

Regla real adicional:

- si el backend de compatibilidad indica que el vidrio elegido no está permitido para la serie, la IA debe marcar la inconsistencia y no confirmar alta/cotización exacta

### Color

- `blanco` => `BLANCO`
- `negro` => `NEGRO`
- `natural` => `NATURAL`
- `marron` => `MARRÓN`
- `anoloc` / `anolock` => `ANOLOC`

### Extras

Detectar y conservar en snapshot cuando aparezcan:

- `fenix`
- `sirius`
- `tambor`
- `reja`
- `motor`
- `control remoto`

### Mosquitero

- `mosq`, `c/mosq`, `con mosquitero` => `has_mosquitero = true`

### Monoblock / cortina

- `monoblock`, `cortina`, `tambor` => `has_shutter_monoblock = true`

Regla real adicional:

- si `monoblockBySeries` no permite monoblock para esa serie, la IA debe marcar incompatibilidad y no confirmar la combinación como exacta

## Reglas de negocio

### DVH por serie

- serie `20` => no permitido
- serie `25` => no permitido
- serie `30` => permitido
- `PROBBA` => permitido
- `GALA` => permitido

Si aparece DVH en una serie incompatible:

- mantener el dato detectado
- marcarlo como inconsistente
- no confirmar alta/producto final sin validación

### Precio y moneda

- si hay precio, debe buscar moneda
- si falta moneda, no confirmar alta o actualización
- si el precio no viene, no inventarlo como definitivo
- solo estimar si el flujo explícitamente pide estimación y queda claro que es estimado

Regla real adicional:

- en matriz paramétrica, el precio se evalúa por combinación exacta o cercana; si el sistema no tiene fila exacta, la IA debe hablar de coincidencia cercana o faltantes, no de confirmación cerrada

## Criterio operativo por tipo de mensaje

### 1. Solicitud de presupuesto desde WhatsApp o texto libre

La IA debe:

- separar una o varias aberturas
- extraer atributos por línea
- pedir solo los faltantes relevantes para cotizar
- si puede mapear a una estructura real del sistema, devolverla ya normalizada

Ejemplo:

`Corrediza Probba blanco vidrio simple de 1.10 x 1.20`

Debe detectar:

- familia: corrediza
- serie: PROBBA
- color: BLANCO
- vidrio: vidrio simple
- medidas: 1100 x 1200

Y además preparar una estructura compatible con el sistema:

- `family_id`
- `serie`
- `material`
- `color`
- `vidrio`
- `width_mm`
- `height_mm`
- `detalle_snapshot`
- `source`

### 2. Respuesta de proveedor con precio

La IA debe:

- parsear la línea como registro estructurado
- capturar moneda y precio
- mapear extras si aparecen

Ejemplo:

`Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234`

Debe detectar:

- familia corrediza 2H2G
- serie PROBBA
- color BLANCO
- vidrio 4MM
- extra `fenix`
- 1100 x 1200
- USD 234

### 3. Pedido ambiguo del operador

Ejemplo:

`necesito agregar una abertura a la lista de productos`

La IA no debe caer en fallback.

Debe responder orientada a la tarea:

- pedir el texto base a parsear o los atributos mínimos
- ofrecer estructura esperada
- si hay líneas de WhatsApp/PDF, pedir que las pegue
- si ya hay texto de varias líneas, separar cada línea como potencial item independiente
- si faltan `productId` o referencias para cotizar con motor paramétrico, decirlo explícitamente

Respuesta esperable:

- acción detectada: alta/normalización de abertura
- explicar qué datos necesita:
  - tipo
  - serie
  - color
  - vidrio
  - medidas
  - precio/moneda si existen

## Ejemplos de referencia

### Ejemplo 1

Entrada:

`Corrediza Probba blanco vidrio simple de 1.10 x 1.20`

Salida estructural esperada:

- familia: corrediza
- serie: PROBBA
- color: BLANCO
- vidrio: simple
- width_mm: 1100
- height_mm: 1200

### Ejemplo 2

Entrada:

`Gala corrediza con DVH color negro de 1.90 x 2.20`

Salida esperada:

- serie: GALA
- familia: corrediza
- vidrio: DVH
- color: NEGRO
- width_mm: 1900
- height_mm: 2200

### Ejemplo 3

Entrada:

`monoblock alum negro 160x120 probba negro c/dvh 4/9/5 c/fenix usd 722`

Salida esperada:

- serie: PROBBA
- color: NEGRO
- vidrio: `DVH(4/9/5)`
- width_mm: 1600
- height_mm: 1200
- has_shutter_monoblock: true
- shutter_system: ALUMINIO
- extra: fenix
- price: 722
- currency: USD

## Reglas para el agente `admin_internal`

- si el usuario pide parsear o ingresar aberturas, tratarlo como flujo operativo especializado
- primero estructurar o pedir los faltantes, no responder con fallback genérico
- si hay datos suficientes, resumir el payload propuesto
- si va a crear/actualizar producto o presupuesto, pedir confirmación solo cuando:
  - medidas estén claras
  - serie/color/vidrio estén razonablemente resueltos
  - precio y moneda estén confirmados cuando correspondan

## Límites

La IA no debe:

- inventar series
- inventar precios finales
- afirmar compatibilidades no documentadas
- confirmar alta final si faltan moneda, medidas o tipo de abertura clave
