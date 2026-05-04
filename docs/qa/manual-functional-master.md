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

## Última validación runtime

- `2026-05-03`: se recompiló y reinició el admin local.
- `Product List` ya no muestra keys crudas; `appsProducts.products` fue corregido a `nav.appsProducts.products` y en runtime se ve `Productos`.
- `OrderNew` quedó alineado con la misma traducción y en runtime muestra `Pedidos confirmados · Agregar Pedido` y `Productos` sin keys visibles.
- `Pedidos confirmados` sigue mostrando la orden generada por storefront `#0de8759e-0e10-53e2-979a-bc616529b441`, validando consistencia storefront → admin.
- `2026-05-03`: se validó storefront en runtime hasta `PDP -> carrito` con el producto paramétrico `Producto Variable QA API 2` (`/product/qa-var-003`) y el handoff al checkout quedó consistente hasta el paso de dirección.
- `2026-05-03`: `CMS Pages` cargó correctamente en `localhost:8080/admin/cms/pages?scope=store` y mostró páginas publicadas como `Quiénes somos`, `Preguntas frecuentes`, `Reparación urgente` y `Persianas de enrollar`.
- `2026-05-03`: `GET /api/healthz` y `GET /api/health` respondieron `200` con estado `ok`.
- `2026-05-03`: checkout bloqueó en la validación de `Barrio`; la UI mostró `Debes seleccionar el barrio.` y no aceptó la selección del combo durante la corrida, por lo que ese caso sigue abierto como bloqueo funcional del flujo de compra.
- `2026-05-03`: luego de fijar `Barrio` en `Aguada` y completar los campos de contacto/dirección mínimos, el checkout aceptó los datos pero `Continuar al pago` no avanzó al siguiente paso en esta corrida. Queda como posible bloqueo de transición del flujo.

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

## Hallazgos abiertos en esta corrida

- `ECOM-CHK-BARRIO-001`: el checkout bloquea la selección de barrio en el primer intento. Reproducir en `localhost:8080/checkout`, completar datos personales y de envío, abrir el selector de barrio e intentar avanzar. Resultado actual: el formulario inicialmente muestra el error `Debes seleccionar el barrio.` aunque el dropdown sí lista opciones.
- `ECOM-CHK-TRANS-001`: con `Barrio` ya seleccionado y los campos mínimos completos, `Continuar al pago` no avanzó al siguiente paso en esta corrida. Reproducir en `localhost:8080/checkout`, completar nombre, apellido, email, teléfono, calle, número y barrio, y pulsar `Continuar al pago`. Resultado actual: permanece en `Detalles`.

## Punto de partida operativo

- Si el cambio afecta navegación, búsqueda o PDP, ejecutar primero `ECOM-HOME`, `ECOM-SEARCH`, `ECOM-PROD` y `ECOM-CAN`.
- Si el cambio afecta compra, ejecutar primero `ECOM-CART`, `ECOM-CHK` y `ECOM-PAY`.
- Si el cambio afecta contenido, CMS o metadata, ejecutar `ADMIN-CMS` y `ECOM-HOME-002`.
- Si el cambio afecta analytics, revisar `ECOM-ANL` y los flows `begin_checkout` / `purchase`.
- Si el cambio afecta mobile, re-ejecutar el flujo completo en viewport reducido.

## Fuente de verdad

Este documento ordena la ejecución manual.  
La verdad detallada y fila por fila vive en el workbook y en su fuente estructurada.
