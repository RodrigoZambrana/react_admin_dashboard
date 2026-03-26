# AI Safe Operations Survey

Estado relevado al 2026-03-26 para `admin_internal`.

## Operaciones generales ya cubiertas

- clientes:
  - buscar
  - crear
  - actualizar
- actividades:
  - buscar
  - crear
  - actualizar
  - eliminar
- productos:
  - buscar
  - crear
  - actualizar
  - archivar
  - publicar
  - ajustar stock
- categorías:
  - buscar
  - crear
  - actualizar
- pedidos:
  - buscar
  - crear
  - cambiar estado
  - actualizar comentario/nota
- presupuestos:
  - buscar
  - crear
  - enviar
  - confirmar
  - cambiar estado
  - actualizar comentario/nota
- pagos:
  - buscar
  - crear
  - cambiar estado
  - actualizar método / referencia / notas

## Operaciones particulares de UruCortinas ya cubiertas

- parseo determinístico de texto libre de `aberturas`
- grounding con playbooks internos y fuentes aprobadas
- orientación operativa para cotización/alta de aberturas

## Capacidades transversales que no deben quedar atadas a un solo tenant

- ABM documental de conocimiento aprobado para IA
  - upload
  - download
  - delete
  - recarga
  - clasificación por scope
- retrieval sobre fuentes aprobadas y trazables
- separación entre `customer_public` y roles internos

Esto ya existe como capacidad del sistema y `UruCortinas` es hoy el tenant más poblado, no el único caso conceptual.

## Criterio de seguridad actual

Todas las operaciones de escritura siguen este patrón:

- catálogo explícito de acciones
- confirmación obligatoria cuando hay impacto operativo
- prebúsqueda previa cuando la entidad es ambigua
- validación de campos faltantes o dudosos
- tools auditables por conversación
- auditoría resumida visible en inbox y detalle

## Operaciones generales ampliadas en este bloque

- catálogo semántico más explícito:
  - `products.publish`
  - `categories.update`
  - `orders.update_comment`
  - `quotes.update_comment`
  - `payments.update`
- prebúsqueda reforzada antes de updates:
  - categorías
  - pedidos
  - presupuestos
  - pagos
  - productos
- mejor cita de coincidencias:
  - cliente con email si existe
  - producto con moneda/precio si existe
  - pedido/presupuesto con UUID y cliente
  - pago con referencia y pedido relacionado

## Próximas ampliaciones generales recomendadas

Prioridad alta:

- notas/comentarios seguros sobre pedidos y presupuestos
- reasignación de categoría de productos con búsqueda previa de categoría
- ajustes de stock con motivo opcional y trazabilidad
- agregar o quitar items en pedidos y presupuestos existentes
- edición segura de shipping / entrega / vigencia
- cancelación segura de pagos tipo refund con reglas más estrictas

Prioridad media:

- gestión segura de costos/listas de precio
- actualización de datos de envío de pedidos
- agregar o quitar ítems en presupuestos/pedidos existentes
- refund/cancelación de pagos con reglas más estrictas

No priorizar como objetivo IA:

- creación de nuevas matrices paramétricas
- CRUD de glosario como operativa principal
- ABM IA de compatibilidades paramétricas como flujo separado

Para `aberturas`, el foco correcto sigue siendo:

- parser robusto desde fuentes heterogéneas
- validación
- insert limpio
- borrador estructurado de cotización

Prioridad baja o dependiente de backend:

- cupones y descuentos
- logística/envíos externos
- inventario multi-depósito
- campañas/CMS promocional

## Nota

El foco recomendado sigue siendo ampliar primero operaciones generales reutilizables entre tenants. Las extensiones específicas de `UruCortinas` deberían apoyarse en ese mismo patrón seguro y no crear un flujo paralelo menos auditable.
