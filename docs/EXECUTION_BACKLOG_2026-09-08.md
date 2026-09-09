# Backlog maestro de ejecución

Fecha de corte: 2026-09-08

## Propósito y autoridad

Este documento es la vista humana de `planning/backlog.json`. El JSON es la
fuente ejecutable: contiene alcance incluido y excluido, dependencias, criterios
de aceptación, verificación, riesgos, decisiones y fuentes para cada tarea.

El backlog no autoriza implementación por su mera existencia. Solo una tarea
`ready` puede seleccionarse; durante esta fase, las tareas `ready` producen
decisiones, contratos, inventarios o gates, no cambios funcionales.

## Estado consolidado

| Línea | Tareas | Ready | Done | Blocked | Proposed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Plataforma y harness | 23 | 7 | 3 | 13 | 0 |
| Ecommerce, CRM, backend, admin y storefront | 36 | 1 | 0 | 35 | 0 |
| Growth Metrics y operaciones futuras | 30 | 1 | 0 | 3 | 26 |
| AI Platform | 24 | 2 | 0 | 22 | 0 |
| Adaptadores de canales | 17 | 1 | 0 | 16 | 0 |
| **Total** | **130** | **12** | **3** | **89** | **26** |

Por prioridad existen 65 tareas P0, 52 P1, 10 P2 y 3 P3. `blocked` significa
que la especificación es suficiente pero falta una decisión o dependencia;
`proposed` significa que todavía debe completarse o aprobarse su especificación.

## Primera ola permitida

Estas son las únicas tareas actualmente seleccionables. Todas son trabajo
previo a implementación:

| Id | Resultado |
| --- | --- |
| HAR-003 | Intake, trazabilidad, slicing y promoción gobernada dentro del backlog único. |
| ARC-001 | Inventario verificable de contextos, módulos y ownership actual. |
| EC-001 | Carta de producto y Definition of Done de Commerce Suite. |
| SEC-001 | Baseline de vulnerabilidades clasificado por exposición real. |
| SEC-002 | Threat model transversal de superficies críticas. |
| QA-001 | Matriz de calidad y release por producto. |
| CFG-001 | Inventario de configuración y secretos por producto/ambiente. |
| DOC-001 | Clasificación documental y retiro planificado de rutas personales. |
| GM-004 | Contrato canónico de eventos y métricas especificado. |
| AI-001 | Threat model y clasificación de datos específica de AI Platform. |
| AI-024 | Documentación de AI Platform clasificada dentro del harness. |
| CH-008 | ADR sobre soporte y riesgo de WhatsApp QR. |

`HAR-002` y `PF-001` están cerradas. HAR-003 ya no conserva otro bloqueo y fue
promovida a `ready`; el control la recomienda primero según el orden aceptado.
Después se recalculan `HAR-004` y el resto de la cola. No se promueve trabajo
dependiente sin revalidar el DAG ni las decisiones pendientes.

## Decisiones y capacidades cerradas en esta ola

| Id | Resultado |
| --- | --- |
| HAR-002 | Lifecycle, preflight Git, write-set, commit local aislado y cierre automatizados. |
| PF-001 | Modelo híbrido, piloto UruCortinas dedicado, ownership de configuración y responsable Rodrigo aprobados en ADR-009. |

## Paquetes de resultado

### Plataforma transversal — PF/ARC/SEC/QA/CFG/CI/MOD/CLN/OPS/DOC

Define modelo de producto y tenancy, ownership, contratos, seguridad, calidad,
configuración, CI, modularización segura, limpieza y readiness operativo. Estos
estándares evitan repetir soluciones incompatibles en cada producto.

### Paridad del AI Harness — HAR-001 a HAR-009

HAR-001 estableció el control y la brecha. HAR-002..HAR-009 incorporan, en
orden, lifecycle/preflight, intake, cápsulas/handoffs, revisión independiente,
testing, runtime local, skills especializados y el gate final de paridad. Este
programa excluye Java/Maven, Zoho, Ghost Inspector y onboarding organizacional
de LACNIC, pero no excluye las capacidades generales que resolvían.

### Commerce Suite — EC-001 a EC-036

- EC-001..005: carta de producto, decisiones, contextos, tenancy y contratos.
- EC-006..012: threat model, identidad, recuperación, dependencias y RBAC.
- EC-013..023: pagos, stock, órdenes, notificaciones, fulfillment y CRM.
- EC-024..026: continuidad, observabilidad y configuración por ambiente.
- EC-027..030: modularización, limpieza y caracterización previa.
- EC-031..035: compra E2E, Mercado Pago sandbox, calidad, release y piloto.
- EC-036: gate de extracción; no presupone separar Commerce y CRM antes de
  resolver transacciones y ownership.

### Growth Metrics — GM-001 a GM-030

- GM-001..012: seguridad, consentimiento, tenancy, semántica, normalización,
  conversión, atribución y reporting con lineage.
- GM-013..018: certificación read-only de GA4, Google Ads, Search Console, Meta
  y señales de WhatsApp.
- GM-019..023: data trust, colas, recuperación, experiencia admin y release.
- GM-024..027: puertos/adapters, eventos, runtime/datos separables y gobernanza.
- GM-028..030: command plane y operaciones Google/Meta. Permanecen P3 y
  bloqueadas hasta tener medición confiable, aprobación, límites y rollback.

### AI Platform — AI-001 a AI-024

Primero cierra amenazas, identidad, tenant, payloads y contratos; después outbox
e inbox humano, integración con CRM/Commerce, knowledge y evals. Las sugerencias
asistidas preceden a cualquier automatización, que conserva fallback humano,
límites por capacidad y kill switch.

### Channel Adapters — CH-001 a CH-017

Endurece ingresos y dependencias, define identidad tenant, entrega y receipts,
certifica un canal externo con IA apagada y recién después amplía WhatsApp,
email y automatización. Incluye observabilidad, release y runtime separable.

## Gates que gobiernan la separación

La división real se realiza en este orden:

1. necesidad y owner de producto;
2. ownership único de datos y escrituras;
3. contrato API/evento versionado y probado;
4. seguridad, observabilidad, migración, rollback y release propios;
5. runtime separable dentro del monorepo;
6. extracción a repositorio independiente solo con paridad demostrada.

Mover carpetas o repositorios antes de estos gates no cuenta como separación.

## Uso operativo

```bash
npm run harness:backlog:assemble
npm run harness:backlog
npm run harness:backlog -- --ready
npm run harness:backlog -- --id EC-001
```

Al comenzar una tarea se actualizan `ai-harness-local/feature_list.json` y el
checkpoint; al cerrarla se adjunta evidencia y se reensambla/revalida el backlog.
