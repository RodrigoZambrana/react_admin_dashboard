# Critical Risk Report

Fecha de auditoria: `2026-05-08`

## Riesgos prioritarios

| Prioridad | Riesgo | Evidencia | Que bug podria escapar | Accion obligatoria |
| --- | --- | --- | --- | --- |
| P0 | workbook con falso `VERIFICADA` por `skip` | `8` casos `valid` dependen de `ecommerce-readiness.spec.ts` o `admin-conversation-actions.spec.ts`, ambas en `skip` | se libera una funcionalidad creyendo que ya esta protegida | degradar estados en Excel o reactivar specs |
| P0 | E2E critica no autocontenida | browser core sigue dependiendo de puertos y servicios externos | checkout, login admin o handoff storefront->backend fallan fuera del pipeline | agregar bootstrap del entorno al gate o pipeline dedicado reproducible |
| P0 | flujo critico de Mercado Pago sin spec real | `mercadopago-success.spec.ts` no existe y ahora el gate falla correctamente por eso | pago feliz queda sin proteccion real | restaurar o reemplazar la spec antes de cierre |
| P1 | validador de gobernanza incompleto | reporta `False-green candidates: 0` aunque hay `skip` vigentes | se interpreta cobertura sana cuando no lo esta | extender validacion a `skip` y no solo a path missing |
| P1 | coverage backend insuficiente en pricing/pagos/inbox | pricing `3.47%`, pagos `25.65%`, inbox `11.62%` | regresiones de negocio core pasan por tests verdes | subir coverage util por dominio critico antes de gatear manual QA |
| P1 | CI no representa salud del sistema | solo workflow visible: `analytics-health` | merge verde con ecommerce, frontend o adapters rotos | crear matrix minima de test y quality gates |
| P2 | channel-adapter sin script formal | `node --test` pasa, `package.json` no expone `test` | suite deja de correrse con el tiempo | agregar script y entrada de CI |
| P2 | clasificacion `deferred` demasiado amplia | regex del validador marca `backend-domain-*` y `email` como diferidos | el reporte pierde precision operativa | endurecer patrones de clasificacion |

## Riesgos funcionales mas expuestos hoy

### Commerce core

- pagos y confirmacion de compra;
- catalogo y PDP de productos parametricos/canonicos;
- handoff carrito -> checkout -> analytics;
- login/registro storefront sostenidos por evidencia parcialmente `skip`.

### Admin core

- sign-in y acceso base del panel;
- navegacion por ordenes;
- conversaciones manuales y takeover operatorio.

### Operacion y release

- pipeline puede quedar verde sin correr capas esenciales;
- workbook puede comunicar un nivel de cobertura superior al real.

## Criterio de bloqueo

No habilitar QA manual mientras se mantengan simultaneamente estas condiciones:

- casos `VERIFICADA` con evidencia `skip` o faltante;
- smoke browser core sin runtime reproducible;
- pagos criticos sin spec feliz real;
- workbook sano en paths pero no en ejecutabilidad real;
- CI sin gate transversal minimo.

## Orden de mitigacion

1. sanear trazabilidad y estados del workbook;
2. endurecer runners para que fallen ante specs inexistentes;
3. corregir `validate-governance` para detectar `skip` y no diferir por ruido regex;
4. hacer autocontenible el smoke browser core;
5. subir cobertura real de pricing, pagos e inbox;
6. recien despues reactivar superficies AI como bloque no esencial.
