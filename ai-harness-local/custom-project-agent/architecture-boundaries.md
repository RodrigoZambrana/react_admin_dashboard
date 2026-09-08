# Fronteras de arquitectura

- Commerce Core es owner de cliente comercial, catálogo, pricing, stock, orden,
  pago y fulfillment hasta que un ADR futuro separe CRM.
- Storefront y Admin consumen contratos; no son owners de reglas comerciales.
- Conversation Platform es owner objetivo de conversación, mensajes, estado y
  política IA.
- Channel Adapter es owner de transporte, credenciales/sesión del proveedor y
  traducción al mensaje canónico.
- Growth Metrics es owner objetivo de conexiones analíticas, métricas,
  atribución, data trust e insights.
- No crear nuevos modelos conversacionales en el backend legacy.
- No crear nuevas operaciones de campaña dentro del conector de reporting.
- No compartir modelos Prisma internos entre productos.
- La extracción Git requiere los gates de `ai-harness/docs/extraction-gates.md`.
