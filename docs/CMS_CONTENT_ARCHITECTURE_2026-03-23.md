# CMS Content Architecture

Fecha: 2026-03-23

## Decisión

La arquitectura actual de `stories` ligada directamente a `Product` debe considerarse un MVP transitorio.

Para evolución real de contenido del sitio, la dirección recomendada es:

- desacoplar `stories` de `Product`,
- tratarlas como contenido CMS independiente,
- permitir asociación opcional a producto, categoría o URL libre,
- y abrir una nueva sección administrativa orientada a contenido, no a catálogo.

## Problema del modelo actual

Hoy `stories` depende de:

- `Product.storyEnabled`
- `Product.storyPriority`
- `ProductStoryAsset`

Eso funciona para un caso comercial simple, pero introduce restricciones innecesarias:

1. obliga a que toda story nazca desde un producto
2. dificulta comunicar contenido importante no ligado a catálogo
3. mezcla responsabilidades de merchandising y CMS
4. fuerza a que el ABM viva en producto, cuando conceptualmente es una pieza editorial
5. complica la evolución hacia nuevas secciones dinámicas del sitio

## Arquitectura recomendada

Crear un dominio CMS independiente, con esta lógica:

### 1. Entidad principal de contenido

`CmsEntry` o `CmsStory`

Campos base recomendados:

- `id`
- `slug`
- `title`
- `subtitle`
- `description`
- `status`
- `locale`
- `sectionKey`
- `priority`
- `isActive`
- `publishedAt`
- `startsAt`
- `endsAt`
- `ctaLabel`
- `ctaUrl`
- `productId` opcional
- `categoryId` opcional
- `createdBy`
- `updatedBy`

### 2. Assets asociados

`CmsEntryAsset` o `CmsStoryAsset`

Campos recomendados:

- `id`
- `entryId`
- `mediaType`
- `mediaUrl`
- `posterUrl`
- `title`
- `caption`
- `durationSec`
- `sortOrder`
- `isActive`

### 3. Sección CMS

`CmsSection`

No para modelar layout completo desde el primer día, sino para agrupar contenido reutilizable del sitio.

Campos mínimos recomendados:

- `id`
- `key`
- `name`
- `description`
- `isActive`
- `sortOrder`

Primer caso de uso:

- `HOME_STORIES`

Futuros casos:

- banners editoriales
- bloques institucionales
- promos estacionales
- landing teasers
- home highlights

## Relación con producto

La relación con producto debe pasar a ser opcional.

Eso permite:

- story puramente editorial sin producto
- story ligada a un producto concreto
- story ligada a una categoría
- story con destino libre a una URL del sitio o externa

En otras palabras:

- producto puede ser destino
- producto no debe ser contenedor del contenido

## Rol editorial

Conviene abrir un rol nuevo:

- `EDITOR`

Objetivo:

- gestionar contenido CMS
- sin dar acceso completo al dominio comercial/operativo

Esto exige revisar:

- enum `Role`
- guards
- navegación admin
- permisos de vistas CMS

Si el cambio de rol completo se quiere hacer por etapas, una transición razonable es:

1. habilitar la nueva sección CMS primero para `ADMIN` y `SUPERADMIN`
2. luego agregar `EDITOR` como rol específico

## Estrategia de migración recomendada

### Fase 1

- mantener el modelo actual funcionando
- crear nuevo dominio CMS independiente
- exponer nueva API storefront para contenido CMS

### Fase 2

- mover el rail de home a la nueva fuente CMS
- dejar compatibilidad temporal con `ProductStoryAsset`

### Fase 3

- agregar sección admin `CMS`
- mover edición de stories fuera de producto

### Fase 4

- migrar datos existentes desde `ProductStoryAsset` hacia el nuevo modelo
- deprecar `Product.storyEnabled`, `Product.storyPriority` y `ProductStoryAsset`

## Recomendación concreta

La decisión correcta a futuro es:

- no seguir ampliando `ProductStoryAsset` como arquitectura principal,
- usarlo solo como puente transitorio,
- y construir una capa CMS independiente, reusable y orientada a contenido.

## Impacto esperado

Esto mejora:

- mantenibilidad
- claridad conceptual
- escalabilidad de contenido
- separación entre catálogo y CMS
- facilidad para agregar futuras secciones dinámicas sin contaminar `Product`
