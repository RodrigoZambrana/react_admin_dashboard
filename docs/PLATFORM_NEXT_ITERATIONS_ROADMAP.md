# Platform Next Iterations Roadmap

## Objetivo

Ordenar las siguientes iteraciones del sistema sobre tres productos base:

- CMS y gestión de contenidos
- gestión de canales y chat, incluyendo conector Meta
- ecommerce

Y dejar separadas como capa posterior las integraciones de growth/insights:

- Google Ads
- Google Analytics
- Google Search Console
- Meta Ads
- herramientas de contenido de Meta

## Criterio de priorización

La prioridad se define por:

1. impacto directo en continuidad operativa real
2. capacidad de no perder información
3. cierre de estructuras base reutilizables
4. valor comercial visible para cotización, ecommerce y contenido
5. integraciones de growth luego de estabilizar el core

## Prioridad 1

### 0. Ciclo profundo de evaluación y ajuste del webchat

Problema:

- el agente ya tiene una base usable, pero todavía falla en foco, continuidad temática y cambio de contexto
- hoy no existe una disciplina explícita de prueba y re-prueba sobre conversaciones reales hasta acercarse al nivel esperado

Resultado buscado:

- un loop repetible de corpus real -> evaluación -> ajuste -> re-prueba
- una definición clara de límites entre lo que resuelve el agente y lo que sigue el operador

Diseño recomendado:

- usar el corpus real de WhatsApp como benchmark principal
- medir por conversación y por turno:
  - coherencia
  - continuidad
  - correctitud
  - cambio de tema
  - resolución de intención
  - cierre útil
- clasificar desvíos por familia de error
- corregir primero estado/contexto/taxonomía y después wording
- incorporar fallback mínimo universal cuando no se llegue a una resolución final

### 1. Reconciliación y continuidad de WhatsApp después de desconexión o restore

Problema:

- si la sesión QR se desconecta, se religa o se restaura el teléfono sin backup cloud, el historial expuesto por el proveedor puede cambiar o desaparecer parcialmente
- el sistema no puede asumir que la vista remota del dispositivo es la única fuente de verdad

Resultado buscado:

- si el mismo número vuelve a escribir, el sistema debe preservar continuidad del lado interno
- el historial ya persistido no debe perderse aunque el canal remoto vuelva “vacío”
- cuando sea posible, debe hacerse merge y no duplicación

Diseño recomendado:

- separar identidad canónica del cliente de las identidades del canal
- persistir aliases de identidad del canal:
  - teléfono normalizado
  - JIDs históricos (`@lid`, `@s.whatsapp.net`)
  - thread ids observados
- distinguir entre:
  - `provider message`
  - `system-persisted message`
  - `reconciled message`

Regla de merge:

- el sistema nunca borra mensajes internos porque el proveedor ya no los muestre
- si el mismo usuario reingresa con número equivalente, se reusa la conversación/customer thread cuando la identidad canónica matchee
- los mensajes remotos nuevos se anexan y se reconcilian; los antiguos internos quedan como historial válido del sistema

Fuente de verdad:

- CRM/backend: historial persistido y customer identity
- canal QR: fuente de eventos nuevos y metadata operacional

Pendientes técnicos naturales:

- tabla o estructura explícita de `channel identity aliases`
- proceso de `reconciliation run` por reconnect
- política visible para casos `provider_missing / system_only / merged`

### 2. Locale e idioma del chat según el usuario

Problema:

- el storefront ya tiene infraestructura de locale, pero el chat todavía necesita un criterio unificado entre canal, sesión, customer y runtime

Resultado buscado:

- el agente responde en el idioma correcto del usuario sin mezclar idioma operativo interno

Precedencia recomendada:

1. preferencia explícita de sesión/customer
2. idioma detectado en el canal o mensaje
3. locale ya persistido en storefront/webchat
4. tenant default

Regla:

- el runtime decide intención y flujo
- la capa de presentación decide idioma final del mensaje
- los procesos internos pueden mantenerse en locale operativo distinto si hace falta

Base existente a reutilizar:

- [ecommerce/src/state/i18n-context.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/state/i18n-context.tsx)
- [ecommerce/src/state/session-context.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/state/session-context.tsx)
- [backend/src/conversations/dto/create-webchat-session.dto.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/conversations/dto/create-webchat-session.dto.ts)

### 3. Moneda de respuesta del chat según la moneda del usuario

Problema:

- el ecommerce ya tiene conversión y preferencia de moneda, pero el chat todavía necesita una resolución única para mostrar precios/cotizaciones sin duplicar lógica

Resultado buscado:

- el chat muestra montos en la moneda esperada por el usuario
- el backend sigue conservando moneda canónica de pricing/quote

Precedencia recomendada:

1. preferencia explícita del usuario
2. moneda persistida en storefront/session
3. customer profile
4. heurística por país/mercado
5. moneda base del tenant

Regla:

- el backend resuelve precio y moneda canónica
- la presentación del chat puede convertir para display usando snapshot FX consistente
- nunca se cambia silenciosamente la moneda fuente de una cotización persistida

Base existente a reutilizar:

- [ecommerce/src/state/currency-context.tsx](/Users/rodrigo/git/personal/react_admin_dashboard/ecommerce/src/state/currency-context.tsx)
- [backend/src/storefront/storefront.service.ts](/Users/rodrigo/git/personal/react_admin_dashboard/backend/src/storefront/storefront.service.ts)

### 4. Scopes persistidos de CMS

Problema:

- hoy la separación `General Site / Storefront` ya existe a nivel de menú/admin, pero todavía se apoya en convención por path

Resultado buscado:

- scope persistido y explícito en CMS

Diseño recomendado:

- agregar enum de dominio/experiencia en `CmsPage`
  - `GENERAL`
  - `STORE`
- usarlo en:
  - admin filters
  - navegación
  - importadores
  - preview/publicación
  - futuras librerías de componentes

Regla:

- el scope no cambia el render por sí mismo
- define ownership, editor UX y capacidad de reutilización

## Prioridad 2

### 5. Frequently bought together e instalación sugerida como parte de compra

Problema:

- instalación hoy ya tiene política estructurada, pero todavía no está modelada como relación comercial reusable dentro del ecommerce

Resultado buscado:

- sugerir instalación como add-on cuando corresponda
- soportar también otros bundles frecuentes

Diseño recomendado:

- introducir estructura general de relaciones entre productos:
  - `ACCESSORY`
  - `SERVICE_ADD_ON`
  - `CROSS_SELL`
  - `FREQUENTLY_BOUGHT_TOGETHER`
- permitir relaciones por:
  - producto
  - categoría
  - override puntual

Caso instalación:

- puede resolverse como producto/servicio relacionado
- debe poder convivir con las políticas ya modeladas de instalación
- la relación puede sugerirse:
  - en detalle de producto
  - en carrito
  - en cierre de cotización/chat

Regla:

- la sugerencia es capa comercial
- la decisión de pricing/inclusión sigue viniendo de la política estructurada de instalación

## Prioridad 3

### 6. Integraciones de growth e insights

Objetivo:

- convertir al sistema en fuente de decisión para contenido, performance comercial y canales

Capas deseables:

- Google Analytics
- Google Search Console
- Google Ads
- Meta Ads
- herramientas de contenido y publicación de Meta

Resultado esperado:

- no vivir como integraciones sueltas
- quedar agrupadas como superficie de `Growth / Insights`

Regla:

- primero estabilizar core operativo:
  - CMS
  - canales/chat
  - ecommerce
- luego enchufar growth sobre fuentes consistentes

## Orden recomendado de siguientes iteraciones

1. ciclo profundo de evaluación y ajuste del webchat
2. `CmsPage` con scope persistido `GENERAL | STORE`
3. resolución unificada de locale/moneda para chat
4. reconciliación de WhatsApp QR después de reconnect/restore
5. relaciones `frequently bought together` + instalación como add-on sugerible
6. capa `Growth / Insights` para Google y Meta

## Resultado esperado al final

### CMS y gestión de contenidos

- páginas y componentes con ownership claro
- recursos reutilizables configurables
- separación formal entre sitio general y tienda

### Gestión de canales y chat / conector Meta

- WhatsApp QR robusto ante reconexión y restauración
- Meta activo como canal oficial para Facebook e Instagram
- locale/moneda consistentes por usuario
- criterio explícito de alcance conversacional y fallback hacia operador

### Ecommerce

- bundles y relaciones de producto reutilizables
- instalación sugerible como parte de la compra
- personalización comercial sin duplicar lógica
