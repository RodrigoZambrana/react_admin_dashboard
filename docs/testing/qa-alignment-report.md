# QA Alignment Report

Fecha de auditoria: `2026-05-08`

## Evaluacion contra la estrategia acordada

| Etapa esperada | Estado actual | Evaluacion |
| --- | --- | --- |
| 1. documentacion | existe workbook, guia manual y docs | alineado parcialmente |
| 2. trazabilidad | existe, mejoro en paths, pero conserva drift por `skip` | desviado |
| 3. unit/integration | backend, frontend y ecommerce unitario razonables | parcial |
| 4. deterministic recovery | backend si; browser no | parcial |
| 5. smoke automation | existe declarada, no autocontenida | desviado |
| 6. browser E2E | amplia y ambiciosa | adelantada respecto a la estabilidad base |
| 7. manual QA | aun no deberia ser puerta de descubrimiento | bloqueado |
| 8. AI systems deferred | documentados, pero aparecen en defaults | desviado |

## Desviaciones concretas

### Trazabilidad antes que realidad

El workbook comunica mas certeza que la que el runtime puede sostener:

- casos `VERIFICADA` siguen apuntando a `skip`;
- el caso de specs inexistentes en Mercado Pago ya fue degradado correctamente a `PENDIENTE`;
- la validacion automatica del workbook hoy revisa existencia de path, pero no ejecutabilidad real de la evidencia.

### Browser E2E demasiado temprano como capa base

La automatizacion browser existe, pero no esta en condicion de gate estable:

- depende de servicios levantados por fuera del runner;
- mezcla storefront, admin, backend, ai-platform y canales;
- varios bloques del manifest combinan recovery core con conversaciones AI.

### AI no suficientemente diferida en la operacion diaria

El manifest por defecto incluye:

- `storefront-e2e-ai-conversations`
- `ai-conversation-quality`
- `ai-runtime-smoke`

Eso contradice la regla de postergar IA hasta estabilizar ecommerce core.

Ademas, el validador actual usa patrones `deferred` demasiado amplios, por lo que la etiqueta pierde precision y no sirve todavia como criterio firme de gobierno.

### Smoke insuficientemente delimitado

El sistema necesita un smoke corto y confiable. Hoy:

- `backend` si tiene una base usable;
- `frontend` solo cubre unitario;
- `ecommerce` no tiene un smoke browser reproducible sin preparar entorno manualmente.

## Reordenamiento recomendado

### Fase 1

- sanear workbook, manifest y scripts;
- bloquear specs faltantes y `skip` invisibles;
- endurecer `validate-governance`.

### Fase 2

- consolidar smoke deterministico:
  - `backend`
  - `frontend`
  - `ecommerce` core sin IA
  - `channel-adapter`

### Fase 3

- browser E2E de core comercial:
  - catalogo
  - PDP
  - carrito
  - checkout
  - admin sign-in
  - ordenes
  - CMS canonico

### Fase 4

- cross-project avanzado;
- inbox/manual operations;
- AI y conversaciones como bloque diferido y separado.

## Decision de alineacion

El repositorio esta mas cerca de una etapa `2.5` que de una etapa `6`:

- hay buena inversion en tests;
- falta convertirla en un sistema de release confiable;
- no corresponde mover la carga a QA manual hasta cerrar trazabilidad real, smoke autocontenido y gates CI basicos.
