AI_HARNESS_MODE: active

# Router operativo del proyecto

## Arranque

1. Lee `ai-harness-local/progress/current.json` y no abras una segunda tarea si
   hay una sesión `active` o `blocked`.
2. Identifica el producto afectado en `ai-harness/config/project.json`.
3. Para trabajo de producto, lee `docs/TARGET_PRODUCT_ARCHITECTURE.md` y la
   sección pertinente de `docs/MASTER_PLAN_2026-09-08.md`.
4. Para cambios de código, aplica `ai-harness/docs/workflow.md` y
   `ai-harness/docs/verification.md`.
5. Para una futura extracción, aplica además
   `ai-harness/docs/extraction-gates.md`.

## Enrutamiento

| Alcance | Ubicación actual | Fuente adicional |
| --- | --- | --- |
| Ecommerce core / CRM / API | `backend/` | `docs/STOREFRONT_CLOSURE.md` |
| Administración | `frontend/` | `frontend/README.md` |
| Storefront | `ecommerce/` | `ecommerce/README.md` |
| IA conversacional | `ai-platform/` | `ai-platform/docs/architecture.md` |
| Canales | `services/channel-adapter/` | `services/README.md` |
| Métricas y growth | `backend/src/analytics/`, `backend/src/growth/` | `docs/analytics-integration-audit-2026-04-29.md` |
| Infraestructura | `deploy/`, Docker y scripts raíz | `docs/architecture.md` |
| Harness | `ai-harness/`, `ai-harness-local/`, `AGENTS.md` | este archivo |

## Invariantes

- No asumir que una compilación verde equivale a readiness operativo.
- No declarar cierre sin pruebas y una comprobación funcional proporcional.
- No mezclar refactors amplios con cambios funcionales salvo que el plan de la
  tarea lo justifique explícitamente.
- No introducir imports directos entre productos. La integración nueva usa
  contratos HTTP/eventos/versionados o paquetes compartidos deliberados.
- `ai-platform` es el destino de ownership para runtime, estado y políticas de
  conversaciones. El backend legacy solo puede actuar como puente transitorio.
- Analytics es lectura, normalización y decisión hasta que exista un contrato
  separado y seguro para mutaciones de campañas.
- Toda frontera multi-tenant debe transportar y validar `tenantId`; nunca debe
  inferirse de datos del cliente o de un valor global en producción.
- Secretos solo en variables/secret stores. Los ejemplos documentan nombres,
  nunca valores reales.
- El árbol puede estar sucio por trabajo legítimo previo. Antes de editar,
  delimita archivos propios; nunca uses limpieza Git destructiva.

## Niveles de verificación

- `quick`: feedback de pruebas focalizadas; sirve durante implementación.
- `standard`: tipos/compilación y suite razonable del producto.
- `release`: gates de seguridad, E2E/runtime y condiciones operativas. Puede
  requerir servicios locales y debe quedar verde antes de publicar.
