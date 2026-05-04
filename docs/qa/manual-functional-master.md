# Manual Functional QA Master

Este documento es el índice operativo para QA manual del ecommerce completo.
La fuente viva y detallada sigue siendo:

- [docs/qa/system-use-cases-report.xlsx](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/qa/system-use-cases-report.xlsx)
- [tools/qa/use-cases-report.source.mjs](/Users/rodrigo/Git/personal/react_admin_dashboard/tools/qa/use-cases-report.source.mjs)

## Alcance

- Storefront en Next.js
- Admin / CMS
- Backend en Node.js + Prisma
- Productos paramétricos y canónicas
- Búsqueda
- Carrito, checkout, pagos y post-compra
- Analytics estructural
- Integraciones externas
- Seguridad y consistencia cross-project

## Exclusiones

- Quedan fuera los flujos de respuesta automática de Chat Platform con IA.
- Para chat sólo se conservan los canales manuales del loop operativo cuando aplique: Meta, Mail y Webchat.

## Regla de uso

- Si un caso no está en `VERIFICADA`, no se considera cerrado para salida a producción.
- Si un cambio toca más de un sistema, hay que validar el handoff completo.
- Si aparece un bug, se registra en `Hallazgos` y se re-testea el flujo afectado antes de cerrar.

## Orden de ejecución recomendado

1. Navegación base
2. Búsqueda
3. Catálogo y PDP
4. Canónicas / monoblock
5. Analytics estructural
6. Mobile-first y performance
7. Carrito
8. Checkout
9. Pagos
10. Autenticación y cuenta
11. Admin / CMS
12. Integraciones cross-project
13. Seguridad

## Casos críticos por bloque

### Ecommerce

Arrancar por estos casos antes de una salida a producción:

- Navegación: `ECOM-HOME-001`, `ECOM-HOME-002`
- Búsqueda: `ECOM-SEARCH-001`, `ECOM-SEARCH-002`
- Catálogo: `ECOM-CATALOG-001`, `ECOM-CATALOG-002`
- Producto: `ECOM-PROD-001`, `ECOM-PROD-002`, `ECOM-PROD-003`, `ECOM-CAN-001`
- Analytics: `ECOM-ANL-001`, `ECOM-ANL-002`
- Mobile-first: `ECOM-MOB-001`
- Performance: `ECOM-PERF-001`
- Carrito: `ECOM-CART-001` a `ECOM-CART-007`
- Checkout: `ECOM-CHK-001` a `ECOM-CHK-010`
- Pagos: `ECOM-PAY-001` a `ECOM-PAY-007`
- Autenticación: `ECOM-AUTH-001` a `ECOM-AUTH-014`
- Cuenta y post-compra: `ECOM-WISH-001`, `ECOM-ORD-001` a `ECOM-ORD-004`, `ECOM-SUP-001`, `ECOM-REV-001`

### Admin / CMS

- Acceso y permisos: `ADMIN-AUTH-001`, `ADMIN-RBAC-001`
- Dashboard y operaciones: `ADMIN-DASH-001`, `ADMIN-CLT-001`, `ADMIN-ORD-001`, `ADMIN-PAY-001`
- Productos y CMS: `ADMIN-PROD-001`, `ADMIN-PROD-002`, `ADMIN-CMS-001`, `ADMIN-CMS-002`, `ADMIN-CMS-003`
- Configuraciones: `ADMIN-SET-001` a `ADMIN-SET-008`
- Canales y conversaciones manuales: `ADMIN-CHAT-001` a `ADMIN-CHAT-015`
- IA / knowledge / QA center: `ADMIN-AI-001` a `ADMIN-AI-006`, `ADMIN-QA-001`
- Comercial y ownership: `ADMIN-COM-001`, `ADMIN-COM-002`

### Cross-project

- `CROSS-001` a `CROSS-021`

### Security

- `SEC-001` a `SEC-021`

## Qué debe validar QA manual

En cada caso:

- que el usuario pueda completar el flujo sin ambigüedad
- que frontend y backend coincidan en el resultado
- que el estado persistido sea consistente
- que analytics e integraciones no rompan el flujo principal
- que el comportamiento móvil no degrade el flujo crítico
- que no haya regresiones en rutas canónicas o SEO

## Evidencia mínima esperada

- Captura del resultado esperado
- URL o ruta exacta
- ID del caso ejecutado
- Estado final del flujo
- Si falla, el registro de `Hallazgos` con severidad y pasos

## Loop de mantenimiento

1. Releer el contrato vivo
2. Ejecutar el bloque afectado
3. Registrar diferencias reales
4. Corregir código o documentación
5. Regenerar el workbook
6. Volver a ejecutar los bloques críticos

## Punto de partida operativo

- Si el cambio afecta navegación, búsqueda o PDP, ejecutar primero `ECOM-HOME`, `ECOM-SEARCH`, `ECOM-PROD` y `ECOM-CAN`.
- Si el cambio afecta compra, ejecutar primero `ECOM-CART`, `ECOM-CHK` y `ECOM-PAY`.
- Si el cambio afecta contenido, CMS o metadata, ejecutar `ADMIN-CMS` y `ECOM-HOME-002`.
- Si el cambio afecta analytics, revisar `ECOM-ANL` y los flows `begin_checkout` / `purchase`.
- Si el cambio afecta mobile, re-ejecutar el flujo completo en viewport reducido.

## Fuente de verdad

Este documento ordena la ejecución manual.  
La verdad detallada y fila por fila vive en el workbook y en su fuente estructurada.

