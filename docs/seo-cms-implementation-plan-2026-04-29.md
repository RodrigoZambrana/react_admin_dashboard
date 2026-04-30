# Implementación SEO + Contenido Usando Exclusivamente el CMS

Fecha: 2026-04-29

Fuente operativa única:

- [SEO + Analytics Consolidated Brief](/Users/rodrigo/Git/personal/react_admin_dashboard/docs/seo-analytics-consolidated-2026-04-29.md)

Este plan traduce el brief consolidado a acciones ejecutables en el CMS actual. La regla de diseño es estricta:

- todo contenido nuevo o modificado debe vivir en CMS;
- no se debe tocar frontend para cargar texto, metadata ni estructura editorial;
- si el CMS no alcanza, se documenta el gap y se propone una extensión mínima;
- cada recomendación se mapea a una entidad concreta del CMS.

## 0. Capacidades reales del CMS hoy

### Lo que sí existe

El CMS actual ya soporta:

- `CmsPage` con `path`, `title`, `summary`, `seoTitle`, `seoDescription`, `seoImageUrl`, `layoutKey`, `legacySource`, `status`, `visible`, `locale`.
- `CmsPageAlias` para rutas alternativas.
- `CmsPageSection` con `type`, `key`, `name`, `sortOrder`, `visible`, `settings`.
- `CmsPageBlock` con `type`, `key`, `name`, `sortOrder`, `visible`, `content`, `mediaId`.
- `CmsMedia` para imágenes, video y embeds.
- secciones de página ya renderizadas por el storefront:
  - `HERO`
  - `FEATURE_GRID`
  - `MEDIA_GRID`
  - `MEDIA_CAROUSEL`
  - `CONTENT_SPLIT`
  - `RICH_TEXT`
  - `FAQ`
  - `CTA_BANNER`
  - `BUDGET_CALCULATOR`

### Lo que no existe hoy

No hay, en el modelo actual:

- relación padre-hijo entre páginas CMS;
- campo explícito `related_content`;
- campo explícito para JSON-LD configurable por página;
- menú de navegación administrable desde CMS;
- un bloque específico para pricing, urgency o service coverage;
- un bloque de comparación especializado;
- un campo nativo de schema FAQ;
- estructura jerárquica de páginas en el árbol CMS.

Conclusión operativa:

- el plan puede ejecutarse casi completo con `CmsPage`, `CmsPageSection` y `CmsPageBlock`;
- las extensiones mínimas necesarias son relacionalidad y un campo estructurado para schema/relación editorial;
- no hace falta rediseñar el CMS.

### Mapeo de campos solicitado vs modelo real

- `seo.title` -> `CmsPage.seoTitle`
- `seo.description` -> `CmsPage.seoDescription`
- `page.slug` -> `CmsPage.path`
- `page.h1` -> `HERO.settings.title` o `HERO.blocks[0].title` según el template
- `hero.title` -> `HERO.settings.title`
- `hero.subtitle` -> `HERO.settings.description`
- `hero.cta` -> `HERO.settings.primaryCtaLabel` + `HERO.settings.primaryCtaHref`
- `content.blocks` -> `CmsPageSection.blocks`

## 1. Implementación por URL

### 1.1 `/productos/cortinas-de-enrollar.html`

#### A. Campos CMS a completar o modificar

- `CmsPage.path` = `/productos/cortinas-de-enrollar.html`
- `CmsPage.title` = `Cortinas de enrollar`
- `CmsPage.summary` = `Soluciones en cortinas de enrollar en PVC y aluminio, con instalación y asesoramiento a medida.`
- `CmsPage.seoTitle` = `Cortinas de enrollar en Uruguay | PVC, aluminio y a medida`
- `CmsPage.seoDescription` = `Descubrí cortinas de enrollar en PVC y aluminio. Medidas, instalación, mantenimiento y asesoramiento para elegir la opción correcta.`
- `CmsPage.layoutKey` = `landing-default`
- `CmsPage.status` = `PUBLISHED`
- `CmsPage.visible` = `true`

#### B. Estructura de bloques CMS

- `HERO`
- `FEATURE_GRID`
- `CONTENT_SPLIT`
- `FAQ`
- `CTA_BANNER`

#### C. Contenido exacto por bloque

##### `HERO`

- `eyebrow`: `Cortinas de enrollar`
- `title`: `Cortinas de enrollar en PVC y aluminio`
- `description`: `Elegí una solución a medida para seguridad, aislación y uso cotidiano. Compará materiales, medidas e instalación antes de decidir.`
- `primaryCtaLabel`: `Solicitar asesoramiento`
- `primaryCtaHref`: `/contacto.html`
- `secondaryCtaLabel`: `Ver reparación`
- `secondaryCtaHref`: `/servicios/reparacion-cortinas-y-persianas.html`

##### `FEATURE_GRID`

Bloque 1

- `content.title`: `PVC o aluminio`
- `content.body`: `Compará resistencia, mantenimiento, estética y comportamiento térmico para elegir con criterio.`

Bloque 2

- `content.title`: `A medida`
- `content.body`: `Se adapta a aberturas existentes y a proyectos nuevos con asesoramiento técnico.`

Bloque 3

- `content.title`: `Instalación`
- `content.body`: `La solución se puede cotizar con instalación incluida o como servicio separado según el caso.`

Bloque 4

- `content.title`: `Mantenimiento`
- `content.body`: `Incluye recomendaciones para limpieza, uso y durabilidad del sistema.`

##### `CONTENT_SPLIT`

- `settings.mediaPosition`: `end`
- `settings.imageAlt`: `Cortina de enrollar instalada`
- `settings.imageUrl`: media CMS cargada para la familia
- `block.content`:
  - `title`: `Qué incluye esta página`
  - `body`: `Esta página reúne la información que el usuario necesita antes de pedir presupuesto: materiales, usos, instalación, mantenimiento y preguntas frecuentes. El objetivo es que el contenido responda mejor a la intención transaccional que hoy llega desde Search Console.`

##### `FAQ`

Bloque 1

- `content.question`: `¿Qué conviene elegir: PVC o aluminio?`
- `content.body`: `El PVC prioriza facilidad de mantenimiento y una percepción más cálida. El aluminio prioriza resistencia y una estética más robusta. La mejor opción depende del uso, exposición y presupuesto.`

Bloque 2

- `content.question`: `¿Se puede instalar sobre una abertura existente?`
- `content.body`: `Sí, en la mayoría de los casos se puede evaluar una instalación compatible con la estructura existente.`

Bloque 3

- `content.question`: `¿Qué mantenimiento requieren?`
- `content.body`: `Limpieza periódica, revisión de guías y cuidado del accionamiento son las bases para alargar la vida útil.`

##### `CTA_BANNER`

- `settings.title`: `¿Querés que te ayudemos a elegir?`
- `settings.description`: `Pedí asesoramiento y definí si conviene PVC, aluminio o una alternativa combinada.`
- `settings.actions[0].label`: `Contactar ahora`
- `settings.actions[0].href`: `/contacto.html`

#### D. Regla editorial

- todo el copy debe vivir en campos CMS;
- no se debe resolver la comparación con texto fijo en frontend;
- si hay variantes de contenido, deben quedar como bloques editables.

---

### 1.2 `/productos/persianas-de-enrollar.html`

#### A. Campos CMS a completar o modificar

- `CmsPage.path` = `/productos/persianas-de-enrollar.html`
- `CmsPage.title` = `Persianas de enrollar`
- `CmsPage.summary` = `Persianas de enrollar en PVC y aluminio, con guía de compra y comparación por uso.`
- `CmsPage.seoTitle` = `Persianas de enrollar | PVC, aluminio y medidas`
- `CmsPage.seoDescription` = `Conocé las opciones de persianas de enrollar, diferencias por material, medidas, instalación y mantenimiento.`
- `CmsPage.layoutKey` = `landing-default`
- `CmsPage.status` = `PUBLISHED`
- `CmsPage.visible` = `true`

#### B. Estructura de bloques CMS

- `HERO`
- `FEATURE_GRID`
- `CONTENT_SPLIT`
- `FAQ`
- `CTA_BANNER`

#### C. Contenido exacto por bloque

##### `HERO`

- `eyebrow`: `Familia persianas`
- `title`: `Persianas de enrollar para uso residencial y comercial`
- `description`: `Una página madre para concentrar la intención genérica de persianas, ordenar variantes y evitar fuga a páginas vecinas.`
- `primaryCtaLabel`: `Ver opciones`
- `primaryCtaHref`: `/contacto.html`

##### `FEATURE_GRID`

Bloque 1

- `content.title`: `PVC`
- `content.body`: `Más simple de mantener y útil cuando la prioridad es funcionalidad diaria.`

Bloque 2

- `content.title`: `Aluminio`
- `content.body`: `Mejor opción cuando la resistencia y la percepción de solidez pesan más en la decisión.`

Bloque 3

- `content.title`: `Medidas`
- `content.body`: `La medida correcta cambia la solución; esta familia debe explicarlo antes de llevar al contacto.`

Bloque 4

- `content.title`: `Instalación`
- `content.body`: `La decisión comercial depende de si la instalación es nueva, de recambio o con adaptación.`

##### `CONTENT_SPLIT`

- `block.content.title`: `Qué problema resuelve`
- `block.content.body`: `Ordena la búsqueda genérica de persianas para que el usuario compare material, uso e instalación sin salir del sitio.`

##### `FAQ`

Bloque 1

- `content.question`: `¿Esta página cubre persianas de PVC?`
- `content.body`: `Sí, como parte de la familia de persianas de enrollar.`

Bloque 2

- `content.question`: `¿También cubre aluminio?`
- `content.body`: `Sí, con una comparación orientada a la decisión.`

Bloque 3

- `content.question`: `¿Sirve como landing principal de la familia?`
- `content.body`: `Sí, esa es la función editorial recomendada.`

##### `CTA_BANNER`

- `settings.title`: `Pedí orientación para tu medida`
- `settings.description`: `Contanos el uso y la abertura para recomendar la opción más conveniente.`
- `settings.actions[0].label`: `Solicitar ayuda`
- `settings.actions[0].href`: `/contacto.html`

#### D. Regla editorial

- esta página debe funcionar como nodo madre de la familia `persianas`;
- no debe competir con `/productos/cortinas-de-enrollar.html`, sino complementarla.

---

### 1.3 `/productos/cortinas-de-enrollar-pvc.html`

#### A. Campos CMS a completar o modificar

- `CmsPage.path` = `/productos/cortinas-de-enrollar-pvc.html`
- `CmsPage.title` = `Cortinas de enrollar en PVC`
- `CmsPage.summary` = `Cortinas de enrollar en PVC con foco en mantenimiento, precio y uso diario.`
- `CmsPage.seoTitle` = `Cortinas de enrollar PVC | Precio, medidas e instalación`
- `CmsPage.seoDescription` = `Conocé las cortinas de enrollar en PVC, su comparativa con aluminio, medidas, instalación y preguntas frecuentes.`
- `CmsPage.layoutKey` = `landing-default`
- `CmsPage.status` = `PUBLISHED`
- `CmsPage.visible` = `true`

#### B. Estructura de bloques CMS

- `HERO`
- `FEATURE_GRID`
- `CONTENT_SPLIT`
- `FAQ`
- `CTA_BANNER`

#### C. Contenido exacto por bloque

##### `HERO`

- `eyebrow`: `PVC`
- `title`: `Cortinas de enrollar en PVC`
- `description`: `Una opción pensada para quienes priorizan mantenimiento simple, uso cotidiano y una decisión comercial clara.`
- `primaryCtaLabel`: `Pedir presupuesto`
- `primaryCtaHref`: `/contacto.html`

##### `FEATURE_GRID`

Bloque 1

- `content.title`: `Mantenimiento`
- `content.body`: `El PVC reduce fricción en el argumento comercial cuando el usuario busca practicidad y cuidado simple.`

Bloque 2

- `content.title`: `Precio`
- `content.body`: `La página debe explicar el valor sin prometer números fijos si el CMS no tiene tabla editable de precios.`

Bloque 3

- `content.title`: `Instalación`
- `content.body`: `Debe aclarar si la instalación se cotiza aparte o integrada al proyecto.`

Bloque 4

- `content.title`: `Comparativa`
- `content.body`: `La comparación con aluminio tiene que estar visible y no escondida en una nota secundaria.`

##### `CONTENT_SPLIT`

- `block.content.title`: `Por qué crear esta pieza`
- `block.content.body`: `El reporte muestra volumen y CTR bajo en esta intención. El contenido debe resolver la duda de material y el siguiente paso comercial.`

##### `FAQ`

Bloque 1

- `content.question`: `¿PVC o aluminio?`
- `content.body`: `PVC para mantenimiento simple; aluminio para resistencia y presencia estructural.`

Bloque 2

- `content.question`: `¿Sirve para reemplazo o solo obra nueva?`
- `content.body`: `Puede plantearse en ambos contextos según la condición de la abertura.`

Bloque 3

- `content.question`: `¿Se puede pedir sin instalación?`
- `content.body`: `Sí, siempre que el modelo de negocio lo permita en el CMS o en la operación comercial.`

##### `CTA_BANNER`

- `settings.title`: `Pedí cotización para PVC`
- `settings.description`: `Enviá medidas y contexto de uso para recibir una orientación concreta.`
- `settings.actions[0].label`: `Cotizar ahora`
- `settings.actions[0].href`: `/contacto.html`

#### D. Regla editorial

- el contenido debe dejar clara la diferencia entre esta URL y la landing madre de persianas;
- no se debe usar el frontend para “simular” comparativas que el CMS no expone.

---

### 1.4 `/servicios/reparacion-cortinas-y-persianas.html`

#### A. Campos CMS a completar o modificar

- `CmsPage.path` = `/servicios/reparacion-cortinas-y-persianas.html`
- `CmsPage.title` = `Reparación de cortinas y persianas`
- `CmsPage.summary` = `Servicio de reparación con foco en urgencia, cobertura y disponibilidad.`
- `CmsPage.seoTitle` = `Reparación de cortinas y persianas | Servicio urgente`
- `CmsPage.seoDescription` = `Solucioná fallas en cortinas y persianas con un servicio de reparación que explique cobertura, tiempos y disponibilidad.`
- `CmsPage.layoutKey` = `landing-default`
- `CmsPage.status` = `PUBLISHED`
- `CmsPage.visible` = `true`

#### B. Estructura de bloques CMS

- `HERO`
- `FEATURE_GRID`
- `CONTENT_SPLIT`
- `FAQ`
- `CTA_BANNER`

#### C. Contenido exacto por bloque

##### `HERO`

- `eyebrow`: `Servicio urgente`
- `title`: `Reparación de cortinas y persianas`
- `description`: `Cuando la cortina falla, el contenido tiene que responder rápido: qué reparan, dónde atienden, cuánto demoran y cómo contactar.`
- `primaryCtaLabel`: `Solicitar reparación`
- `primaryCtaHref`: `/contacto.html`
- `secondaryCtaLabel`: `Ver cortinas`
- `secondaryCtaHref`: `/productos/cortinas-de-enrollar.html`

##### `FEATURE_GRID`

Bloque 1

- `content.title`: `Urgencia`
- `content.body`: `La página debe comunicar respuesta rápida sin prometer tiempos no operativos.`

Bloque 2

- `content.title`: `Cobertura`
- `content.body`: `La zona de atención debe quedar visible y editable.`

Bloque 3

- `content.title`: `Fallas comunes`
- `content.body`: `Debe explicar roturas, trabas, desgaste y problemas de accionamiento.`

Bloque 4

- `content.title`: `Contacto directo`
- `content.body`: `El CTA tiene que resolver el siguiente paso sin fricción.`

##### `CONTENT_SPLIT`

- `block.content.title`: `Qué incluye el servicio`
- `block.content.body`: `Diagnóstico, reparación y orientación sobre si conviene arreglar, reemplazar o migrar a otra solución.`

##### `FAQ`

Bloque 1

- `content.question`: `¿Atienden urgencias?`
- `content.body`: `Sí, si la operación lo permite, y debe indicarse en el CMS con claridad.`

Bloque 2

- `content.question`: `¿Qué zonas cubren?`
- `content.body`: `La cobertura debe mantenerse editable para no depender de texto fijo en frontend.`

Bloque 3

- `content.question`: `¿Cuánto demoran?`
- `content.body`: `Los tiempos deben publicarse como campo CMS y nunca como promesa hardcodeada.`

##### `CTA_BANNER`

- `settings.title`: `Necesito reparar ahora`
- `settings.description`: `Dejá tu contacto y el detalle de la falla para priorizar la solicitud.`
- `settings.actions[0].label`: `Pedir asistencia`
- `settings.actions[0].href`: `/contacto.html`

#### D. Regla editorial

- esta página es la que más valor CRO puede generar sin tocar frontend;
- el texto de urgencia, cobertura y tiempos debe ser editable en CMS.

## 2. Expansión de contenido

### 2.1 `/productos/persianas/`

- `content_type`: `page`
- `slug`: `/productos/persianas/`
- `parent`: `/productos/`
- `template CMS`: `landing-default`
- `bloques requeridos`: `HERO`, `FEATURE_GRID`, `CONTENT_SPLIT`, `FAQ`, `CTA_BANNER`
- `intención de búsqueda`: familia de producto / navegación transaccional
- `keywords`: `persianas`, `persianas de enrollar`, `persianas pvc`, `persianas aluminio`

#### Contenido base

- `HERO.title`: `Persianas`
- `HERO.description`: `Página madre de la familia de persianas para ordenar variantes, uso y materiales.`
- `FEATURE_GRID`: PVC, aluminio, medidas, instalación
- `FAQ`: diferencia entre materiales, uso residencial/comercial, mantenimiento
- `CTA_BANNER`: asesoramiento y contacto

### 2.2 `/guias/cortinas-pvc-vs-aluminio`

- `content_type`: `article`
- `slug`: `/guias/cortinas-pvc-vs-aluminio`
- `parent`: `/guias/`
- `template CMS`: `landing-default`
- `bloques requeridos`: `HERO`, `RICH_TEXT`, `FEATURE_GRID`, `FAQ`, `CTA_BANNER`
- `intención de búsqueda`: comparativa informativa con intención de decisión
- `keywords`: `PVC vs aluminio`, `cortinas de enrollar pvc`, `cortinas de enrollar aluminio`, `comparativa`

#### Contenido base

- comparación por durabilidad, mantenimiento, estética, aislamiento, costo relativo y uso recomendado
- cierre editorial a las landings de producto

### 2.3 `/precios/cortinas-de-enrollar`

- `content_type`: `landing`
- `slug`: `/precios/cortinas-de-enrollar`
- `parent`: `/precios/`
- `template CMS`: `landing-default`
- `bloques requeridos`: `HERO`, `RICH_TEXT`, `FEATURE_GRID`, `FAQ`, `CTA_BANNER`
- `intención de búsqueda`: transaccional / precio
- `keywords`: `precio cortinas de enrollar`, `cortinas de enrollar precio`, `cortinas pvc precio`, `cortinas aluminio precio`

#### Contenido base

- cómo se compone el precio
- qué variables lo mueven
- qué conviene medir antes de pedir presupuesto
- CTA a cotización

### 2.4 `/servicios/reparacion-urgente`

- `content_type`: `landing`
- `slug`: `/servicios/reparacion-urgente`
- `parent`: `/servicios/`
- `template CMS`: `landing-default`
- `bloques requeridos`: `HERO`, `FEATURE_GRID`, `CONTENT_SPLIT`, `FAQ`, `CTA_BANNER`
- `intención de búsqueda`: urgencia / servicio inmediato
- `keywords`: `reparación urgente`, `arreglo de persianas`, `arreglo de cortinas`, `servicio urgente`

#### Contenido base

- urgencia, zonas, tiempos, fallas frecuentes, CTA directo

## 3. Arquitectura del sitio desde CMS

### 3.1 Navegación principal

Hoy la navegación no está modelada como CMS editable. Eso es un gap.

#### Solución mínima

- crear `CmsNavigation` o reutilizar `Setting` con estructura JSON versionada;
- cada item debe poder apuntar a `CmsPage.path` o `CmsPageAlias.path`;
- permitir `primary`, `secondary` y `footer`.

#### Propuesta de menú

- Inicio
- Cortinas de enrollar
- Persianas
- Aberturas
- Toldos y cerramientos
- Reparación
- Guías
- Contacto

### 3.2 Categorías / padres / hijos

La jerarquía no existe en `CmsPage` hoy.

#### Propuesta de jerarquía editorial

- familia madre `persianas`
  - `/productos/persianas/`
  - `/productos/cortinas-de-enrollar.html`
  - `/productos/cortinas-de-enrollar-pvc.html`
  - `/precios/cortinas-de-enrollar`
- familia madre `reparacion`
  - `/servicios/reparacion-cortinas-y-persianas.html`
  - `/servicios/reparacion-urgente`
- familia madre `guias`
  - `/guias/cortinas-pvc-vs-aluminio`

#### Solución mínima de CMS

- agregar `parentPageId` a `CmsPage`;
- agregar `pageType` o `contentType` para diferenciar `page`, `landing`, `article`, `service`;
- mantener `path` como fuente pública.

### 3.3 Reglas de interlinking

#### Deben existir vía CMS

- `related_content` editable por página;
- links manuales dentro de `RICH_TEXT` o `CTA_BANNER`;
- bloques de `FEATURE_GRID` con hrefs;
- bloques de recomendación editorial con enlaces a páginas vecinas.

#### Regla operativa

- toda landing importante debe enlazar a:
  - una comparación,
  - un servicio relacionado,
  - una guía,
  - la página madre de la familia.

## 4. Mejores CTR vía metadata CMS

### 4.1 Titles y descriptions

#### `/productos/cortinas-de-enrollar.html`

- `seo.title`: `Cortinas de enrollar en Uruguay | PVC, aluminio y a medida`
- `seo.description`: `Elegí cortinas de enrollar en PVC o aluminio con guía de compra, medidas, instalación, mantenimiento y asesoramiento.`

#### `/productos/persianas-de-enrollar.html`

- `seo.title`: `Persianas de enrollar | PVC, aluminio y medidas`
- `seo.description`: `Conocé las persianas de enrollar, compará materiales y definí la opción adecuada para tu proyecto.`

#### `/productos/cortinas-de-enrollar-pvc.html`

- `seo.title`: `Cortinas de enrollar PVC | Precio, medidas e instalación`
- `seo.description`: `Conocé las cortinas de enrollar en PVC, su comparativa con aluminio y cómo pedir cotización.`

#### `/servicios/reparacion-cortinas-y-persianas.html`

- `seo.title`: `Reparación de cortinas y persianas | Servicio urgente`
- `seo.description`: `Servicio de reparación con urgencia, cobertura editable, tiempos de respuesta y CTA directo.`

### 4.2 FAQ schema

Hoy el CMS no expone un campo nativo para JSON-LD por página.

#### Extensión mínima recomendada

- agregar `CmsPage.seoJsonLd` como `Json?`;
- o agregar `CmsPageSection.settings.schemaType` con autogeneración para `FAQ`.

#### Preferencia

- preferible `seoJsonLd` en `CmsPage` para dejar abierto `FAQ`, `BreadcrumbList`, `Article` y `CollectionPage`.

### 4.3 Campos estructurados disponibles

Se puede resolver hoy con:

- `seoTitle`
- `seoDescription`
- `seoImageUrl`
- `layoutKey`
- `aliases`

No se puede resolver hoy con:

- `jsonLd` por página;
- `canonicalPath` editable;
- `openGraph` granular por página.

## 5. CRO desde CMS sin tocar frontend

### 5.1 Bloques nuevos necesarios

El CMS actual ya tiene secciones suficientes para casi todo. Si se quiere optimizar sin forzar semántica, conviene extender con bloques estándar de uso editorial:

- `ComparisonBlock`
- `PricingHintBlock`
- `UrgencyBlock`
- `ServiceCoverageBlock`

### 5.2 Estructura de datos propuesta

#### `ComparisonBlock`

- `title`
- `intro`
- `rows[]`
  - `label`
  - `optionA`
  - `optionB`
  - `note`
- `ctaLabel`
- `ctaHref`

#### `PricingHintBlock`

- `title`
- `intro`
- `items[]`
  - `label`
  - `value`
  - `note`
- `disclaimer`
- `ctaLabel`
- `ctaHref`

#### `UrgencyBlock`

- `title`
- `body`
- `responseTime`
- `coverageNote`
- `ctaLabel`
- `ctaHref`

#### `ServiceCoverageBlock`

- `title`
- `body`
- `areas[]`
- `hours`
- `notes`
- `ctaLabel`
- `ctaHref`

### 5.3 Contenido ejemplo

#### `ComparisonBlock`

- `title`: `PVC vs aluminio`
- `intro`: `Elegí según mantenimiento, resistencia y tipo de uso.`
- `rows`:
  - `label`: `Mantenimiento`
  - `optionA`: `Más simple`
  - `optionB`: `Más robusto`
  - `note`: `Depende de la exposición y la frecuencia de uso`

#### `PricingHintBlock`

- `title`: `Qué mueve el precio`
- `items`:
  - `label`: `Material`
  - `value`: `PVC / aluminio`
  - `note`: `Afecta durabilidad y percepción final`
  - `label`: `Medidas`
  - `value`: `Ancho y alto`
  - `note`: `Impacta el total presupuestado`

#### `UrgencyBlock`

- `title`: `Reparación urgente`
- `body`: `Si la cortina quedó trabada o dañada, priorizamos una respuesta rápida.`
- `responseTime`: `A definir por operación`
- `coverageNote`: `Cobertura editable desde CMS`

#### `ServiceCoverageBlock`

- `title`: `Cobertura de reparación`
- `areas`: `Montevideo`, `Canelones`, `Maldonado`
- `hours`: `A definir por operación`
- `notes`: `Editar según capacidad real`

### 5.4 Impacto en conversión

- `ComparisonBlock` reduce fricción de elección.
- `PricingHintBlock` anticipa objeciones sobre presupuesto.
- `UrgencyBlock` mejora leads de reparación.
- `ServiceCoverageBlock` mejora confianza y reduce abandono.

### 5.5 Foco especial en reparación

La URL `/servicios/reparacion-cortinas-y-persianas.html` debe incluir obligatoriamente:

- urgencia como campo CMS;
- cobertura como lista editable;
- tiempos como campo CMS;
- CTA directo configurable.

## 6. Gap del CMS

### Gap 1: no hay navegación administrable desde CMS

- **Impacto SEO/CRO**: alto, porque la arquitectura editorial no puede cambiarse sin tocar config o frontend.
- **Solución mínima**: `CmsNavigation` o `Setting` con JSON versionado.
- **Prioridad**: alta.

### Gap 2: no hay jerarquía padre-hijo

- **Impacto SEO/CRO**: alto, porque no hay un árbol editorial explícito.
- **Solución mínima**: `parentPageId` en `CmsPage`.
- **Prioridad**: alta.

### Gap 3: no hay relaciones entre contenidos

- **Impacto SEO/CRO**: alto, porque el interlinking depende de hardcode o de bloques sueltos.
- **Solución mínima**: `relatedPageIds` o tabla `CmsPageRelation`.
- **Prioridad**: alta.

### Gap 4: no hay JSON-LD editable por página

- **Impacto SEO/CRO**: medio-alto, porque limita FAQ schema y otras estructuras.
- **Solución mínima**: `seoJsonLd` en `CmsPage`.
- **Prioridad**: media-alta.

### Gap 5: no hay bloques especializados para pricing, urgency y coverage

- **Impacto SEO/CRO**: medio, porque hoy se puede simular con `RICH_TEXT`, pero queda menos gobernable.
- **Solución mínima**: bloques reutilizables nuevos o un bloque genérico `CONTENT_WIDGET` con `variant`.
- **Prioridad**: media.

## 7. Priorización ejecutable

### Fase 1: impacto alto, esfuerzo bajo

1. Editar `seoTitle`, `seoDescription`, `summary`, `title` y bloques `HERO` de:
   - `/productos/cortinas-de-enrollar.html`
   - `/productos/cortinas-de-enrollar-pvc.html`
   - `/servicios/reparacion-cortinas-y-persianas.html`
   - `/productos/aberturas-aluminio.html`
2. Crear `/productos/persianas-de-enrollar.html` como landing de familia.
3. Añadir `FAQ` editable en las cuatro URLs prioritarias.
4. Añadir `CTA_BANNER` con CTA directo a contacto.

#### Dependencias

- ninguna, salvo que la página exista ya en CMS.

### Fase 2: impacto alto, esfuerzo medio

1. Crear:
   - `/productos/persianas/`
   - `/guias/cortinas-pvc-vs-aluminio`
   - `/precios/cortinas-de-enrollar`
   - `/servicios/reparacion-urgente`
2. Incorporar bloques editoriales de comparación y pricing hint.
3. Definir interlinking manual entre familia, guía, precios y servicio.

#### Dependencias

- soporte para nuevas páginas y enlaces internos editables.

### Fase 3: estructura y escalabilidad

1. Extender CMS con `parentPageId`.
2. Extender CMS con `relatedPageIds` o `CmsPageRelation`.
3. Extender CMS con `seoJsonLd`.
4. Implementar navegación editable desde CMS.
5. Opcionalmente formalizar bloques nuevos `ComparisonBlock`, `PricingHintBlock`, `UrgencyBlock`, `ServiceCoverageBlock`.

#### Dependencias

- validación técnica mínima de modelo de datos y API de CMS.

## 8. Resultado operativo esperado

Con este plan, el equipo de contenido puede:

- cargar el contenido desde CMS;
- editar titles, descriptions y bloques sin tocar frontend;
- construir landings nuevas y guías semánticas;
- reforzar CRO en reparación;
- sostener SEO orgánico y sinergia con Ads sin depender de texto hardcodeado.

El equipo técnico solo debe intervenir si se decide cerrar los gaps estructurales del CMS.
