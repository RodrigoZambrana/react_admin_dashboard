import {
  CmsEntryStatus,
  CmsMediaType,
  CmsPageBlockType,
  CmsPageScope,
  CmsPageSectionType,
  Prisma,
  PrismaClient,
} from '@prisma/client'

type MediaSeed = {
  url: string
  alt?: string | null
  title?: string | null
  source?: string | null
  metadata?: Record<string, unknown> | null
}

type CmsBlockSeed = {
  type: CmsPageBlockType
  key?: string | null
  name?: string | null
  content?: Record<string, unknown> | null
  media?: MediaSeed | null
}

type CmsSectionSeed = {
  type: CmsPageSectionType
  key?: string | null
  name?: string | null
  settings?: Record<string, unknown> | null
  blocks?: CmsBlockSeed[]
}

type CmsPageSeed = {
  path: string
  title: string
  summary: string
  seoTitle: string
  seoDescription: string
  seoImageUrl: string
  legacySource: string
  sections: CmsSectionSeed[]
}

const prisma = new PrismaClient()

const normalizePath = (value: string) => value.trim().replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()

const asJson = (value: Record<string, unknown> | null | undefined) =>
  value === undefined || value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)

const ensureMedia = async (asset: NonNullable<CmsBlockSeed['media']>) => {
  const existing = await prisma.cmsMedia.findFirst({
    where: { url: asset.url },
    select: { id: true },
  })

  const data = {
    url: asset.url,
    type: CmsMediaType.IMAGE,
    alt: asset.alt ?? null,
    title: asset.title ?? null,
    source: asset.source ?? 'aberturas-series-seed',
    metadata: asset.metadata ? (asset.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    isActive: true,
  }

  if (existing) {
    const updated = await prisma.cmsMedia.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    })
    return updated.id
  }

  const created = await prisma.cmsMedia.create({
    data,
    select: { id: true },
  })
  return created.id
}

const upsertPage = async (page: CmsPageSeed) => {
  const existing = await prisma.cmsPage.findFirst({
    where: { path: normalizePath(page.path) },
    select: { id: true },
  })

  const pageData = {
    path: normalizePath(page.path),
    title: page.title,
    summary: page.summary,
    scope: CmsPageScope.GENERAL_SITE,
    locale: 'es',
    status: CmsEntryStatus.PUBLISHED,
    visible: true,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    seoImageUrl: page.seoImageUrl,
    layoutKey: 'landing-default',
    legacySource: page.legacySource,
  }

  const pageRecord = existing
    ? await prisma.cmsPage.update({
        where: { id: existing.id },
        data: pageData,
        select: { id: true },
      })
    : await prisma.cmsPage.create({
        data: pageData,
        select: { id: true },
      })

  await prisma.cmsPageSection.deleteMany({ where: { pageId: pageRecord.id } })

  for (let sectionIndex = 0; sectionIndex < page.sections.length; sectionIndex += 1) {
    const section = page.sections[sectionIndex]
    const createdSection = await prisma.cmsPageSection.create({
      data: {
        pageId: pageRecord.id,
        type: section.type,
        key: section.key ?? null,
        name: section.name ?? null,
        sortOrder: sectionIndex,
        visible: true,
        settings: asJson(section.settings),
      },
      select: { id: true },
    })

    for (let blockIndex = 0; blockIndex < (section.blocks ?? []).length; blockIndex += 1) {
      const block = section.blocks?.[blockIndex]
      if (!block) continue
      const mediaId = block.media ? await ensureMedia(block.media) : null
      await prisma.cmsPageBlock.create({
        data: {
          sectionId: createdSection.id,
          type: block.type,
          key: block.key ?? null,
          name: block.name ?? null,
          sortOrder: blockIndex,
          visible: true,
          content: asJson(block.content),
          mediaId,
        },
      })
    }
  }
}

const richText = (...paragraphs: string[]) => ({
  richText: paragraphs.map((paragraph) => ({
    type: 'element',
    tag: 'p',
    children: [{ type: 'text', value: paragraph }],
  })),
})

const buildSeriesPage = (input: {
  path: string
  title: string
  summary: string
  seoTitle: string
  seoDescription: string
  seoImageUrl: string
  legacySource: string
  heroEyebrow: string
  heroTitle: string
  heroDescription: string
  heroImageAlt: string
  heroImageUrl: string
  heroActions: Array<{ label: string; href: string }>
  deepeningTitle: string
  deepeningDescription: string
  deepeningBody: string[]
  deepeningActions: Array<{ label: string; href: string }>
  editorialTitle: string
  editorialDescription: string
  editorialLead: string
  body: string[]
  featuresTitle: string
  featuresDescription: string
  features: Array<{
    title: string
    description: string
    href: string
    imageUrl: string
    imageAlt: string
    badge: string
  }>
  faqTitle: string
  faqDescription: string
  faqs: Array<{ question: string; answer: string }>
  ctaTitle: string
  ctaDescription: string
  ctaActions: Array<{ label: string; href: string }>
}): CmsPageSeed => ({
  path: input.path,
  title: input.title,
  summary: input.summary,
  seoTitle: input.seoTitle,
  seoDescription: input.seoDescription,
  seoImageUrl: input.seoImageUrl,
  legacySource: input.legacySource,
  sections: [
    {
      type: CmsPageSectionType.HERO,
      key: 'hero',
      name: input.title,
      settings: {
        title: input.heroTitle,
        eyebrow: input.heroEyebrow,
        description: input.heroDescription,
        headingLevel: 'h1',
        primaryCtaLabel: input.heroActions[0]?.label ?? 'Pedir asesoramiento',
        primaryCtaHref: input.heroActions[0]?.href ?? '/contacto.html',
        secondaryCtaLabel: input.heroActions[1]?.label ?? 'Ver guía DVH',
        secondaryCtaHref: input.heroActions[1]?.href ?? '/articulos/dvh.html',
        slides: [
          {
            title: input.heroTitle,
            description: input.heroDescription,
            imageUrl: input.heroImageUrl,
            imageAlt: input.heroImageAlt,
            href: input.heroActions[0]?.href ?? '/contacto.html',
            linkLabel: input.heroActions[0]?.label ?? 'Pedir asesoramiento',
          },
        ],
      },
      blocks: [],
    },
    {
      type: CmsPageSectionType.CONTENT_SPLIT,
      key: `${input.path.replace(/\W+/g, '-')}-content`,
      name: input.editorialTitle,
      settings: {
        title: input.editorialTitle,
        description: input.editorialDescription,
        variant: 'media-gallery-content',
        mediaPosition: 'start',
        imageAlt: input.heroImageAlt,
        imageUrl: input.heroImageUrl,
        gallery: [
          {
            imageUrl: input.heroImageUrl,
            imageAlt: input.heroImageAlt,
            href: input.heroActions[0]?.href ?? '/contacto.html',
            linkLabel: input.heroActions[0]?.label ?? 'Pedir asesoramiento',
          },
        ],
        actions: input.heroActions,
      },
      blocks: [
        {
          type: CmsPageBlockType.RICH_TEXT,
          key: `${input.path.replace(/\W+/g, '-')}-copy`,
          name: 'Contenido editorial',
          content: richText(...input.body),
        },
      ],
    },
    {
      type: CmsPageSectionType.CONTENT_SPLIT,
      key: `${input.path.replace(/\W+/g, '-')}-deepening`,
      name: input.deepeningTitle,
      settings: {
        title: input.deepeningTitle,
        description: input.deepeningDescription,
        variant: 'media-gallery-content',
        mediaPosition: 'end',
        imageAlt: input.heroImageAlt,
        imageUrl: input.heroImageUrl,
        gallery: [
          {
            imageUrl: input.heroImageUrl,
            imageAlt: input.heroImageAlt,
            href: input.deepeningActions[0]?.href ?? '/contacto.html',
            linkLabel: input.deepeningActions[0]?.label ?? 'Pedir asesoramiento',
          },
        ],
        actions: input.deepeningActions,
      },
      blocks: [
        {
          type: CmsPageBlockType.RICH_TEXT,
          key: `${input.path.replace(/\W+/g, '-')}-deepening-copy`,
          name: 'Detalles técnicos y de uso',
          content: richText(...input.deepeningBody),
        },
      ],
    },
    {
      type: CmsPageSectionType.FEATURE_GRID,
      key: `${input.path.replace(/\W+/g, '-')}-features`,
      name: input.featuresTitle,
      settings: {
        title: input.featuresTitle,
        description: input.featuresDescription,
        itemHeadingLevel: 'h3',
      },
      blocks: input.features.map((feature, index) => ({
        type: CmsPageBlockType.CARD,
        key: `${input.path.replace(/\W+/g, '-')}-feature-${index + 1}`,
        name: feature.title,
        content: {
          title: feature.title,
          body: feature.description,
          href: feature.href,
          linkLabel: 'Ver más',
          headingLevel: 'h3',
          badge: feature.badge,
        },
        media: {
          url: feature.imageUrl,
          alt: feature.imageAlt,
          title: feature.title,
          source: 'aberturas-series-seed',
        },
      })),
    },
    {
      type: CmsPageSectionType.FAQ,
      key: `${input.path.replace(/\W+/g, '-')}-faq`,
      name: 'Preguntas frecuentes',
      settings: {
        title: input.faqTitle,
        description: input.faqDescription,
      },
      blocks: input.faqs.map((faq, index) => ({
        type: CmsPageBlockType.FAQ_ITEM,
        key: `${input.path.replace(/\W+/g, '-')}-faq-${index + 1}`,
        name: faq.question,
        content: {
          question: faq.question,
          answerRichText: richText(faq.answer).richText,
        },
      })),
    },
    {
      type: CmsPageSectionType.CTA_BANNER,
      key: `${input.path.replace(/\W+/g, '-')}-cta`,
      name: 'Cierre comercial',
      settings: {
        title: input.ctaTitle,
        description: input.ctaDescription,
        intent: 'transactional',
        actions: input.ctaActions,
      },
      blocks: [],
    },
  ],
})

const seriesPages: CmsPageSeed[] = [
  buildSeriesPage({
    path: 'productos/aberturas-serie-20-y-25.html',
    title: 'Serie 20 y 25',
    summary: 'Serie estándar para resoluciones funcionales, accesibles y de entrega rápida.',
    seoTitle: 'Serie 20 y 25 en aluminio | Aberturas estándar - Urucortinas',
    seoDescription:
      'Serie 20 y 25 en aluminio para obra nueva o recambio. Una solución estándar, funcional y más accesible para ventanas y puertas.',
    seoImageUrl: '/uploads/cms/legacy-assets/img/aberturas/ventana.jpg',
    legacySource: 'knowledge:public-curated',
    heroEyebrow: 'Serie estándar',
    heroTitle: 'Serie 20 y 25',
    heroDescription: 'Una alternativa funcional y más accesible para resoluciones estándar.',
    heroImageAlt: 'Serie 20 y 25 de aberturas de aluminio',
    heroImageUrl: '/uploads/cms/legacy-assets/img/aberturas/ventana.jpg',
    heroActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
    deepeningTitle: 'Tipologías y usos de Serie 20 y 25',
    deepeningDescription: 'La serie estándar cubre resoluciones frecuentes con criterio funcional.',
    deepeningBody: [
      'Serie 20 y 25 resuelve ventanas y puertas ventana de uso cotidiano, con medidas frecuentes y una propuesta más accesible.',
      'Es una base sólida para recambio o instalación nueva cuando no se necesita la complejidad de una línea de alta prestación.',
      'Si el frente es más exigente, la comparación con Probba, Gala o Summa ayuda a elegir mejor.',
    ],
    deepeningActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
    editorialTitle: 'Cuándo conviene Serie 20 y 25',
    editorialDescription: 'Cuando buscás una respuesta estándar, confiable y de mayor accesibilidad.',
    editorialLead: 'La Serie 20 y 25 es el punto de partida de la línea de aberturas en aluminio.',
    body: [
      'Se recomienda cuando necesitás una solución funcional, de medidas habituales y con una relación precio-prestación más accesible.',
      'Es una buena elección para ventanas y puertas ventana de uso cotidiano, especialmente cuando no se necesita DVH.',
      'Para frentes grandes o proyectos que buscan más confort, conviene comparar con Probba, Gala o Summa.',
      'En puertas ventana o ventanas grandes, superiores a 1.50 x 1.50, suele recomendarse Serie 25.',
    ],
    featuresTitle: 'Puntos de decisión',
    featuresDescription: 'Lo importante para decidir sin complicar la obra.',
    features: [
      {
        title: 'Más accesible',
        description: 'La solución estándar para presupuestos más contenidos y resoluciones funcionales.',
        href: '/contacto.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/ventana.jpg',
        imageAlt: 'Serie 20 y 25',
        badge: 'Económica',
      },
      {
        title: 'Entrega rápida',
        description: 'Buena opción cuando querés resolver con tiempos más cortos y medidas frecuentes.',
        href: '/contacto.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/monoblocks.jpg',
        imageAlt: 'Serie 20 y 25 con monoblock',
        badge: 'Stock',
      },
      {
        title: 'Sin DVH',
        description: 'Si necesitás DVH, conviene pasar a una línea de alta prestación.',
        href: '/articulos/dvh.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/dvh-main.jpg',
        imageAlt: 'Serie 20 y 25 y DVH',
        badge: 'Guía',
      },
      {
        title: 'Recomendación de uso',
        description: 'Funciona muy bien en soluciones estándar y en recambios simples.',
        href: '/productos/aberturas-aluminio.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/abertura_1.png',
        imageAlt: 'Serie 20 y 25 recomendación',
        badge: 'Uso',
      },
    ],
    faqTitle: 'Serie 20 y 25: dudas frecuentes',
    faqDescription: 'Respuestas cortas para cotizar con criterio.',
    faqs: [
      {
        question: '¿Cuándo conviene Serie 20 y 25?',
        answer: 'Conviene cuando buscás una solución estándar, funcional y más accesible para obra o recambio.',
      },
      {
        question: '¿Soporta DVH?',
        answer: 'No. Si necesitás DVH, conviene revisar Probba, Gala o Summa.',
      },
      {
        question: '¿Qué dato ayuda a cotizar?',
        answer: 'Las medidas, el tipo de apertura y si es obra nueva o recambio alcanzan para orientar el presupuesto.',
      },
    ],
    ctaTitle: 'Pedí asesoramiento para Serie 20 y 25',
    ctaDescription: 'Si querés resolver una abertura estándar, te ayudamos a cotizarla.',
    ctaActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
  }),
  buildSeriesPage({
    path: 'productos/aberturas-probba.html',
    title: 'Serie Probba',
    summary: 'Alta prestación de entrada con mejor cierre y posibilidad de DVH.',
    seoTitle: 'Serie Probba en aluminio | Alta prestación de entrada - Urucortinas',
    seoDescription:
      'Serie Probba en aluminio para proyectos que buscan mejor cierre, más durabilidad y posibilidad de DVH en obra o recambio.',
    seoImageUrl: '/uploads/cms/legacy-assets/img/aberturas/abertura_1.png',
    legacySource: 'knowledge:public-curated',
    heroEyebrow: 'Alta prestación de entrada',
    heroTitle: 'Serie Probba',
    heroDescription: 'Más cierre, más durabilidad y una mejora clara frente a una línea estándar.',
    heroImageAlt: 'Serie Probba de aberturas de aluminio',
    heroImageUrl: '/uploads/cms/legacy-assets/img/aberturas/abertura_1.png',
    heroActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
    deepeningTitle: 'Tipologías disponibles en Probba',
    deepeningDescription: 'La serie cubre varias aperturas y configuraciones según el proyecto.',
    deepeningBody: [
      'Probba admite ventana y puerta corrediza con 2 o 4 hojas, ventanas batientes, oscilobatientes, banderolas, proyectantes, proyección y desliz, puerta batiente y paño fijo.',
      'En la ficha del fabricante aparecen además detalles como doble felpilla, varios puntos de cierre, opción de mosquitero y compatibilidad con vidrio simple y DVH.',
      'Eso la vuelve una base muy versátil para hogar, oficina y obra, con medidas máximas claras para presupuestar mejor.',
    ],
    deepeningActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
    editorialTitle: 'Cuándo conviene Probba',
    editorialDescription: 'Cuando querés subir un escalón sin ir directo a la línea premium.',
    editorialLead: 'Probba es la puerta de entrada a la alta prestación.',
    body: [
      'Se recomienda cuando querés mejorar el cierre, sumar durabilidad y dar un paso más allá de la línea estándar.',
      'El fabricante la presenta con diseño renovado, accesorios de alta calidad y compatibilidad con perfiles compartidos con Gala en parte de su sistema.',
      'Admite vidrio simple o DVH, por eso funciona bien en obras y recambios donde querés más prestación sin saltar todavía a la gama premium.',
    ],
    featuresTitle: 'Puntos de decisión',
    featuresDescription: 'Lo que cambia cuando subís a alta prestación de entrada.',
    features: [
      {
        title: 'Mejor cierre',
        description: 'Aporta una respuesta más firme que la línea estándar y acompaña mejor el uso cotidiano.',
        href: '/contacto.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/abertura_1.png',
        imageAlt: 'Serie Probba',
        badge: 'Cierre',
      },
      {
        title: 'Compatible con DVH',
        description: 'Puede configurarse con vidrio simple o DVH en las combinaciones compatibles.',
        href: '/articulos/dvh.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/dvh-main.jpg',
        imageAlt: 'Serie Probba con DVH',
        badge: 'DVH',
      },
      {
        title: 'Diseño renovado',
        description: 'Su propuesta suma una imagen más actual y accesorios de mejor nivel.',
        href: '/productos/aberturas-aluminio.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/monoblocks.jpg',
        imageAlt: 'Serie Probba diseño renovado',
        badge: 'Diseño',
      },
      {
        title: 'Alta prestación de entrada',
        description: 'Ideal cuando querés mejorar sin pasar todavía a Gala o Summa.',
        href: '/productos/aberturas-gala.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/gala.jpg',
        imageAlt: 'Serie Probba alta prestación',
        badge: 'Transición',
      },
    ],
    faqTitle: 'Serie Probba: dudas frecuentes',
    faqDescription: 'Respuestas útiles para cotizar mejor.',
    faqs: [
      {
        question: '¿Qué diferencia a Probba de la línea estándar?',
        answer: 'Probba suma mejor cierre, más durabilidad y posibilidad de DVH.',
      },
      {
        question: '¿Sirve para recambio?',
        answer: 'Sí. Es una buena opción para mejorar una abertura existente sin ir directamente a la gama premium.',
      },
      {
        question: '¿Qué dato ayuda a cotizar?',
        answer: 'Medidas, tipo de abertura y si querés DVH o vidrio simple alcanzan para orientar la propuesta.',
      },
    ],
    ctaTitle: 'Pedí asesoramiento para Serie Probba',
    ctaDescription: 'Si necesitás subir de nivel respecto a una solución estándar, Probba es una buena entrada.',
    ctaActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
  }),
  buildSeriesPage({
    path: 'productos/aberturas-gala.html',
    title: 'Serie Gala',
    summary: 'Serie versátil y estética para proyectos que buscan más confort y mejor terminación.',
    seoTitle: 'Serie Gala en aluminio | Confort y terminación - Urucortinas',
    seoDescription:
      'Serie Gala en aluminio para proyectos que necesitan más confort, mejor terminación y compatibilidad con DVH en líneas de mayor prestación.',
    seoImageUrl: '/uploads/cms/legacy-assets/img/aberturas/gala.jpg',
    legacySource: 'knowledge:public-curated',
    heroEyebrow: 'Alta prestación versátil',
    heroTitle: 'Serie Gala',
    heroDescription: 'Confort, estética y una respuesta sólida para proyectos más exigentes.',
    heroImageAlt: 'Serie Gala de aberturas de aluminio',
    heroImageUrl: '/uploads/cms/legacy-assets/img/aberturas/gala.jpg',
    heroActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
    deepeningTitle: 'Sistema Gala y Gala CR',
    deepeningDescription: 'Dos variantes para proyectar mejor confort, estanqueidad y terminación.',
    deepeningBody: [
      'Gala se presenta como una línea de aristas redondeadas con aislamiento térmico y acústico comprobado.',
      'El fabricante también muestra Gala CR como una variante con estanqueidad al agua y mejor comportamiento térmico y acústico.',
      'La propuesta suma accesorios europeos específicos y una presencia visual más cuidada para proyectos que priorizan terminación y confort.',
    ],
    deepeningActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
    editorialTitle: 'Cuándo conviene Gala',
    editorialDescription: 'Cuando querés una serie versátil con mejor presencia visual y mayor confort.',
    editorialLead: 'Gala acompaña proyectos que necesitan más que una solución estándar.',
    body: [
      'Se adapta bien a opciones corredizas, batientes y oscilobatientes y en el fabricante aparece con marcos proyectantes y batientes exteriores de 76 mm.',
      'Permite sumar DVH para mejorar el aislamiento térmico y acústico sin perder una propuesta visual cuidada.',
      'Es una buena elección cuando el proyecto busca equilibrio entre estética, confort y prestación en un nivel más alto que Probba.',
    ],
    featuresTitle: 'Puntos de decisión',
    featuresDescription: 'Lo importante para evaluar Gala sin perder foco.',
    features: [
      {
        title: 'Versatilidad',
        description: 'Sirve para distintas tipologías de apertura y proyectos variados.',
        href: '/contacto.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/gala.jpg',
        imageAlt: 'Serie Gala versátil',
        badge: 'Versátil',
      },
      {
        title: 'Compatibilidad con DVH',
        description: 'Si el proyecto lo necesita, podés sumar DVH en líneas compatibles.',
        href: '/articulos/dvh.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/dvh-main.jpg',
        imageAlt: 'Serie Gala con DVH',
        badge: 'DVH',
      },
      {
        title: 'Mejor terminación',
        description: 'La línea acompaña mejor proyectos que buscan una presencia más cuidada.',
        href: '/productos/aberturas-summa.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/monoblocks.jpg',
        imageAlt: 'Serie Gala terminación',
        badge: 'Terminación',
      },
      {
        title: 'Paso a premium',
        description: 'Si el proyecto es grande o más exigente, Summa puede ser la siguiente referencia.',
        href: '/productos/aberturas-summa.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/abertura_1.png',
        imageAlt: 'Serie Gala paso a premium',
        badge: 'Premium',
      },
    ],
    faqTitle: 'Serie Gala: dudas frecuentes',
    faqDescription: 'Respuestas breves para decidir mejor.',
    faqs: [
      {
        question: '¿Qué diferencia a Gala de Probba?',
        answer: 'Gala suma más versatilidad y una terminación más cuidada para proyectos exigentes.',
      },
      {
        question: '¿Puede llevar DVH?',
        answer: 'Sí, en las configuraciones compatibles de la línea.',
      },
      {
        question: '¿Qué dato ayuda a cotizar?',
        answer: 'Tipo de apertura, medidas y si querés DVH o recambio alcanzan para orientar la propuesta.',
      },
    ],
    ctaTitle: 'Pedí asesoramiento para Serie Gala',
    ctaDescription: 'Si buscás más confort y mejor terminación, Gala es una muy buena opción.',
    ctaActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
  }),
  buildSeriesPage({
    path: 'productos/aberturas-summa.html',
    title: 'Serie Summa',
    summary: 'Línea premium para grandes dimensiones, hermeticidad y prestaciones superiores.',
    seoTitle: 'Serie Summa en aluminio | Línea premium - Urucortinas',
    seoDescription:
      'Serie Summa en aluminio para grandes dimensiones, hermeticidad y mayor confort. La línea premium de la familia de aberturas.',
    seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/aberturas/dvh-main.jpg',
    legacySource: 'knowledge:public-curated',
    heroEyebrow: 'Línea premium',
    heroTitle: 'Serie Summa',
    heroDescription: 'Mayor hermeticidad, más confort y mejor respuesta en proyectos grandes.',
    heroImageAlt: 'Serie Summa de aberturas de aluminio',
    heroImageUrl: '/uploads/cms/legacy-assets/img/portfolio/aberturas/dvh-main.jpg',
    heroActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
    deepeningTitle: 'Prestación y sistemas de Summa',
    deepeningDescription: 'Una línea premium con foco en hermeticidad, confort y grandes dimensiones.',
    deepeningBody: [
      'Summa combina más transparencia, más confort, más seguridad y más practicidad, con hojas de hasta 3 metros de altura según la propuesta del fabricante.',
      'La ficha local muestra además variantes como Summa Alzante y Summa Comfort RPT, pensadas para sumar performance en proyectos más exigentes.',
      'También aparecen terminaciones disponibles y tipologías corredizas con DVH, lo que ayuda a elegir mejor según obra y nivel de prestación.',
    ],
    deepeningActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
    editorialTitle: 'Cuándo conviene Summa',
    editorialDescription: 'Cuando el proyecto exige más dimensión, más cierre y una terminación premium.',
    editorialLead: 'Summa es la referencia más alta de la línea.',
    body: [
      'Está pensada para grandes dimensiones y para proyectos donde la hermeticidad importa mucho.',
      'En la documentación del fabricante aparece como la línea premium, con foco en confort, mejor cierre y configuraciones para paños más exigentes.',
      'Admite DVH y puede complementar configuraciones con cortina de enrollar cuando el proyecto lo necesita.',
    ],
    featuresTitle: 'Puntos de decisión',
    featuresDescription: 'Lo que vuelve a Summa la referencia premium.',
    features: [
      {
        title: 'Premium',
        description: 'La línea más alta de la familia para proyectos exigentes.',
        href: '/contacto.html',
        imageUrl: '/uploads/cms/legacy-assets/img/portfolio/aberturas/dvh-main.jpg',
        imageAlt: 'Serie Summa premium',
        badge: 'Premium',
      },
      {
        title: 'Grandes dimensiones',
        description: 'Pensada para aberturas más grandes y exigentes.',
        href: '/productos/aberturas-aluminio.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/monoblocks.jpg',
        imageAlt: 'Serie Summa grandes dimensiones',
        badge: 'Dimensión',
      },
      {
        title: 'Hermeticidad',
        description: 'La línea apunta a mayor cierre y mejor confort general.',
        href: '/articulos/dvh.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/dvh-main.jpg',
        imageAlt: 'Serie Summa hermeticidad',
        badge: 'Confort',
      },
      {
        title: 'Complementos',
        description: 'Puede integrarse con DVH y cortina de enrollar según el proyecto.',
        href: '/productos/dvh.html',
        imageUrl: '/uploads/cms/legacy-assets/img/aberturas/gala.jpg',
        imageAlt: 'Serie Summa complementos',
        badge: 'Complementos',
      },
    ],
    faqTitle: 'Serie Summa: dudas frecuentes',
    faqDescription: 'Respuestas directas para cerrar la decisión.',
    faqs: [
      {
        question: '¿Qué diferencia a Summa del resto?',
        answer: 'Es la línea premium, pensada para proyectos grandes y con mayor exigencia de confort.',
      },
      {
        question: '¿Admite DVH?',
        answer: 'Sí, y también puede acompañarse con otros complementos según la obra.',
      },
      {
        question: '¿Qué dato ayuda a cotizar?',
        answer: 'Medidas, tipo de apertura y si el proyecto exige DVH o complementos alcanzan para orientar la propuesta.',
      },
    ],
    ctaTitle: 'Pedí asesoramiento para Serie Summa',
    ctaDescription: 'Si necesitás el nivel premium de la familia de aberturas, Summa es la referencia.',
    ctaActions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
    ],
  }),
]

async function main() {
  for (const page of seriesPages) {
    await upsertPage(page)
    console.log(`[aberturas-series] upserted ${page.path}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
