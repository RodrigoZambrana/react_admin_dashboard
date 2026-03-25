# Pending Implementation Report

Fecha: 2026-03-23

## Objetivo

Consolidar los pendientes abiertos a la fecha en una vista priorizada, corta y accionable.

## P0. Crítico

1. Coherencia total de precios y monedas en compra
- Cerrar definitivamente cualquier divergencia entre:
  - `/shop`
  - `product detail`
  - `checkout preview`
  - pago
  - detalle/timeline del pedido
- Debe seguir aplicando a `simple`, `variable` y `parametric`.

2. Regresiones E2E del flujo comercial
- Extender la suite browser actual a:
  - `shop -> product detail -> cart` para paramétricos publicados
  - `checkout preview -> pago -> order detail`
  - flujo `cash` pendiente de confirmación
  - notificaciones cliente/admin

3. Flujo cash completo e intuitivo
- El pedido ya se registra y el pago queda visible para admin.
- Falta validar/ajustar el circuito completo UX + estados + timeline + notificaciones para confirmación/cancelación manual.

## P1. Alto

4. Estrategia transversal de cache
- Definir política unificada para `backend`, `frontend` y `ecommerce`.
- Debe cubrir:
  - qué se cachea,
  - dónde,
  - cuánto dura,
  - cómo se invalida.

5. Normalización de tablas y consultas
- Revisar estructura física de base y posibles normalizaciones futuras.
- Auditar consultas críticas.
- Agregar índices solo con evidencia real de necesidad.

6. Hardening de DTO públicos
- Mantener auditoría periódica de datos expuestos a storefront.
- Recortar campos no esenciales.
- Evitar sobreexposición incremental en endpoints públicos.

7. `data-testid` como criterio de aceptación
- Completar cobertura de `data-testid` en superficies críticas restantes.
- Incorporarlo explícitamente al Definition of Done para cambios futuros con impacto funcional.

8. Desacople CMS de `stories`
- La base actual ligada a `Product` debe considerarse transitoria.
- La evolución recomendada es mover `stories` a un dominio CMS independiente.
- La relación con producto debe pasar a ser opcional, no estructural.
- Referencia de arquitectura:
  - `CMS_CONTENT_ARCHITECTURE_2026-03-23.md`

## P2. Medio

9. Cobertura de pruebas aceptable
- Mantener la suite Playwright actual como base.
- Seguir expandiendo regresiones críticas sin volver la suite frágil.
- Preparar posterior integración CI/CD.

10. Estrategia formal de privacidad/PII
- Masking sistemático.
- Revisión de PII en admin/exportes.
- Retención y anonimización futura.

11. Governance operativo de emails/templates
- Terminar de validar permisos, variantes por idioma y proceso operativo real sobre ABM/configuración existente.

## P3. Evolutivo

12. CMS dinámico del sitio
- `stories` no debería consolidarse como feature de producto.
- Debe evolucionar hacia una sección `CMS` independiente, con contenido desacoplado de catálogo.
- La edición debería quedar asociada inicialmente a `ADMIN/SUPERADMIN` y luego a un rol específico `EDITOR`.
- Referencia de arquitectura:
  - `CMS_CONTENT_ARCHITECTURE_2026-03-23.md`

13. Automatizaciones y observabilidad de regresión
- Consolidar reportes de pruebas y humo post-cambio.
- Definir qué suites corren siempre y cuáles por dominio.

## Criterios futuros ya acordados

- `backend` sigue siendo la fuente final de verdad.
- No introducir parches de pricing/checkout que vuelvan a divergir según pantalla.
- Toda nueva superficie crítica debería salir con `data-testid` estable.
- Toda modificación relevante de flujo debería considerar regresión automatizada cuando el costo sea razonable.
