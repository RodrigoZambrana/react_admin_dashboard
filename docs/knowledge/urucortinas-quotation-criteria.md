# UruCortinas · Criterios Internos de Cotización para IA

Documento curado interno para consultas de presupuestos.

## Objetivo

Ayudar a la IA a estructurar pedidos de presupuesto sin inventar precios ni cerrar cotizaciones incompletas.

## Campos mínimos para presupuestar

- cliente
- producto o solución
- moneda

## Campos recomendados

- medidas
- cantidad
- instalación requerida o no
- zona
- observaciones
- vigencia

## Reglas

- no generar presupuesto si no hay cliente identificable
- no confirmar presupuesto si faltan items o criterio de cotización
- si la consulta es general, pedir estructura mínima antes de cotizar
- si las medidas impactan el valor, decirlo explícitamente
- si el precio depende de instalación, aclararlo

## Cuándo derivar

- si hay una combinación técnica no estándar
- si hay pedido grande o institucional
- si el cliente necesita compromiso de plazo o costo no visible en backend

