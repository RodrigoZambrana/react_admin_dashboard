# Plan maestro de producto

Horizonte orientativo: 12 a 18 meses. Fecha base: 2026-09-08.

## Resultado final

Una plataforma multi-tenant de crecimiento empresarial compuesta por productos
independientes pero integrados:

1. Commerce Suite: CRM, backend comercial y storefront operables.
2. Growth Metrics: medición confiable de Google, Meta, storefront, CRM y canales,
   con decisiones y operaciones controladas.
3. Conversation Platform: centralización de canales, asistencia IA y
   automatización gradual.
4. Un control plane común para identidad, tenants, permisos e integraciones.

## Orden de prioridades

### Fase 0 — Fundación (completada en este baseline)

- harness independiente;
- auditoría ejecutable;
- arquitectura objetivo;
- gates de separación;
- roadmap canónico.

Criterio de salida: cualquier nueva sesión puede identificar producto, owner,
pruebas y próximo hito sin reconstruir todo el contexto.

### Fase 1 — Seguridad y cierre técnico ecommerce (4–6 semanas)

- Remediar dependencias del backend por grupos de riesgo.
- Corregir warnings de storefront y definir política de fallbacks de build.
- Inventariar y aislar código demo/legacy sin borrado indiscriminado.
- Consolidar configuración por ambiente y smoke de Docker.
- Fijar contrato de eventos críticos: orden, pago, stock, notificación.
- Hacer verde el gate `release` de backend, admin y storefront.

Criterios de salida:

- cero critical/high aplicables al runtime o excepciones aprobadas y fechadas;
- builds release reproducibles;
- migración y rollback ensayados;
- contratos críticos versionados.

### Fase 2 — Ecommerce listo para primer tenant (6–10 semanas)

- Recorrido E2E: catálogo → carrito → checkout → pago → orden → stock → email →
  operación admin → fulfillment.
- Mercado Pago sandbox con webhook duplicado/fuera de orden y reconciliación.
- Política explícita de reserva y descuento de stock.
- Modalidades, costo y datos mínimos de entrega/retiro.
- Observabilidad, alertas, backup/restore y runbook.
- Piloto controlado y checklist de go-live.

Criterio de salida: una compra real controlada puede completarse, operarse,
auditarse y recuperarse sin intervención técnica improvisada.

### Fase 3 — Growth Metrics reusable read-only (6–8 semanas)

- Aislar contratos, configuración y tablas del dominio analytics.
- Actualizar documentación a BullMQ/Redis y eliminar contradicciones.
- Certificar OAuth/reauth, backfill, retries, locks, freshness y data quality.
- Unificar campaign/source/landing/conversion IDs entre fuentes.
- Incorporar Meta Ads con lifecycle equivalente o declarar su alcance excluido.
- Dashboard de decisiones con trazabilidad a datos fuente.
- Ejecutar como runtime separable dentro del monorepo.

Criterio de salida: un tenant nuevo conecta fuentes sin cambios de código y
obtiene métricas reconciliadas, frescas y auditables.

### Fase 4 — Inbox omnicanal operable (6–10 semanas)

- Consolidar Conversation Platform como único owner.
- Completar anti-corruption layer con backend/CRM.
- Priorizar webchat y un canal externo; sumar canales uno a uno.
- Entregar inbox humano: asignación, unread, handoff, reintentos, attachments y
  trazabilidad.
- Ejecutar E2E y pruebas de desconexión/reconexión por proveedor.

Criterio de salida: operadores administran conversaciones centralizadas aun con
IA deshabilitada.

### Fase 5 — IA asistida y automatización gradual (8–12 semanas)

- Corpus/evals versionados con conversaciones reales anonimizadas.
- Respuestas sugeridas y aprobación humana.
- Métricas de calidad: resolución, corrección, escalamiento, latencia y costo.
- Automatizar solo intents de bajo riesgo con herramientas idempotentes.
- Kill switch, límites por tenant/canal y auditoría de cada acción.

Criterio de salida: automatización habilitada por capacidad, con umbrales y
fallback humano comprobados.

### Fase 6 — Operaciones de campañas y extracción física (posterior)

- Diseñar comandos de campañas con dry-run, aprobación, budget guardrails,
  auditoría y rollback.
- Extraer Growth Metrics, Conversation Platform y Channel Adapters únicamente
  cuando cumplan `ai-harness/docs/extraction-gates.md`.
- Evaluar extracción de CRM después de desacoplar transacciones commerce.
- Introducir control plane solo para necesidades transversales demostradas.

## Carriles permanentes

### Calidad y seguridad

- gates por producto;
- dependency updates pequeños y frecuentes;
- threat model para auth, pagos, uploads, webhooks, IA y campañas;
- SLOs, alertas y respuesta a incidentes.

### Producto y operación

- un tenant piloto antes de generalizar;
- onboarding repetible por tenant;
- métricas de adopción, conversión y carga operativa;
- runbooks y ownership humano explícito.

### Arquitectura

- contratos versionados antes de integraciones nuevas;
- datos con owner único;
- no compartir internals Prisma entre productos;
- compatibilidad hacia atrás y migraciones reversibles.

### Limpieza

- clasificar docs como canonical, reference o archive;
- retirar assets/demo solo con prueba de no uso;
- medir bundle y dependencias;
- evitar refactors sin criterio de aceptación observable.

## Primer backlog ejecutable

1. Crear inventario y plan de actualización de las 22 vulnerabilidades altas.
2. Hacer green el backend release gate sin bypass.
3. Ejecutar y estabilizar el E2E crítico ecommerce conectado a stack local.
4. Cerrar stock, pago y fulfillment con decisiones de negocio documentadas.
5. Preparar piloto ecommerce y runbook de go-live.
6. Actualizar la auditoría analytics contra la implementación BullMQ actual.
7. Definir contrato de integración Commerce ↔ AI Platform y retirar ownership
   conversacional duplicado de forma gradual.

## Regla de priorización

Hasta completar la Fase 2, una iniciativa entra al sprint solo si reduce riesgo
de lanzamiento ecommerce, cierra el recorrido operativo o elimina un bloqueo de
seguridad. Métricas e IA avanzan en diseño/contratos, no en expansión funcional
que compita con ese cierre.
