# Storefront Exploratory Backlog

Fecha: 2026-03-22

## Objetivo

Dejar registrados los hallazgos surgidos del testing exploratorio inicial del storefront, con el contexto suficiente para implementación posterior sin pérdida de información.

## Criterios transversales ya acordados

- `backend` es la fuente final de verdad para productos, pedidos, pagos y snapshots persistidos.
- El storefront debe soportar carritos mixtos con productos `simple`, `variable` y `parametric`.
- Para `urucortinas`, los productos paramétricos publicados no deben “cotizar” en checkout de forma arbitraria si ya representan un SKU público definido en backend.
- Mercado Pago debe seguir recibiendo el monto en `UYU`, aunque el storefront pueda mostrar otras monedas al cliente.
- Los cambios de UX menores no deben perder trazabilidad: si no se implementan en el bloque actual, quedan explícitamente en backlog.
- Las superficies críticas que puedan requerir automatización futura deben incorporar `data-testid` estables.
- `data-testid` pasa a considerarse criterio de aceptación para futuras modificaciones relevantes en flujos storefront.
- El objetivo futuro no es “testear todo”, sino sostener una cobertura aceptable y útil para regresión en los flujos de mayor riesgo.

## Priorización propuesta

### P0. Crítico para consistencia comercial

1. Pagos parciales y cronología de pedido
2. Unificación de moneda entre catálogo, pedido, checkout y detalle
3. Registro de usuario real y validaciones de identidad/contacto
4. Perfil de usuario sin datos dummy y con feedback correcto
5. Filtro real por rango de precios en `shop`

### P1. Importante para UX y alineación funcional

6. Selector de idioma reactivo sin refresh
7. Opción `Todas las categorías` en el selector de búsqueda
8. Contacto con layout real del storefront y corrección de warning React
9. Variantes configurables para productos paramétricos publicados

### P2. Evolutivo

10. Feed tipo stories para categorías en home

## Hallazgos y alcance

### 1. Pedidos con pagos parciales

Estado esperado:

- En storefront, las compras iniciadas por checkout público son siempre de pago total.
- Los pagos parciales aplican a registraciones manuales o administrativas sobre una orden existente.
- La cronología debe mostrar todos los pagos parciales en secuencia.
- Por encima de los pagos parciales debe mostrarse el cierre `Pago completo` cuando el saldo llegue a cero.
- La lectura visual debe seguir el criterio ya ajustado:
  - abajo `Pedido recibido`
  - luego pagos
  - luego estimación/entrega
  - arriba el estado más avanzado

Alcance técnico:

- Backend timeline:
  - [backend/src/orders/order-timeline.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/orders/order-timeline.service.ts)
  - [backend/src/storefront/storefront.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/storefront.service.ts)
- Storefront timeline:
  - [ecommerce/src/page-sections/customer-dashboard/orders/OrderStatus.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/page-sections/customer-dashboard/orders/OrderStatus.tsx)
- Admin timeline:
  - [frontend/src/views/sales/OrderDetails/components/Activity.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/sales/OrderDetails/components/Activity.tsx)

Pendiente:

- Verificar con evidencia real un caso de:
  - pago parcial,
  - segundo pago parcial,
  - pago completo.
- Confirmar que en admin la alta manual de pagos parciales use siempre la moneda histórica de la orden salvo caso excepcional documentado.

### 2. Unificación de monedas

Problema reportado:

- El cliente ve productos o pedido en una moneda y luego el detalle aparece en otra.
- Mercado Pago debe seguir operando en `UYU`.

Decisión pendiente:

- Definir si el detalle histórico del pedido debe:
  - mostrarse siempre en la moneda original de compra,
  - o permitir un modo de visualización alternativo sin alterar el registro histórico.

Recomendación:

- Guardar y mostrar por defecto la moneda original de compra en pedido, timeline y detalle.
- Permitir conversión visual solo como capa de presentación futura.
- Nunca mutar el historial del pedido por cambio de selector del cliente.
- Para storefront:
  - productos y checkout pueden seguir usando la moneda activa elegida por el cliente,
  - una vez creada la orden, listado y detalle deben quedar anclados a `orderCurrency`.
- Mercado Pago sigue operando en `UYU`; esa moneda no debe contaminar el detalle histórico de la orden.

Alcance técnico inicial:

- Storefront:
  - [ecommerce/src/page-sections/checkout/CheckoutForm.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/page-sections/checkout/CheckoutForm.tsx)
  - [ecommerce/src/page-sections/customer-dashboard/orders/OrderStatus.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/page-sections/customer-dashboard/orders/OrderStatus.tsx)
  - [ecommerce/src/app/(storefront)/(checkout)/payment/success/page.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(storefront)/(checkout)/payment/success/page.tsx)
- Admin:
  - [frontend/src/views/sales/OrderDetails/components/PaymentSummary.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/sales/OrderDetails/components/PaymentSummary.tsx)
  - [frontend/src/views/sales/OrderDetails/components/OrderPaymentsCard.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/sales/OrderDetails/components/OrderPaymentsCard.tsx)
  - [frontend/src/views/sales/OrderDetails/components/AdministrativeSummary.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/sales/OrderDetails/components/AdministrativeSummary.tsx)

### 3. Selector de idioma

Problema reportado:

- El cambio de idioma no se refleja inmediatamente; requiere refresh.

Hipótesis técnica:

- Hay persistencia de preferencia, pero falta propagar el cambio de estado a toda la superficie activa sin recarga.

Archivos a revisar:

- [ecommerce/src/state/i18n-context.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/state/i18n-context.tsx)
- [ecommerce/src/state/session-context.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/state/session-context.tsx)

### 11. Checkout invitado, alta de cliente y verificación por email

Estado actual acordado:

- `checkout` público debe permitir compra sin sesión iniciada.
- El dato obligatorio de contacto es `teléfono`.
- `email` es opcional.
- Si existe `email`, sigue siendo el canal principal de notificaciones automáticas hasta que exista `SMS/WhatsApp`.
- Si no existe `email`, no debe esperarse hoy un canal automático alternativo.

Implementado en esta fase:

- Backend/storefront ya aceptan `checkout` invitado con `teléfono` obligatorio y `email` opcional.
- La compra crea o actualiza el `Customer` asociado.
- El cliente nuevo queda con estado por tabla (`CustomerStatus`) y no con dato local hardcodeado.
- Se sembraron estados base para instalaciones limpias:
  - `Activo`
  - `Suspendido`
  - `Bloqueado`
- Las notificaciones de compra por email siguen aplicando cuando el cliente tiene email y no dependen de login con Google.

Pendiente futuro, no implementado todavía:

- Verificación/activación de email para cuentas storefront.
- Recomendación de diseño:
  - agregar `Customer.emailVerifiedAt`
  - reutilizar la infraestructura segura de tokens con un propósito explícito `email_verification`
  - enviar mail HTML de activación con link único y expiración
  - confirmar email desde endpoint público idempotente
  - no bloquear la creación del pedido, pero sí reflejar claramente el estado de verificación de la cuenta
  - si el alta proviene de Google OAuth, considerar el email verificado por el provider y evitar doble confirmación

Criterio de aceptación:

- Cambio inmediato de idioma en header, checkout, cuenta, búsqueda, timeline y páginas estáticas sin refresh manual.

### 4. Selector de categorías en barra de búsqueda

Problema reportado:

- Debe reaparecer la opción explícita `Todas las categorías` como opción seleccionable.

Archivos a revisar:

- [ecommerce/src/components/search-box/SearchInputWithCategory.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/components/search-box/SearchInputWithCategory.tsx)
- [ecommerce/src/components/search-box/styled.ts](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/components/search-box/styled.ts)

### 5. Variantes configurables para productos paramétricos publicados

Aclaración funcional clave:

- Esto aplica al storefront para paramétricos publicados de `urucortinas`.
- Hoy existe un producto paramétrico público que ya trae una configuración base real desde backend.
- La mejora pedida es permitir variantes opcionales de componentes según disponibilidad:
  - vidrio,
  - persiana,
  - mosquitero,
  - otras combinaciones compatibles.

Comportamiento esperado:

- El producto se “pinta” con una configuración por defecto.
- Si hay variantes disponibles, el cliente puede activar/desactivar opciones.
- Cada combinación compatible debe reflejar el precio correcto.
- Si solo existe una combinación disponible, se muestra esa única variante sin falsa sensación de elección.

Referencias existentes:

- Backend/parametric:
  - [backend/src/pricing/parametric-pricing.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/pricing/parametric-pricing.service.ts)
  - [backend/src/aberturas](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/aberturas)
- Admin/presupuesto de aberturas:
  - [frontend/src/views/sales/ProductForm](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/sales/ProductForm)
  - [frontend/src/views/sales/ProductList](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/sales/ProductList)
- Storefront actual:
  - [ecommerce/src/components/products](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/components/products)
  - [ecommerce/src/app/product/[slug]/page.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/product/[slug]/page.tsx)
  - [ecommerce/src/components/products/ProductIntro.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/components/products/ProductIntro.tsx)
  - [backend/src/storefront/storefront-published-product-resolver.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/storefront-published-product-resolver.service.ts)

Estado real relevado:

- El detalle público activo no monta hoy el `ParametricConfigurator` del storefront.
- La ruta pública usa:
  - [ecommerce/src/app/product/[slug]/page.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/product/[slug]/page.tsx)
  - [ecommerce/src/components/products/ProductIntro.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/components/products/ProductIntro.tsx)
- Backend ya resuelve el SKU paramétrico publicado fijo por `productId` usando:
  - [backend/src/storefront/storefront-published-product-resolver.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/storefront-published-product-resolver.service.ts)
- Hoy ese resolvedor devuelve:
  - `configuration` canónica,
  - `specifications`,
  pero no una estructura explícita de `availableOptions`/`selectors` para storefront público.
- El configurador completo actual del storefront:
  - [ecommerce/src/components/products/ParametricConfigurator.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/components/products/ParametricConfigurator.tsx)
  sigue orientado a cotización/configuración libre sobre matriz, no al caso publicado fijo con variantes opcionales limitadas.

Decisiones abiertas:

- Si estas variantes se modelan como:
  - compatibilidades dentro del SKU paramétrico publicado,
  - o combinaciones derivadas de la misma matriz canónica.

Línea recomendada de implementación:

- No reutilizar directamente el flujo de cotización libre para el storefront público fijo.
- Extender backend para que el producto publicado exponga un contrato explícito, por ejemplo:
  - `publishedParametricOptions`
  - `defaultConfiguration`
  - `availableVariants`
  - `priceDelta` o `resolvedPrice`
- Ese contrato debe salir del mismo resolvedor canónico del backend y no del navegador.
- Storefront debe renderizar:
  - solo las opciones realmente disponibles para ese SKU publicado,
  - con selección por defecto,
  - y actualización de precio sin convertir el flujo en una cotización arbitraria.
- Si solo existe una opción, se muestra como especificación fija, no como selector.

### 6. Registro de usuario

Pantalla:

- [ecommerce/src/app/(storefront)/account/register/page.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(storefront)/account/register/page.tsx)
- [ecommerce/src/app/(storefront)/account/register/RegisterClient.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(storefront)/account/register/RegisterClient.tsx)

Pendientes:

- Completar traducciones visibles:
  - `Customer already exists`
  - `Use at least 8 characters`
  - `Passwords must match`
- Alinear con flujo real de creación de usuario.
- Definir validaciones:
  - teléfono obligatorio,
  - mail opcional,
  - email y teléfono únicos,
  - sanitización de teléfono con variantes:
    - `099...`
    - `99...`
    - `59899...`
    - `+59899...`
  - criterio único de normalización entre frontend, storefront backend y flujos de recuperación,
  - feedback por no aceptar términos y condiciones.

### 7. Perfil de usuario

Pantalla:

- [ecommerce/src/app/(layout-3)/(customer-dashboard)/account/profile/page.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(layout-3)/(customer-dashboard)/account/profile/page.tsx)
- [ecommerce/src/app/(layout-3)/(customer-dashboard)/account/profile/ProfileClient.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(layout-3)/(customer-dashboard)/account/profile/ProfileClient.tsx)

Pendientes:

- Mejorar feedback de error en edición de campos incorrectos.

Estado actual relevado:

- `saldo` dummy ya fue retirado del perfil público.
- La foto pública ya funciona con la regla correcta:
  - si el usuario tiene `avatarUrl`, se muestra esa imagen;
  - si ingresó con Google y Google informó `picture`, backend la persiste en `customer.img` y pasa a `avatarUrl`;
  - si no hay imagen, storefront usa una foto por defecto.
- Queda como pendiente solo evitar promesas de edición de avatar no soportadas por la pantalla pública.

### 8. Página de contacto

Pantalla:

- [ecommerce/src/app/(storefront)/contact/ContactPageClient.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(storefront)/contact/ContactPageClient.tsx)
- [ecommerce/src/app/(storefront)/contact/page.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/(storefront)/contact/page.tsx)

Pendientes:

### 9. Hardening futuro de DTO públicos y exposición de datos

Objetivo:

- Reducir exposición incremental de datos públicos del storefront.
- Mantener `backend` como única fuente de verdad, pero enviando al frontend solo lo estrictamente necesario para renderizar y operar cada pantalla.

Principios acordados:

- `backend` como única fuente de verdad.
- DTO mínimos por pantalla/uso.
- No enviar costos, márgenes ni reglas internas si no son estrictamente necesarios.
- Auditar periódicamente los DTO públicos para evitar sobreexposición incremental.

Contexto técnico actual:

- El storefront no expone modelos Prisma crudos; usa mapeos explícitos en:
  - [backend/src/storefront/storefront.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/storefront.service.ts)
  - [backend/src/storefront/types.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/types.ts)
- Hoy no se exponen `costPrice` ni fórmulas de pricing en DTO públicos de producto.
- Sí existen campos públicos que deben revisarse periódicamente porque, aunque sean útiles para UX, quedan visibles en DevTools/Network si se envían:
  - `sku`
  - `barcode` de variantes
  - `paymentIntentId` en ciertos resúmenes de pedido
  - estructuras paramétricas públicas necesarias para selección/render.

Trabajo futuro recomendado:

1. inventario endpoint por endpoint de los DTO públicos de `/api/storefront`
2. clasificación por campo:
   - necesario para render,
   - útil pero opcional,
   - interno/no debería salir
3. recorte de campos no esenciales sin romper UX
4. regla de revisión obligatoria para cualquier nuevo DTO público

- Usar el mismo layout del storefront:
  - header,
  - footer,
  - espaciado coherente.
- Corregir warning React:
  - `Each child in a list should have a unique "key" prop.`
- Agregar margen entre paneles.

### 9. Filtro por rango de precios en shop

Caso reportado:

- `http://localhost:3000/shop?sort=price-asc&priceMin=224&priceMax=2500`

Problema:

- El filtrado actual no respeta correctamente el rango.

Archivos a revisar:

- [ecommerce/src/app/shop/page.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/app/shop/page.tsx)
- componentes de listado/filtro en `shop`

### 10. Feed tipo historias para categorías

Objetivo:

- Crear una sección superior en home con una experiencia tipo stories.
- Cada categoría puede tener fotos y videos.
- Al abrir una historia:
  - ocupa pantalla completa,
  - permite navegar por todos los elementos de esa categoría,
  - soporta assets locales, YouTube u otras fuentes compatibles.

Base sugerida:

- patrón visual de `Best Selling Product` en `fashion-2`

Referencia:

- [ecommerce/src/page-sections/fashion-2](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/page-sections/fashion-2)

Requerimiento importante:

- crear componentes nuevos y reutilizables,
- no reutilizar directamente datasets demo.

### 11. Plantillas y administración de emails

Estado relevado:

- Ya existe superficie administrativa para ABM/configuración de emails:
  - backend:
    - [backend/src/email/email-admin.controller.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email-admin.controller.ts)
    - [backend/src/email/email-settings.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email-settings.service.ts)
    - [backend/src/email/email-template.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email-template.service.ts)
  - admin:
    - [frontend/src/views/settings/EmailSettings/EmailSettings.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/views/settings/EmailSettings/EmailSettings.tsx)
    - [frontend/src/services/SettingsService.ts](/Users/rodrigo/git/personal/react_admin_dashboard/frontend/src/services/SettingsService.ts)

Pendientes:

- Verificar si la UX/admin actual alcanza para operación real o si faltan:
  - permisos,
  - defaults por tenant,
  - variantes por idioma,
  - publicación/versionado controlado.

Hallazgo adicional:

- La base administrativa existe de forma real y no solo como placeholder:
  - backend expone endpoints de config SMTP/inbox, logs y templates,
  - admin consume esa superficie desde `SettingsService`.
- El siguiente paso no es “crear ABM desde cero”, sino validar operación real y governance:
  - quién puede editar,
  - cómo se testean,
  - y cómo se controlan idiomas/tenants.

### 12. Emails de compra y post-compra

Estado relevado:

- Ya existe wiring backend para:
  - email a cliente y administradores por compra,
  - email de pago recibido,
  - email por cambio de estado de pedido.
- Referencias:
  - [backend/src/email/email.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/email.service.ts)
  - [backend/src/notifications/notification-orchestrator.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/notifications/notification-orchestrator.service.ts)
  - [backend/src/orders/order-payment-settlement.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/orders/order-payment-settlement.service.ts)

Pendientes:

- Relevar qué categorías/plantillas se usan realmente después de una compra storefront.
- Confirmar si el contenido y routing actual cubren:
  - orden recibida,
  - pago recibido,
  - cambios de estado,
  - avisos a administradores del sitio.

Hallazgo adicional:

- El wiring backend ya existe para estos eventos vía:
  - `EmailService`,
  - `NotificationOrchestratorService`,
  - `OrderPaymentSettlementService`.
- Lo que falta es validación operativa end-to-end y criterio final de activación por tenant/canal.

### 13. Emails de creación, validación y recuperación de cuenta

Estado relevado:

- Existe soporte real al menos para recuperación y cambio de contraseña:
  - [backend/src/storefront/security/storefront-security.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/security/storefront-security.service.ts)
  - [backend/src/auth/password-reset.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/auth/password-reset.service.ts)
  - [backend/src/email/templates/definitions.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/email/templates/definitions.ts)
- No quedó confirmado aún un flujo equivalente de:
  - bienvenida/alta de usuario storefront,
  - verificación explícita de cuenta.

Pendientes:

- Definir si el alta storefront requiere:
  - mail de bienvenida,
  - validación/verificación de correo,
  - confirmación por OTP/SMS,
  - o solo recuperación posterior.

Hallazgo adicional:

- Recuperación ya existe de forma real por:
  - email,
  - phone/OTP,
  - y soporte Google en backend.
- No quedó implementada todavía una verificación positiva de cuenta o un mail de bienvenida storefront.

### 14. Anonimización y protección de datos personales

Estado relevado:

- Ya existe protección para secretos sensibles de configuración mediante cifrado:
  - [backend/src/common/security/secure-config.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/common/security/secure-config.service.ts)
- También existe masking puntual en logs de seguridad para OTP:
  - [backend/src/storefront/security/storefront-security.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/security/storefront-security.service.ts)

Gap actual:

- No existe todavía una política general de anonimización/retención/depuración de datos personales de clientes.

Pendientes:

- Evaluar y definir:
  - masking sistemático en logs, timeline y auditoría,
  - políticas de retención,
  - anonimización para clientes inactivos o eliminados,
  - separación entre datos operativos y datos sensibles,
  - impacto en exports/reportes/admin.

Línea recomendada:

- Resolverlo como bloque transversal backend/admin antes de abrir automatizaciones o reporting amplio.
- Prioridades sugeridas:
  1. masking sistemático en logs y eventos de seguridad,
  2. revisión de PII visible en admin/exportes,
  3. política de retención/anulación anonimizada,
  4. housekeeping programado.

## Propuesta de implementación por olas

### Ola 1. Correcciones funcionales críticas

- pagos parciales en timeline
- unificación de monedas
- selector de idioma reactivo
- register/profile real
- filtro por precio

### Ola 2. Consistencia UX de storefront

- `Todas las categorías`
- contacto con layout real
- warnings React y márgenes

### Ola 3. Evolución paramétrica

- variantes configurables para paramétricos publicados
- alineación con presupuesto de aberturas en admin/backend

### Ola 4. Evolución visual/comercial

- stories de categorías

### Ola 5. Automatización browser y regresiones críticas

- extender la suite Playwright actual a:
  - `shop -> product detail -> cart` para paramétricos publicados
  - `checkout preview -> pago -> order detail`
  - flujo `cash` pendiente de confirmación
  - notificaciones cliente/admin
- agregar `data-testid` a las superficies críticas que aún no los tienen
- consolidar el criterio de selectores estables como parte del Definition of Done de cambios futuros

## Estado de este documento

- Relevamiento documentado.
- No todos los puntos fueron implementados en esta misma ronda.
- Debe usarse como backlog operativo del siguiente bloque storefront.
