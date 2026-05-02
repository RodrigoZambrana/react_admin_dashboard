import {
  CmsEntryStatus,
  CmsMediaType,
  CmsPageBlockType,
  CmsPageScope,
  CmsPageSectionType,
  Prisma,
  PrismaClient,
} from '@prisma/client'
import {
  MARKETING_HOME_HIGHLIGHT_SEEDS,
  MARKETING_HOME_STORY_SEEDS,
  buildMarketingStoryCmsPage,
  replaceCmsEntryAssets,
} from './shared/marketing-seed-content'

type MediaSeed = {
  url: string
  type?: CmsMediaType
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
  summary?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  seoImageUrl?: string | null
  aliases?: string[]
  sections: CmsSectionSeed[]
}

const VIDEO_SAMPLE_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

const normalizePath = (value: string) => value.trim().replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()

const asJson = (value: Record<string, unknown> | null | undefined) =>
  value === undefined || value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)

const marketingMedia: MediaSeed[] = [
  { url: '/assets/images/banners/banner-23.jpg', alt: 'Banner editorial', title: 'Editorial hero' },
  { url: '/assets/images/banners/banner-24.jpg', alt: 'Banner de estilo', title: 'Inspiración de catálogo' },
  { url: '/assets/images/banners/banner-21.jpg', alt: 'Banner lifestyle', title: 'Lifestyle selection' },
  { url: '/assets/images/banners/banner-14.jpg', alt: 'Banner visual', title: 'Visual merchandising' },
  { url: '/assets/images/banners/banner-16.jpg', alt: 'Banner de detalle', title: 'Detalle de producto' },
  { url: '/assets/images/banners/banner-17.jpg', alt: 'Banner destacado', title: 'Seleccionados' },
  { url: '/assets/images/banners/banner-18.jpg', alt: 'Banner premium', title: 'Premium feel' },
  { url: '/assets/images/banners/banner-19.jpg', alt: 'Banner moda', title: 'Moda y conversión' },
  { url: '/assets/images/banners/long-banner.jpg', alt: 'Banner largo', title: 'Full width visual' },
  { url: '/assets/images/categories/cat-1.jpg', alt: 'Categoría 1', title: 'Categoría' },
  { url: '/assets/images/categories/cat-2.jpg', alt: 'Categoría 2', title: 'Categoría' },
  { url: '/assets/images/categories/cat-3.jpg', alt: 'Categoría 3', title: 'Categoría' },
  { url: '/assets/images/categories/cat-4.jpg', alt: 'Categoría 4', title: 'Categoría' },
  { url: '/assets/images/categories/cat-5.jpg', alt: 'Categoría 5', title: 'Categoría' },
  { url: '/assets/images/categories/cat-6.jpg', alt: 'Categoría 6', title: 'Categoría' },
  { url: '/assets/images/stories/story-home-1.jpg', alt: 'Story 1', title: 'Story 1' },
  { url: '/assets/images/stories/story-home-2.jpg', alt: 'Story 2', title: 'Story 2' },
  { url: '/assets/images/stories/story-home-3.jpg', alt: 'Story 3', title: 'Story 3' },
  { url: '/assets/images/products/bghead-phone.png', alt: 'Phone hero', title: 'Phone hero' },
  { url: '/assets/images/products/mobile-1.png', alt: 'Mobile phone', title: 'Mobile' },
  { url: '/assets/images/products/mobile-2.png', alt: 'Mobile phone alt', title: 'Mobile alt' },
  { url: '/assets/images/products/watch.png', alt: 'Watch', title: 'Watch' },
  { url: '/assets/images/products/smartwatch-2.png', alt: 'Smartwatch', title: 'Smartwatch' },
  { url: '/assets/images/products/ring-1.png', alt: 'Accessory', title: 'Accessory' },
  { url: '/assets/images/products/clothes.png', alt: 'Clothes', title: 'Clothes' },
  { url: '/assets/images/products/gaming-gear.png', alt: 'Gaming gear', title: 'Gaming gear' },
  { url: '/assets/images/products/bg-gradient.png', alt: 'Gradient background', title: 'Gradient' },
]

const HOME_SHOP_PRODUCT_CODES = [
  'cortinas-de-enrollar-aluminio',
  'cortinas-de-enrollar-pvc',
  'cortinas-roller',
  'cortinas-tradicionales',
]

const HOME_SHOP_PRODUCT_DESCRIPTIONS: Record<string, string> = {
  'cortinas-roller': 'Blackout y screen para controlar luz y privacidad en hogar u oficina.',
  'cortinas-tradicionales': 'Una opción clásica para recambio y ambientes de uso diario.',
  'cortinas-de-enrollar-pvc': 'Solución práctica y liviana para frentes y ventanas con bajo mantenimiento.',
  'cortinas-de-enrollar-aluminio': 'Más resistencia para frentes expuestos y uso más intensivo.',
}

const categoriesPage: CmsPageSeed = {
  path: 'categories',
  title: 'Categorías para decidir más rápido',
  summary:
    'Una landing visual para entrar por necesidad, uso y contexto antes de avanzar al catálogo.',
  seoTitle: 'Categorías de productos | Urucortinas',
  seoDescription:
    'Explorá cortinas de enrollar, aberturas, toldos, motores y soluciones para interior y exterior.',
  seoImageUrl: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
  sections: [
    {
      type: CmsPageSectionType.MEDIA_HERO,
      key: 'categories-hero',
      settings: {
        mediaType: 'image',
        overlay: true,
        overlayOpacity: 0.62,
        title: 'Elegí por necesidad y avanzá más rápido',
        subtitle:
          'Cortinas de enrollar, aberturas, toldos, motores y soluciones para interior y exterior con una lectura más clara.',
        eyebrow: 'Catálogo visual',
        mediaAlt: 'Categorías Urucortinas',
        primaryCta: { label: 'Explorar catálogo', href: '/shop' },
        secondaryCta: { label: 'Ver cortinas de enrollar', href: '/productos/cortinas-de-enrollar.html' },
      },
      blocks: [
        {
          type: CmsPageBlockType.IMAGE,
          name: 'Hero image',
          media: {
            url: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
            alt: 'Categorías Urucortinas',
            title: 'Categorías Urucortinas',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.HIGHLIGHT_CARDS,
      key: 'categories-highlights',
      settings: {
        title: 'Accesos rápidos por necesidad',
        description: 'Bloques de navegación para entrar por uso, exposición o etapa de obra.',
      },
      blocks: [
        {
          type: CmsPageBlockType.CARD,
          name: 'Cortinas de enrollar',
          content: {
            title: 'Cortinas de enrollar',
            description: 'PVC o aluminio según exposición, mantenimiento y nivel de robustez.',
            badge: 'Exterior',
            linkLabel: 'Ver opciones',
            href: '/productos/cortinas-de-enrollar.html',
          },
          media: {
            url: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg',
            alt: 'Cortinas de enrollar',
            title: 'Cortinas de enrollar',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Aberturas en aluminio',
          content: {
            title: 'Aberturas en aluminio',
            description: 'Serie 20, 25, alta prestación y DVH para obra o recambio.',
            badge: 'Obra y recambio',
            linkLabel: 'Ver aberturas',
            href: '/productos/aberturas-aluminio.html',
          },
          media: {
            url: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
            alt: 'Aberturas en aluminio',
            title: 'Aberturas en aluminio',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Toldos y cerramientos',
          content: {
            title: 'Toldos y cerramientos',
            description: 'Protección solar, sombra y uso exterior con una solución a medida.',
            badge: 'Exterior',
            linkLabel: 'Ver toldos',
            href: '/productos/toldos-y-cerramientos.html',
          },
          media: {
            url: '/assets/images/banners/banner-24.jpg',
            alt: 'Toldos y cerramientos',
            title: 'Toldos y cerramientos',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Motores y automatismos',
          content: {
            title: 'Motores y automatismos',
            description: 'Más confort en el uso diario con control remoto y automatización.',
            badge: 'Automatización',
            linkLabel: 'Ver motores',
            href: '/productos/motores-cortinas-y-persianas.html',
          },
          media: {
            url: '/media/products/cortinas-roller/images/20211218_193930.jpg',
            alt: 'Motores y automatismos',
            title: 'Motores y automatismos',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.VIDEO_SECTION,
      key: 'categories-video',
      settings: {
        title: 'Uso real y demostración',
        description: 'Un bloque corto para despejar dudas, reforzar terminaciones y acelerar la decisión.',
        layout: 'contained',
        autoplay: false,
        controls: true,
      },
      blocks: [
        {
          type: CmsPageBlockType.CARD,
          name: 'Demo principal',
          content: {
            title: 'Ver el producto en contexto',
            description: 'Video breve para validar escala, uso y detalles antes de decidir.',
          },
          media: {
            url: VIDEO_SAMPLE_URL,
            alt: 'Video de demostración',
            title: 'Demo principal',
            type: CmsMediaType.VIDEO,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Proceso',
          content: {
            title: 'Proceso y terminaciones',
            description: 'Una pieza editorial que muestra calidad y terminación.',
          },
          media: {
            url: '/assets/images/banners/banner-24.jpg',
            alt: 'Proceso y terminaciones',
            title: 'Proceso',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.MEDIA_GRID_ENHANCED,
      key: 'categories-grid',
      settings: {
        title: 'Selecciones visuales',
        description: 'Una grilla para inspirar y llevar tráfico a productos o categorías.',
        columns: 3,
        gap: 1.1,
        aspectRatio: '4 / 5',
      },
      blocks: [
        {
          type: CmsPageBlockType.CARD,
          name: 'Colección 1',
          content: {
            title: 'Cortinas Roller',
            description: 'Solución interior moderna para regular luz y privacidad.',
            badge: 'Trend',
            overlayText: true,
            linkLabel: 'Ver producto',
            href: '/productos/cortinas-roller.html',
          },
          media: {
            url: '/media/products/cortinas-roller/images/20211218_193930.jpg',
            alt: 'Cortinas Roller',
            title: 'Cortinas Roller',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Colección 2',
          content: {
            title: 'Bandas verticales',
            description: 'Versatilidad y elegancia para ventanales amplios.',
            badge: 'Focus',
            overlayText: true,
            linkLabel: 'Ver bandas',
            href: '/productos/bandas-verticales.html',
          },
          media: {
            url: '/media/products/bandas-verticales/images/WhatsApp Image 2020-07-10 at 13.53.45.jpeg',
            alt: 'Bandas verticales',
            title: 'Bandas verticales',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Colección 3',
          content: {
            title: 'Cortinas Venecianas',
            description: 'Control de luz con lamas de 16 mm y 25 mm.',
            badge: 'Use case',
            overlayText: true,
            linkLabel: 'Ver venecianas',
            href: '/productos/venecianas.html',
          },
          media: {
            url: '/media/products/venecianas/images/cortina_veneciana_1.jpeg',
            alt: 'Cortinas Venecianas',
            title: 'Cortinas Venecianas',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.CTA_BANNER,
      key: 'categories-cta',
      settings: {
        title: 'Volvé al catálogo con una intención más clara',
        description: 'La navegación visual reduce fricción y mejora la calidad de clic.',
        label: 'Ir al catálogo',
        href: '/shop',
        intent: 'navigation',
      },
    },
  ],
}

type RichTextNode = {
  type: 'element' | 'text'
  tag?: string
  value?: string
  children?: RichTextNode[]
}

const rtText = (value: string): RichTextNode => ({
  type: 'text',
  value,
})

const rtElement = (tag: string, children: RichTextNode[]): RichTextNode => ({
  type: 'element',
  tag,
  children,
})

const rtParagraph = (value: string) => rtElement('p', [rtText(value)])

const rtHeading = (tag: 'h2' | 'h3' | 'h4', value: string) => rtElement(tag, [rtText(value)])

const rtList = (items: string[]) =>
  rtElement(
    'ul',
    items.map((item) => rtElement('li', [rtText(item)])),
  )

const rtContent = (...nodes: RichTextNode[]) => ({
  richText: nodes,
})

type GuideFeatureSeed = {
  title: string
  description: string
  badge: string
  href: string
  imageUrl: string
  imageAlt: string
}

type GuideFaqSeed = {
  question: string
  answer: string
}

type GuidePageTemplate = {
  path: string
  title: string
  summary: string
  seoTitle: string
  seoDescription: string
  heroImage: string
  heroAlt: string
  eyebrow: string
  heroTitle: string
  heroSubtitle: string
  primaryCtaLabel: string
  primaryCtaHref: string
  secondaryCtaLabel: string
  secondaryCtaHref: string
  introTitle: string
  introParagraphs: string[]
  introBullets: string[]
  introImageUrl: string
  introImageAlt: string
  introGallery?: Array<{ url: string; alt: string }>
  featuresTitle: string
  featuresDescription: string
  features: GuideFeatureSeed[]
  faqTitle: string
  faqDescription: string
  faqs: GuideFaqSeed[]
  ctaTitle: string
  ctaDescription: string
  ctaActions: Array<{ label: string; href: string; external?: boolean }>
}

const buildGuidePageSection = (template: GuidePageTemplate): CmsSectionSeed[] => {
  const introNodes = [
    rtHeading('h2', template.introTitle),
    ...template.introParagraphs.map((paragraph) => rtParagraph(paragraph)),
    template.introBullets.length ? rtHeading('h3', 'Puntos clave') : null,
    template.introBullets.length ? rtList(template.introBullets) : null,
  ].filter(Boolean) as RichTextNode[]

  return [
    {
      type: CmsPageSectionType.MEDIA_HERO,
      key: `${template.path}-hero`,
      settings: {
        mediaType: 'image',
        overlay: true,
        overlayOpacity: 0.6,
        title: template.heroTitle,
        subtitle: template.heroSubtitle,
        eyebrow: template.eyebrow,
        mediaAlt: template.heroAlt,
        primaryCta: { label: template.primaryCtaLabel, href: template.primaryCtaHref },
        secondaryCta: { label: template.secondaryCtaLabel, href: template.secondaryCtaHref },
      },
      blocks: [
        {
          type: CmsPageBlockType.IMAGE,
          name: 'Hero image',
          media: {
            url: template.heroImage,
            alt: template.heroAlt,
            title: template.heroAlt,
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.CONTENT_SPLIT,
      key: `${template.path}-intro`,
      settings: {
        variant: 'media-gallery-content',
        mediaPosition: 'start',
        imageUrl: template.introImageUrl,
        imageAlt: template.introImageAlt,
        description: '',
        title: '',
        gallery: (template.introGallery ?? [{ url: template.introImageUrl, alt: template.introImageAlt }]).map((item, index) => ({
          href: '',
          imageAlt: item.alt || `${template.title} ${index + 1}`,
          imageUrl: item.url,
          linkLabel: '',
        })),
      },
      blocks: [
        {
          type: CmsPageBlockType.RICH_TEXT,
          name: 'Intro copy',
          content: rtContent(...introNodes),
        },
      ],
    },
    {
      type: CmsPageSectionType.FEATURE_GRID,
      key: `${template.path}-features`,
      settings: {
        title: template.featuresTitle,
        description: template.featuresDescription,
        itemHeadingLevel: 'h3',
      },
      blocks: template.features.map((feature, index) => ({
        type: CmsPageBlockType.CARD,
        key: `${template.path}-feature-${index + 1}`,
        name: feature.title,
        content: {
          title: feature.title,
          body: feature.description,
          badge: feature.badge,
          href: feature.href,
          linkLabel: 'Ver más',
          headingLevel: 'h3',
        },
        media: {
          url: feature.imageUrl,
          alt: feature.imageAlt,
          title: feature.title,
          type: CmsMediaType.IMAGE,
          source: 'marketing_cms_seed',
        },
      })),
    },
    {
      type: CmsPageSectionType.FAQ,
      key: `${template.path}-faq`,
      settings: {
        title: template.faqTitle,
        description: template.faqDescription,
      },
      blocks: template.faqs.map((faq, index) => ({
        type: CmsPageBlockType.FAQ_ITEM,
        key: `${template.path}-faq-${index + 1}`,
        name: faq.question,
        content: {
          question: faq.question,
          answerRichText: [rtParagraph(faq.answer)],
        },
      })),
    },
    {
      type: CmsPageSectionType.CTA_BANNER,
      key: `${template.path}-cta`,
      settings: {
        title: template.ctaTitle,
        description: template.ctaDescription,
        intent: 'transactional',
        actions: template.ctaActions,
      },
    },
  ]
}

const buildGuidePage = (template: GuidePageTemplate): CmsPageSeed => ({
  path: template.path,
  title: template.title,
  summary: template.summary,
  seoTitle: template.seoTitle,
  seoDescription: template.seoDescription,
  seoImageUrl: template.heroImage,
  sections: buildGuidePageSection(template),
})

const guidePages: CmsPageSeed[] = [
  buildGuidePage({
    path: 'guias/cortinas-pvc-vs-aluminio',
    title: 'PVC vs aluminio en cortinas de enrollar',
    summary: 'Comparativa clara para elegir entre practicidad, resistencia y mantenimiento.',
    seoTitle: 'PVC vs aluminio en cortinas de enrollar | Urucortinas',
    seoDescription:
      'Compará cortinas de enrollar en PVC y aluminio para elegir la mejor opción según uso, exposición y mantenimiento.',
    heroImage: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg',
    heroAlt: 'Cortinas de enrollar en aluminio',
    eyebrow: 'Guía de decisión',
    heroTitle: 'PVC o aluminio: elegí la cortina de enrollar correcta',
    heroSubtitle:
      'Compará durabilidad, mantenimiento y exposición para decidir con menos dudas.',
    primaryCtaLabel: 'Ver cortinas de enrollar',
    primaryCtaHref: '/productos/cortinas-de-enrollar.html',
    secondaryCtaLabel: 'Ver precios',
    secondaryCtaHref: '/precios/cortinas-de-enrollar',
    introTitle: 'Cuándo conviene cada material',
    introParagraphs: [
      'El PVC prioriza practicidad y un costo más accesible, mientras que el aluminio suma firmeza y una respuesta más robusta para frentes expuestos.',
      'La medida, la exposición al clima y el uso diario terminan de definir cuál conviene más en cada proyecto.',
    ],
    introBullets: [
      'PVC = practicidad y menor mantenimiento',
      'Aluminio = más robustez para frentes expuestos',
      'La exposición y el uso diario cambian la recomendación',
      'Podés pedir asesoramiento sin costo en Montevideo',
    ],
    introImageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg',
    introImageAlt: 'Cortinas de enrollar en uso',
    introGallery: [
      { url: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg', alt: 'Cortinas de enrollar 1' },
      { url: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg', alt: 'Cortinas de enrollar 2' },
      { url: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg', alt: 'Cortinas de enrollar 3' },
    ],
    featuresTitle: 'Qué mirar antes de elegir',
    featuresDescription: 'Tres criterios simples para decidir sin perder tiempo.',
    features: [
      {
        title: 'PVC práctico',
        description: 'Más accesible y fácil de mantener en usos donde la exposición no es extrema.',
        badge: 'Entry',
        href: '/productos/cortinas-de-enrollar-pvc.html',
        imageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg',
        imageAlt: 'Cortina de enrollar PVC',
      },
      {
        title: 'Aluminio robusto',
        description: 'Mejor para frentes expuestos y usos más intensivos.',
        badge: 'Durable',
        href: '/productos/cortinas-de-enrollar-aluminio.html',
        imageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg',
        imageAlt: 'Cortina de enrollar aluminio',
      },
      {
        title: 'Elegí según uso',
        description: 'La frecuencia de uso, el clima y el mantenimiento esperado cambian la recomendación.',
        badge: 'Decision',
        href: '/contacto.html',
        imageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg',
        imageAlt: 'Decisión de producto',
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faqDescription: 'Respuestas cortas para avanzar con más seguridad.',
    faqs: [
      {
        question: '¿Se pueden instalar sin obra?',
        answer: 'Sí. En muchos casos se instalan sin albañilería y se coordinan según el frente.',
      },
      {
        question: '¿Cuál conviene para frentes expuestos?',
        answer: 'En frentes más expuestos, el aluminio suele ofrecer una respuesta más robusta.',
      },
      {
        question: '¿Puedo pedir visita antes de decidir?',
        answer: 'Sí. Podemos coordinar una visita y revisar medidas, uso y exposición antes de cotizar.',
      },
    ],
    ctaTitle: 'Pedí una orientación comercial y compará opciones reales',
    ctaDescription: 'Te ayudamos a bajar la decisión a medidas, uso y presupuesto.',
    ctaActions: [
      { label: 'Solicitar visita', href: '/contact' },
      { label: 'Ver precios', href: '/precios/cortinas-de-enrollar' },
      { label: 'Ver fotos y videos', href: '/multimedia' },
    ],
  }),
  buildGuidePage({
    path: 'guias/dvh',
    title: 'Qué es DVH y cuándo conviene',
    summary: 'Una guía simple para entender el doble vidriado hermético en aberturas de aluminio.',
    seoTitle: 'Qué es DVH y cuándo conviene | Urucortinas',
    seoDescription:
      'Descubrí qué aporta el doble vidriado hermético, en qué casos conviene y cómo impacta en confort térmico y acústico.',
    heroImage: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
    heroAlt: 'Aberturas en aluminio con DVH',
    eyebrow: 'Guía técnica',
    heroTitle: 'DVH: más confort, menos ruido y mejor percepción de valor',
    heroSubtitle: 'Una explicación breve para decidir con más claridad en obra o recambio.',
    primaryCtaLabel: 'Ver aberturas',
    primaryCtaHref: '/productos/aberturas-aluminio.html',
    secondaryCtaLabel: 'Ver serie 20 y 25',
    secondaryCtaHref: '/guias/probba-vs-gala',
    introTitle: 'Qué aporta el doble vidriado hermético',
    introParagraphs: [
      'El DVH mejora el confort térmico y ayuda a reducir el ruido exterior. En obra nueva y en recambio puede marcar una diferencia clara en la percepción de calidad.',
      'No siempre es obligatorio, pero sí suele ser una mejor inversión cuando buscás más confort o un cierre más completo.',
    ],
    introBullets: [
      'Mejor confort térmico',
      'Menos ruido exterior',
      'Más valor percibido en la vivienda',
      'Ideal para obra nueva y recambio con más exigencia',
    ],
    introImageUrl: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
    introImageAlt: 'Doble vidriado hermético',
    introGallery: [
      { url: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg', alt: 'DVH 1' },
      { url: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg', alt: 'DVH 2' },
      { url: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg', alt: 'DVH 3' },
    ],
    featuresTitle: 'Beneficios más claros del DVH',
    featuresDescription: 'Tres motivos frecuentes para sumar doble vidrio hermético.',
    features: [
      {
        title: 'Confort térmico',
        description: 'Ayuda a estabilizar mejor la temperatura interior.',
        badge: 'Comfort',
        href: '/productos/aberturas-aluminio.html',
        imageUrl: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
        imageAlt: 'Confort térmico',
      },
      {
        title: 'Aislamiento acústico',
        description: 'Reduce la sensación de ruido en entornos más expuestos.',
        badge: 'Silence',
        href: '/productos/aberturas-aluminio.html',
        imageUrl: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
        imageAlt: 'Aislamiento acústico',
      },
      {
        title: 'Valor percibido',
        description: 'Suma una lectura más premium en el proyecto final.',
        badge: 'Value',
        href: '/contacto.html',
        imageUrl: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
        imageAlt: 'Valor percibido',
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faqDescription: 'Respuestas cortas para decidir si conviene sumar DVH.',
    faqs: [
      {
        question: '¿DVH siempre conviene?',
        answer: 'No siempre, pero sí suele aportar más valor cuando buscás confort y mejor cierre.',
      },
      {
        question: '¿Sirve en obra nueva y recambio?',
        answer: 'Sí. En ambos casos puede mejorar el resultado final y la percepción de calidad.',
      },
      {
        question: '¿Con qué series se combina?',
        answer: 'Normalmente se evalúa junto a la serie, el tipo de apertura y el uso esperado del ambiente.',
      },
    ],
    ctaTitle: 'Pedí asesoramiento para combinar serie y vidrio',
    ctaDescription: 'Te ayudamos a elegir la abertura correcta según uso, exposición y presupuesto.',
    ctaActions: [
      { label: 'Ver aberturas', href: '/productos/aberturas-aluminio.html' },
      { label: 'Consultar medidas', href: '/contacto.html' },
      { label: 'Ver guía de series', href: '/guias/probba-vs-gala' },
    ],
  }),
  buildGuidePage({
    path: 'guias/probba-vs-gala',
    title: 'Probba, Gala y serie 25',
    summary: 'Una guía breve para elegir la mejor abertura en aluminio sin ruido técnico innecesario.',
    seoTitle: 'Probba vs Gala | Serie 20 y 25 en aberturas de aluminio',
    seoDescription:
      'Entendé cómo elegir entre Probba, Gala, Serie 20 y Serie 25 según uso, apertura y nivel de prestación.',
    heroImage: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
    heroAlt: 'Series de aberturas de aluminio',
    eyebrow: 'Comparativa técnica',
    heroTitle: 'Probba, Gala y serie 25: cómo elegir la abertura correcta',
    heroSubtitle: 'Una guía corta para entender las diferencias sin perder tiempo.',
    primaryCtaLabel: 'Ver aberturas',
    primaryCtaHref: '/productos/aberturas-aluminio.html',
    secondaryCtaLabel: 'Ver DVH',
    secondaryCtaHref: '/guias/dvh',
    introTitle: 'Series y criterios de elección',
    introParagraphs: [
      'La decisión no pasa solo por el nombre de la línea. También importa el tipo de apertura, el nivel de exposición y si el proyecto requiere más prestación o una solución estándar.',
      'En obra nueva o recambio, el objetivo es ordenar la elección con criterios simples: uso, presupuesto y expectativa de terminación.',
    ],
    introBullets: [
      'Serie 20 para múltiples usos',
      'Serie 25 para mayor prestación',
      'Alta prestación cuando importa más la robustez',
      'DVH suma confort y valor percibido',
    ],
    introImageUrl: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
    introImageAlt: 'Series de aluminio',
    introGallery: [
      { url: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg', alt: 'Serie 20' },
      { url: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg', alt: 'Serie 25' },
      { url: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg', alt: 'Alta prestación' },
    ],
    featuresTitle: 'Cómo pensar la elección',
    featuresDescription: 'Tres niveles de lectura para elegir sin fricción.',
    features: [
      {
        title: 'Serie 20',
        description: 'Sirve en múltiples usos cuando buscás una solución sólida pero estándar.',
        badge: 'Standard',
        href: '/productos/aberturas-aluminio.html',
        imageUrl: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
        imageAlt: 'Serie 20',
      },
      {
        title: 'Serie 25',
        description: 'Mejora la prestación cuando el proyecto necesita un poco más de respuesta.',
        badge: 'Better',
        href: '/productos/aberturas-aluminio.html',
        imageUrl: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
        imageAlt: 'Serie 25',
      },
      {
        title: 'Alta prestación',
        description: 'Conviene cuando la robustez y la terminación pesan más en la decisión.',
        badge: 'Premium',
        href: '/productos/aberturas-aluminio.html',
        imageUrl: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
        imageAlt: 'Alta prestación',
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faqDescription: 'Respuestas breves para bajar el ruido de decisión.',
    faqs: [
      {
        question: '¿Probba o Gala?',
        answer: 'La elección depende de la serie, del nivel de prestación y del uso esperado del ambiente.',
      },
      {
        question: '¿Serie 20 o 25?',
        answer: 'La serie 25 suele ganar cuando buscás un poco más de respuesta y robustez.',
      },
      {
        question: '¿Se puede combinar con DVH?',
        answer: 'Sí. Es una combinación habitual cuando el objetivo es sumar confort y percepción de calidad.',
      },
    ],
    ctaTitle: 'Te ayudamos a elegir la serie correcta',
    ctaDescription: 'Si ya tenés medidas aproximadas, te orientamos más rápido con una propuesta concreta.',
    ctaActions: [
      { label: 'Ver aberturas', href: '/productos/aberturas-aluminio.html' },
      { label: 'Consultar medidas', href: '/contacto.html' },
      { label: 'Ver guía DVH', href: '/guias/dvh' },
    ],
  }),
  buildGuidePage({
    path: 'guias/como-medir-ancho-y-alto',
    title: 'Cómo medir ancho y alto sin errores',
    summary: 'Una guía práctica para pedir presupuesto con menos fricción y menos correcciones.',
    seoTitle: 'Cómo medir ancho y alto | Urucortinas',
    seoDescription:
      'Aprendé a tomar medidas de ancho y alto para cortinas, persianas y aberturas antes de pedir presupuesto.',
    heroImage: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg',
    heroAlt: 'Cómo medir ancho y alto',
    eyebrow: 'Guía práctica',
    heroTitle: 'Cómo medir ancho y alto sin errores',
    heroSubtitle: 'Una checklist simple para pedir presupuesto con más claridad.',
    primaryCtaLabel: 'Solicitar visita',
    primaryCtaHref: '/contact',
    secondaryCtaLabel: 'Ver precios',
    secondaryCtaHref: '/precios/cortinas-de-enrollar',
    introTitle: 'Qué medir antes de cotizar',
    introParagraphs: [
      'Medir bien el ancho y el alto evita correcciones y acelera el presupuesto. Si además podés enviar una foto del frente, la recomendación mejora bastante.',
      'La medida correcta no es solo una cifra: también importa la ubicación, los obstáculos y el tipo de producto que vas a instalar.',
    ],
    introBullets: [
      'Ancho en tres puntos',
      'Alto en tres puntos',
      'Revisá obstáculos y terminaciones',
      'Sumá una foto del frente si podés',
    ],
    introImageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg',
    introImageAlt: 'Toma de medidas',
    introGallery: [
      { url: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg', alt: 'Medición 1' },
      { url: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg', alt: 'Medición 2' },
      { url: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg', alt: 'Medición 3' },
    ],
    featuresTitle: 'Tres cosas que no conviene olvidar',
    featuresDescription: 'La cotización mejora cuando la medición llega completa.',
    features: [
      {
        title: 'Ancho',
        description: 'Tomalo en varios puntos para detectar diferencias o desvíos.',
        badge: 'Width',
        href: '/contact',
        imageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg',
        imageAlt: 'Ancho',
      },
      {
        title: 'Alto',
        description: 'Medí el alto total y revisá si hay remates, dinteles o interferencias.',
        badge: 'Height',
        href: '/contact',
        imageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg',
        imageAlt: 'Alto',
      },
      {
        title: 'Obstáculos',
        description: 'Cableado, marcos, manijas o revoques pueden cambiar la recomendación.',
        badge: 'Context',
        href: '/contact',
        imageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg',
        imageAlt: 'Obstáculos',
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faqDescription: 'Respuestas simples para reducir dudas antes de cotizar.',
    faqs: [
      {
        question: '¿Hace falta medir perfecto?',
        answer: 'No hace falta perfección absoluta, pero sí una medida bien tomada y consistente.',
      },
      {
        question: '¿Puedo pedir visita en lugar de medir yo?',
        answer: 'Sí. Podés coordinar una visita para tomar medidas y revisar el caso en persona.',
      },
      {
        question: '¿Sirve para pedir precios online?',
        answer: 'Sí. Una medida aproximada ya ayuda a orientar mejor el presupuesto inicial.',
      },
    ],
    ctaTitle: 'Si ya tenés una medida aproximada, seguimos desde ahí',
    ctaDescription: 'Podemos revisar el dato y orientarte con mayor precisión.',
    ctaActions: [
      { label: 'Solicitar visita', href: '/contact' },
      { label: 'Ver precios', href: '/precios/cortinas-de-enrollar' },
      { label: 'Ver multimedia', href: '/multimedia' },
    ],
  }),
  buildGuidePage({
    path: 'precios/cortinas-de-enrollar',
    title: 'Precios de cortinas de enrollar',
    summary: 'Una guía para entender por qué dos cortinas similares pueden cotizar distinto.',
    seoTitle: 'Precios de cortinas de enrollar | Urucortinas',
    seoDescription:
      'Entendé qué influye en el precio de una cortina de enrollar: material, medidas, motorización e instalación.',
    heroImage: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg',
    heroAlt: 'Precios de cortinas de enrollar',
    eyebrow: 'Guía comercial',
    heroTitle: 'Cuánto influyen medidas, material y automatización en el precio',
    heroSubtitle: 'Una explicación corta para pedir presupuesto con expectativas más reales.',
    primaryCtaLabel: 'Ver cortinas de enrollar',
    primaryCtaHref: '/productos/cortinas-de-enrollar.html',
    secondaryCtaLabel: 'Solicitar presupuesto',
    secondaryCtaHref: '/contacto.html',
    introTitle: 'Qué mueve el precio',
    introParagraphs: [
      'El material, las medidas, el tipo de accionamiento y la exposición del frente cambian el valor final.',
      'Una cortina más grande, motorizada o pensada para un uso más exigente va a tener un costo distinto a una solución más simple.',
    ],
    introBullets: [
      'Material',
      'Medidas',
      'Manual o motorizada',
      'Exposición y terminaciones',
    ],
    introImageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg',
    introImageAlt: 'Precio de cortinas de enrollar',
    introGallery: [
      { url: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg', alt: 'Precio 1' },
      { url: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg', alt: 'Precio 2' },
      { url: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg', alt: 'Precio 3' },
    ],
    featuresTitle: 'Tres factores que más pesan en el presupuesto',
    featuresDescription: 'Una lectura comercial simple para reducir la fricción del primer contacto.',
    features: [
      {
        title: 'PVC',
        description: 'Suele ser la alternativa más accesible cuando la prioridad es practicidad.',
        badge: 'Entry',
        href: '/productos/cortinas-de-enrollar-pvc.html',
        imageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/IMG-20240826-WA0159.jpg',
        imageAlt: 'PVC',
      },
      {
        title: 'Aluminio',
        description: 'Suma robustez y suele subir cuando el frente está más expuesto.',
        badge: 'Durable',
        href: '/productos/cortinas-de-enrollar-aluminio.html',
        imageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg',
        imageAlt: 'Aluminio',
      },
      {
        title: 'Motorización',
        description: 'La automatización agrega confort y una configuración más completa.',
        badge: 'Comfort',
        href: '/productos/motores-cortinas-y-persianas.html',
        imageUrl: '/media/products/cortinas-roller/images/20211218_193930.jpg',
        imageAlt: 'Motorización',
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faqDescription: 'Respuestas cortas para pedir una cotización mejor armada.',
    faqs: [
      {
        question: '¿Qué datos hacen falta para pedir precio?',
        answer: 'Con una medida aproximada y una foto del frente ya podemos orientar bastante mejor.',
      },
      {
        question: '¿La visita en Montevideo tiene costo?',
        answer: 'En Montevideo la visita es sin costo y ayuda a cerrar mejor la recomendación.',
      },
      {
        question: '¿Puedo comparar PVC y aluminio antes de decidir?',
        answer: 'Sí. Esa comparativa suele ser la más útil para un primer presupuesto.',
      },
    ],
    ctaTitle: 'Pedí una cotización con medidas aproximadas',
    ctaDescription: 'Si ya tenés una referencia del frente, te ayudamos a bajar el presupuesto con más precisión.',
    ctaActions: [
      { label: 'Solicitar presupuesto', href: '/contacto.html' },
      { label: 'Ver opciones', href: '/guias/cortinas-pvc-vs-aluminio' },
      { label: 'Solicitar visita', href: '/contact' },
    ],
  }),
  buildGuidePage({
    path: 'servicios/reparacion-cortinas-y-persianas.html',
    title: 'Reparación de cortinas y persianas',
    summary: 'Resolver antes de reemplazar cuando el sistema todavía tiene arreglo.',
    seoTitle: 'Reparación de cortinas y persianas | Urucortinas',
    seoDescription:
      'Servicio de reparación de cortinas y persianas con diagnóstico, repuestos e instalación para resolver antes de reemplazar.',
    heroImage: '/media/products/cortinas-metalicas/images/WhatsApp Image 2025-11-06 at 14.18.59.jpeg',
    heroAlt: 'Reparación de cortinas y persianas',
    eyebrow: 'Servicio',
    heroTitle: 'Reparación de cortinas y persianas',
    heroSubtitle: 'Si todavía tiene arreglo, te orientamos sobre la reparación más conveniente.',
    primaryCtaLabel: 'Solicitar reparación',
    primaryCtaHref: '/contact',
    secondaryCtaLabel: 'Ver fotos y videos',
    secondaryCtaHref: '/multimedia',
    introTitle: 'Cuándo conviene reparar',
    introParagraphs: [
      'Antes de reemplazar, conviene revisar si el sistema todavía tiene una solución práctica. Muchas veces un diagnóstico correcto evita un gasto mayor.',
      'Atascos, cintas, láminas, guías o motorización pueden requerir una intervención puntual y seguir funcionando bien.',
    ],
    introBullets: [
      'Atascos y trabas',
      'Láminas o partes dañadas',
      'Cintas y mecanismos',
      'Motorización y automatismos',
    ],
    introImageUrl: '/media/products/cortinas-roller/images/20211218_193930.jpg',
    introImageAlt: 'Reparación de cortinas',
    introGallery: [
      { url: '/media/products/cortinas-roller/images/20211218_193930.jpg', alt: 'Reparación 1' },
      { url: '/media/products/cortinas-metalicas/images/WhatsApp Image 2025-11-06 at 14.18.59.jpeg', alt: 'Reparación 2' },
      { url: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg', alt: 'Reparación 3' },
    ],
    featuresTitle: 'Qué resolvemos con más frecuencia',
    featuresDescription: 'Una lectura simple para saber si vale la pena reparar o reemplazar.',
    features: [
      {
        title: 'Diagnóstico',
        description: 'Revisamos la falla y definimos si la reparación tiene sentido.',
        badge: 'Step 1',
        href: '/contact',
        imageUrl: '/media/products/cortinas-roller/images/20211218_193930.jpg',
        imageAlt: 'Diagnóstico',
      },
      {
        title: 'Repuestos',
        description: 'Cuando hace falta, buscamos la pieza o solución más cercana.',
        badge: 'Step 2',
        href: '/contact',
        imageUrl: '/media/products/cortinas-metalicas/images/WhatsApp Image 2025-11-06 at 14.18.59.jpeg',
        imageAlt: 'Repuestos',
      },
      {
        title: 'Instalación',
        description: 'Dejamos el sistema funcionando y con una lectura comercial clara.',
        badge: 'Step 3',
        href: '/contact',
        imageUrl: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg',
        imageAlt: 'Instalación',
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faqDescription: 'Respuestas útiles para pedir ayuda sin vueltas.',
    faqs: [
      {
        question: '¿Se puede reparar en obra?',
        answer: 'Sí, muchas reparaciones se hacen sin reemplazar todo el sistema.',
      },
      {
        question: '¿Cuándo conviene cambiar en lugar de reparar?',
        answer: 'Cuando la falla es estructural, hay desgaste excesivo o el sistema quedó fuera de uso.',
      },
      {
        question: '¿Atienden Montevideo y el interior?',
        answer: 'Sí. Coordinamos el alcance según el tipo de trabajo y la ubicación.',
      },
    ],
    ctaTitle: 'Coordiná una revisión y te decimos si vale la pena reparar',
    ctaDescription: 'Si todavía puede recuperarse, te lo vamos a decir claro.',
    ctaActions: [
      { label: 'Solicitar reparación', href: '/contact' },
      { label: 'Ver servicio', href: '/servicios/reparacion-cortinas-y-persianas.html' },
      { label: 'Ver multimedia', href: '/multimedia' },
    ],
  }),
]

const homePage: CmsPageSeed = {
  path: '',
  title: 'Urucortinas',
  summary:
    'Soluciones a medida en cortinas roller, persianas, toldos, aberturas y automatización con instalación, reparación y seguimiento comercial.',
  seoTitle: 'Urucortinas | Cortinas, persianas, toldos y aberturas a medida',
  seoDescription:
    'Cortinas roller, cortinas de enrollar, bandas verticales, venecianas, toldos y aberturas en aluminio con instalación, mantenimiento y reparación.',
  seoImageUrl: '/uploads/cms/legacy-assets/img/intro-carousel/roller-6.jpeg',
  sections: [
    {
      type: CmsPageSectionType.SITE_HEADER,
      key: 'site-header',
      settings: {
        items: [
          { label: 'Inicio', href: '/' },
          { label: 'Tienda', href: '/shop' },
          {
            label: 'Productos',
            href: '/shop',
            items: [
              { label: 'Cortinas Roller', href: '/productos/cortinas-roller.html' },
              { label: 'Cortinas de enrollar', href: '/productos/cortinas-de-enrollar.html' },
              { label: 'Bandas verticales', href: '/productos/bandas-verticales.html' },
              { label: 'Venecianas', href: '/productos/venecianas.html' },
              { label: 'Aberturas en aluminio', href: '/productos/aberturas-aluminio.html' },
              { label: 'Toldos y cerramientos', href: '/productos/toldos-y-cerramientos.html' },
              { label: 'Motores y automatismos', href: '/productos/motores-cortinas-y-persianas.html' },
              { label: 'Cortinas metálicas', href: '/productos/cortinas-metalicas.html' },
            ],
          },
          {
            label: 'Servicios',
            href: '/servicios/reparacion-cortinas-y-persianas.html',
            items: [
              { label: 'Reparación', href: '/servicios/reparacion-cortinas-y-persianas.html' },
              { label: 'Reparación urgente', href: '/servicios/reparacion-urgente' },
              { label: 'Instalación de aberturas', href: '/servicios/instalacion-aberturas.html' },
            ],
          },
          {
            label: 'Guías',
            href: '/guias/cortinas-pvc-vs-aluminio',
            items: [
              { label: 'PVC vs aluminio', href: '/guias/cortinas-pvc-vs-aluminio' },
              { label: 'Precios de cortinas', href: '/precios/cortinas-de-enrollar' },
              { label: 'Qué es DVH', href: '/productos/dvh.html' },
            ],
          },
          { label: 'Contacto', href: '/contacto.html' },
        ],
      },
      blocks: [],
    },
    {
      type: CmsPageSectionType.HERO,
      key: 'home-hero',
      settings: {
        title: 'Soluciones a medida para hogar, comercio y obra',
        description:
          'Cortinas de enrollar, aberturas, toldos y automatización con instalación, reparación y asesoramiento real.',
        eyebrow: 'Urucortinas',
        headingLevel: 'h1',
        backgroundImageUrl: '/uploads/cms/legacy-assets/img/intro-carousel/roller-6.jpeg',
        primaryCtaLabel: 'Ver cortinas de enrollar',
        primaryCtaHref: '/productos/cortinas-de-enrollar.html',
        secondaryCtaLabel: 'Explorar catálogo',
        secondaryCtaHref: '/shop',
        slides: [
          {
            title: 'Cortinas de enrollar para obra nueva o recambio',
            description:
              'Una opción práctica para frentes, hogares y comercios que necesitan resistencia, control y mantenimiento simple.',
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
            imageAlt: 'Cortinas de enrollar',
            href: '/productos/cortinas-de-enrollar.html',
            linkLabel: 'Ver cortinas de enrollar',
          },
          {
            title: 'Aberturas en aluminio con vidrio simple o DVH',
            description:
              'Soluciones en serie 20 y 25 para obra y recambio con mejor aislamiento, terminación y durabilidad.',
            imageUrl: '/uploads/cms/legacy-assets/img/aberturas/images.jpg',
            imageAlt: 'Aberturas en aluminio',
            href: '/productos/aberturas-aluminio.html',
            linkLabel: 'Ver aberturas',
          },
          {
            title: 'Toldos y cerramientos para exterior',
            description: 'Protección solar, sombra y uso exterior para resolver el espacio con una solución a medida.',
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo.jpg',
            imageAlt: 'Toldos y cerramientos',
            href: '/productos/toldos-y-cerramientos.html',
            linkLabel: 'Ver toldos',
          },
          {
            title: 'Motores y automatismos para más confort',
            description:
              'Automatización para cortinas roller, persianas y cortinas metálicas con más comodidad en el uso diario.',
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
            imageAlt: 'Motores y automatismos',
            href: '/productos/motores-cortinas-y-persianas.html',
            linkLabel: 'Ver motores',
          },
        ],
      },
      blocks: [],
    },
    {
      type: CmsPageSectionType.MEDIA_GRID_ENHANCED,
      key: 'home-products-grid',
      settings: {
        title: 'Soluciones por tipo de necesidad',
        description:
          'Encontrá rápido la solución que mejor se adapta a tu proyecto: exterior, interior, obra o automatización.',
        columns: 4,
        gap: 1.1,
        aspectRatio: '4 / 5',
      },
      blocks: [
        {
          type: CmsPageBlockType.CARD,
          name: 'Cortinas de enrollar',
          content: {
            title: 'Cortinas de enrollar',
            description:
              'Persianas en PVC o aluminio con opción manual o motorizada según uso, exposición y mantenimiento.',
            badge: 'Exterior',
            overlayText: true,
            linkLabel: 'Ver opciones',
            href: '/productos/cortinas-de-enrollar.html',
          },
          media: {
            url: '/media/products/cortinas-de-enrollar-aluminio/images/catalana_1.jpeg',
            alt: 'Cortinas de enrollar',
            title: 'Cortinas de enrollar',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Aberturas en aluminio',
          content: {
            title: 'Aberturas en aluminio',
            description:
              'Puertas, ventanas y monoblocks con vidrio simple o DVH para obra o recambio.',
            badge: 'Obra y recambio',
            overlayText: true,
            linkLabel: 'Ver aberturas',
            href: '/productos/aberturas-aluminio.html',
          },
          media: {
            url: '/media/products/aberturas-aluminio/images/aberturas__32807525_580319532349310_975320518108381184_n.jpg',
            alt: 'Aberturas en aluminio',
            title: 'Aberturas en aluminio',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Toldos y cerramientos',
          content: {
            title: 'Toldos y cerramientos',
            description: 'Protección solar, sombra y uso exterior con una solución a medida.',
            badge: 'Exterior',
            overlayText: true,
            linkLabel: 'Ver toldos',
            href: '/productos/toldos-y-cerramientos.html',
          },
          media: {
            url: '/assets/images/banners/banner-24.jpg',
            alt: 'Toldos y cerramientos',
            title: 'Toldos y cerramientos',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Motores y automatismos',
          content: {
            title: 'Motores y automatismos',
            description:
              'Más confort en el uso diario con control remoto y automatización.',
            badge: 'Automatización',
            overlayText: true,
            linkLabel: 'Ver motores',
            href: '/productos/motores-cortinas-y-persianas.html',
          },
          media: {
            url: '/media/products/cortinas-roller/images/20211218_193930.jpg',
            alt: 'Motores y automatismos',
            title: 'Motores y automatismos',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Cortinas Roller',
          content: {
            title: 'Cortinas Roller',
            description:
              'Solución interior moderna y funcional para regular luz y privacidad en hogar u oficina.',
            badge: 'Interior',
            overlayText: true,
            linkLabel: 'Más información',
            href: '/productos/cortinas-roller.html',
          },
          media: {
            url: '/media/products/cortinas-roller/images/20211218_193930.jpg',
            alt: 'Cortinas Roller',
            title: 'Cortinas Roller',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Bandas verticales',
          content: {
            title: 'Bandas verticales',
            description:
              'Versatilidad y elegancia para oficinas, living y ventanales amplios con control de luz.',
            badge: 'Amplios vidriados',
            overlayText: true,
            linkLabel: 'Ver bandas verticales',
            href: '/productos/bandas-verticales.html',
          },
          media: {
            url: '/media/products/bandas-verticales/images/WhatsApp Image 2020-07-10 at 13.53.45.jpeg',
            alt: 'Bandas verticales',
            title: 'Bandas verticales',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Cortinas Venecianas',
          content: {
            title: 'Cortinas Venecianas',
            description:
              'Lamas de 16 mm y 25 mm para controlar luz y privacidad con una terminación limpia.',
            badge: 'Control de luz',
            overlayText: true,
            linkLabel: 'Ver venecianas',
            href: '/productos/venecianas.html',
          },
          media: {
            url: '/media/products/venecianas/images/cortina_veneciana_1.jpeg',
            alt: 'Cortinas Venecianas',
            title: 'Cortinas Venecianas',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Cortinas metálicas',
          content: {
            title: 'Cortinas metálicas',
            description: 'Máxima seguridad para locales y accesos.',
            badge: 'Seguridad',
            overlayText: true,
            linkLabel: 'Ver cortinas metálicas',
            href: '/productos/cortinas-metalicas.html',
          },
          media: {
            url: '/media/products/cortinas-metalicas/images/WhatsApp Image 2025-11-06 at 14.18.59.jpeg',
            alt: 'Cortinas metálicas',
            title: 'Cortinas metálicas',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.HIGHLIGHT_CARDS,
      key: 'home-commercial-support',
      settings: {
        title: 'Acompañamiento comercial real',
        description:
          'Visitas, medidas, pagos y garantía para avanzar con más claridad antes de confirmar el trabajo.',
      },
      blocks: [
        {
          type: CmsPageBlockType.CARD,
          name: 'Visita y toma de medidas',
          content: {
            title: 'Visita y toma de medidas',
            description:
              'Podemos coordinar una visita a domicilio para tomar medidas y orientar tu compra. En Montevideo la visita es sin costo.',
            badge: 'Acompañamiento',
            linkLabel: 'Solicitar visita',
            href: '/contact',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/reparacion-persiana.jpeg',
            alt: 'Visita y toma de medidas',
            title: 'Visita y toma de medidas',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Pagos y financiación',
          content: {
            title: 'Pagos y financiación',
            description:
              'Aceptamos transferencia, efectivo, Mercado Pago y tarjetas. Con Mercado Pago se puede pagar en cuotas.',
            badge: 'Pagos',
            linkLabel: 'Consultar medios de pago',
            href: '/contacto.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/mercadopago-img.jpg',
            alt: 'Mercado Pago',
            title: 'Mercado Pago',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Garantía según producto',
          content: {
            title: 'Garantía en todos nuestros productos y servicios',
            description: 'Ofrecemos garantía en todos nuestros productos y servicios.',
            badge: 'Garantía',
            linkLabel: 'Ver garantía',
            href: '/preguntas-frecuentes',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_2.jpeg',
            alt: 'Garantía según producto',
            title: 'Garantía según producto',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Instalación y mantenimiento',
          content: {
            title: 'Instalación y mantenimiento',
            description:
              'Venta, instalación, mantenimiento y reparación para cortinas, persianas, toldos y aberturas.',
            badge: 'Servicio',
            linkLabel: 'Ver servicios',
            href: '/servicios/reparacion-cortinas-y-persianas.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/reparacion-persiana.jpeg',
            alt: 'Instalación y mantenimiento',
            title: 'Instalación y mantenimiento',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.CTA_BANNER,
      key: 'home-aberturas-cta',
      settings: {
        title: 'Aberturas en aluminio línea estándar y premium',
        description:
          'Puertas, ventanas y monoblocks con vidrio simple o doble vidrio hermético. Consultá por serie 20 y 25.',
        label: 'Saber más',
        href: '/productos/aberturas-aluminio.html',
        intent: 'transactional',
      },
    },
    {
      type: CmsPageSectionType.MEDIA_CAROUSEL,
      key: 'home-clients-carousel',
      settings: {
        title: 'Clientes que confiaron en nuestro trabajo',
        description: 'Marcas e instituciones que nos eligieron para distintos proyectos.',
        variant: 'logos',
        slidesToShow: 5,
        autoplay: true,
        autoplaySpeed: 2800,
        spaceBetween: 18,
      },
      blocks: [
        {
          type: CmsPageBlockType.CARD,
          name: 'Boston Clarks',
          content: {
            title: 'Boston Clarks',
            description: 'Proyecto comercial y de confianza.',
            linkLabel: 'Ver más',
            href: '/contacto.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/clientes/bostonclarks.png',
            alt: 'Boston Clarks',
            title: 'Boston Clarks',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'El Dorado',
          content: {
            title: 'El Dorado',
            description: 'Cliente que confió en nuestro trabajo.',
            linkLabel: 'Ver más',
            href: '/contacto.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/clientes/eldorado.png',
            alt: 'El Dorado',
            title: 'El Dorado',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'La Española',
          content: {
            title: 'La Española',
            description: 'Proyecto en el que aportamos soluciones a medida.',
            linkLabel: 'Ver más',
            href: '/contacto.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/clientes/laespanola.jpg',
            alt: 'La Española',
            title: 'La Española',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Montecon',
          content: {
            title: 'Montecon',
            description: 'Cliente institucional.',
            linkLabel: 'Ver más',
            href: '/contacto.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/clientes/montecon.png',
            alt: 'Montecon',
            title: 'Montecon',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Cousa',
          content: {
            title: 'Cousa',
            description: 'Empresa que confió en nuestra propuesta.',
            linkLabel: 'Ver más',
            href: '/contacto.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/clientes/cousa.jpg',
            alt: 'Cousa',
            title: 'Cousa',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Conatel',
          content: {
            title: 'Conatel',
            description: 'Confianza construida en proyectos reales.',
            linkLabel: 'Ver más',
            href: '/contacto.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/clientes/conatel.png',
            alt: 'Conatel',
            title: 'Conatel',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'SUAT',
          content: {
            title: 'SUAT',
            description: 'Otro cliente que acompañó nuestro trabajo.',
            linkLabel: 'Ver más',
            href: '/contacto.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/clientes/suat.png',
            alt: 'SUAT',
            title: 'SUAT',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.SITE_FOOTER,
      key: 'site-footer',
      settings: {
        linkGroups: [
          [
            { label: 'Tienda', href: '/shop' },
            { label: 'Cortinas Roller', href: '/productos/cortinas-roller.html' },
            { label: 'Cortinas de enrollar', href: '/productos/cortinas-de-enrollar.html' },
            { label: 'Bandas verticales', href: '/productos/bandas-verticales.html' },
          ],
          [
            { label: 'Venecianas', href: '/productos/venecianas.html' },
            { label: 'Aberturas en aluminio', href: '/productos/aberturas-aluminio.html' },
            { label: 'Toldos y cerramientos', href: '/productos/toldos-y-cerramientos.html' },
            { label: 'Motores', href: '/productos/motores-cortinas-y-persianas.html' },
          ],
          [
            { label: 'Reparación', href: '/servicios/reparacion-cortinas-y-persianas.html' },
            { label: 'Guía PVC vs aluminio', href: '/guias/cortinas-pvc-vs-aluminio' },
            { label: 'Precios de cortinas', href: '/precios/cortinas-de-enrollar' },
            { label: 'Contacto', href: '/contacto.html' },
          ],
        ],
        helpLinks: [
          { label: 'Preguntas frecuentes', href: '/preguntas-frecuentes' },
          { label: 'Quiénes somos', href: '/quienes-somos' },
        ],
        socials: [
          { label: 'Instagram', href: 'https://instagram.com', external: true },
          { label: 'Facebook', href: 'https://facebook.com', external: true },
        ],
      },
    },
  ],
}
const productPageTemplates: Array<{
  slug: string
  title: string
  summary: string
  seoImageUrl: string
  heroImage: string
  storyImage: string
  gridImage: string
  secondaryGridImage: string
  videoPoster: string
  badge: string
  subtitle: string
}> = [
  {
    slug: 'qa-var-003',
    title: 'Producto Variable QA API 2',
    summary: 'Landing de producto con foco en tecnología, detalle y prueba visual.',
    seoImageUrl: '/assets/images/products/bghead-phone.png',
    heroImage: '/assets/images/products/bghead-phone.png',
    storyImage: '/assets/images/stories/story-home-1.jpg',
    gridImage: '/assets/images/banners/banner-11.jpg',
    secondaryGridImage: '/assets/images/banners/banner-12.jpg',
    videoPoster: '/assets/images/banners/banner-13.jpg',
    badge: 'New release',
    subtitle: 'Diseño limpio, media dominante y conversiones más claras.',
  },
  {
    slug: 'ventana-corrediza-20-blanco-3mm-1200x2000',
    title: 'Ventana Corrediza 20 Blanco 3mm 1200x2000',
    summary: 'Landing de producto orientada a performance y credibilidad visual.',
    seoImageUrl: '/assets/images/banners/banner-15.jpg',
    heroImage: '/assets/images/banners/banner-15.jpg',
    storyImage: '/assets/images/stories/story-home-2.jpg',
    gridImage: '/assets/images/banners/banner-16.jpg',
    secondaryGridImage: '/assets/images/banners/banner-17.jpg',
    videoPoster: '/assets/images/banners/banner-18.jpg',
    badge: 'Performance',
    subtitle: 'Más contexto visual para una decisión de compra más rápida.',
  },
  {
    slug: 'ventana-corrediza-20-blanco-3mm-1400x600',
    title: 'Ventana Corrediza 20 Blanco 3mm 1400x600',
    summary: 'Landing de producto con foco premium y detalles de acabado.',
    seoImageUrl: '/assets/images/products/watch.png',
    heroImage: '/assets/images/products/watch.png',
    storyImage: '/assets/images/stories/story-home-3.jpg',
    gridImage: '/assets/images/banners/banner-19.jpg',
    secondaryGridImage: '/assets/images/banners/banner-20.jpg',
    videoPoster: '/assets/images/banners/banner-21.jpg',
    badge: 'Premium',
    subtitle: 'Escala, brillo y percepción de valor en una sola secuencia.',
  },
  {
    slug: 'ventana-corrediza-20-blanco-3mm-1500x1500',
    title: 'Ventana Corrediza 20 Blanco 3mm 1500x1500',
    summary: 'Landing de producto para moda, uso y comparación visual.',
    seoImageUrl: '/assets/images/products/clothes.png',
    heroImage: '/assets/images/products/clothes.png',
    storyImage: '/assets/images/banners/banner-22.jpg',
    gridImage: '/assets/images/banners/banner-22.jpg',
    secondaryGridImage: '/assets/images/banners/banner-23.jpg',
    videoPoster: '/assets/images/banners/banner-24.jpg',
    badge: 'Style',
    subtitle: 'La secuencia visual hace de puente entre inspiración y compra.',
  },
  {
    slug: 'ventana-corrediza-20-blanco-3mm-1500x2000',
    title: 'Ventana Corrediza 20 Blanco 3mm 1500x2000',
    summary: 'Landing de producto con foco en utilidad, estilo y portabilidad.',
    seoImageUrl: '/assets/images/products/gaming-gear.png',
    heroImage: '/assets/images/products/gaming-gear.png',
    storyImage: '/assets/images/banners/banner-25.jpg',
    gridImage: '/assets/images/banners/banner-24.jpg',
    secondaryGridImage: '/assets/images/banners/banner-25.jpg',
    videoPoster: '/assets/images/banners/banner-1.png',
    badge: 'Daily use',
    subtitle: 'Una narrativa más ligera para productos que se venden por contexto.',
  },
]

const buildProductPage = (template: (typeof productPageTemplates)[number]): CmsPageSeed => {
  const heroTitle = `${template.title} en contexto`

  return {
    path: `product/${template.slug}`,
    title: template.title,
    summary: template.summary,
    seoTitle: `${template.title} | Experiencia visual de producto`,
    seoDescription: template.summary,
    seoImageUrl: template.seoImageUrl,
    sections: [
      {
        type: CmsPageSectionType.MEDIA_HERO,
        key: `${template.slug}-hero`,
        settings: {
          mediaType: 'image',
          overlay: true,
          overlayOpacity: 0.56,
          title: heroTitle,
          subtitle: template.subtitle,
          eyebrow: template.badge,
          mediaAlt: `${template.title} hero`,
          primaryCta: { label: 'Ver categoría', href: '/categories' },
          secondaryCta: { label: 'Ver categorías', href: '/categories' },
        },
        blocks: [
          {
            type: CmsPageBlockType.IMAGE,
            name: 'Hero image',
            media: {
              url: template.heroImage,
              alt: `${template.title} hero`,
              title: `${template.title} hero`,
              type: CmsMediaType.IMAGE,
              source: 'marketing_cms_seed',
            },
          },
        ],
      },
      {
        type: CmsPageSectionType.HIGHLIGHT_CARDS,
        key: `${template.slug}-benefits`,
        settings: {
          title: `Beneficios de ${template.title}`,
          description: 'Un bloque directo para reducir dudas y reforzar el valor percibido.',
        },
        blocks: [
          {
            type: CmsPageBlockType.CARD,
            name: 'Benefit 1',
            content: {
              title: 'Diseño que se entiende rápido',
              description: 'La primera lectura queda clara en menos de un scroll.',
              badge: 'UX',
              linkLabel: 'Seguir',
              href: `/product/${template.slug}`,
            },
            media: {
              url: template.storyImage,
              alt: 'Diseño que se entiende rápido',
              title: 'Diseño',
              type: CmsMediaType.IMAGE,
              source: 'marketing_cms_seed',
            },
          },
          {
            type: CmsPageBlockType.CARD,
            name: 'Benefit 2',
            content: {
              title: 'Prueba visual',
              description: 'Más contexto, menos fricción y mejor lectura del producto.',
              badge: 'Proof',
              linkLabel: 'Ver detalle',
              href: `/product/${template.slug}`,
            },
            media: {
              url: template.gridImage,
              alt: 'Prueba visual',
              title: 'Prueba visual',
              type: CmsMediaType.IMAGE,
              source: 'marketing_cms_seed',
            },
          },
          {
            type: CmsPageBlockType.CARD,
            name: 'Benefit 3',
            content: {
              title: 'Compra más segura',
              description: 'Narrativa de marca + media + CTA en la misma superficie.',
              badge: 'Conversion',
              linkLabel: 'Ir al checkout',
              href: `/product/${template.slug}`,
            },
            media: {
              url: template.secondaryGridImage,
              alt: 'Compra más segura',
              title: 'Compra segura',
              type: CmsMediaType.IMAGE,
              source: 'marketing_cms_seed',
            },
          },
        ],
      },
      {
        type: CmsPageSectionType.VIDEO_SECTION,
        key: `${template.slug}-video`,
        settings: {
          title: 'Video de producto',
          description: 'Un bloque para demostración o prueba de uso.',
          layout: 'contained',
          autoplay: false,
          controls: true,
        },
        blocks: [
          {
            type: CmsPageBlockType.CARD,
            name: 'Primary video',
            content: {
              title: `${template.title} en uso`,
              description: 'El video principal refuerza la intención de compra.',
            },
            media: {
              url: VIDEO_SAMPLE_URL,
              alt: `${template.title} en uso`,
              title: `${template.title} video`,
              type: CmsMediaType.VIDEO,
              source: 'marketing_cms_seed',
            },
          },
          {
            type: CmsPageBlockType.CARD,
            name: 'Secondary visual',
            content: {
              title: 'Detalle secundario',
              description: 'Apoyo editorial para completar la historia visual.',
            },
            media: {
              url: template.videoPoster,
              alt: 'Detalle secundario',
              title: 'Detalle secundario',
              type: CmsMediaType.IMAGE,
              source: 'marketing_cms_seed',
            },
          },
        ],
      },
      {
        type: CmsPageSectionType.MEDIA_GRID_ENHANCED,
        key: `${template.slug}-grid`,
        settings: {
          title: 'Galería visual',
          description: 'Una secuencia de imágenes para sostener el interés y el scroll.',
          columns: 3,
          gap: 1.05,
          aspectRatio: '4 / 5',
        },
        blocks: [
          {
            type: CmsPageBlockType.CARD,
            name: 'Grid item 1',
            content: {
              title: `${template.title} editorial`,
              description: 'Una pieza de marca para elevar percepción.',
              badge: 'Editorial',
              overlayText: true,
              linkLabel: 'Explorar',
              href: '/categories',
            },
            media: {
              url: template.heroImage,
              alt: `${template.title} editorial`,
              title: `${template.title} editorial`,
              type: CmsMediaType.IMAGE,
              source: 'marketing_cms_seed',
            },
          },
          {
            type: CmsPageBlockType.CARD,
            name: 'Grid item 2',
            content: {
              title: `${template.title} detalle`,
              description: 'Más peso visual sobre terminaciones y escala.',
              badge: 'Detail',
              overlayText: true,
              linkLabel: 'Ver más',
              href: `/product/${template.slug}`,
            },
            media: {
              url: template.gridImage,
              alt: `${template.title} detalle`,
              title: `${template.title} detalle`,
              type: CmsMediaType.IMAGE,
              source: 'marketing_cms_seed',
            },
          },
          {
            type: CmsPageBlockType.CARD,
            name: 'Grid item 3',
            content: {
              title: `${template.title} lifestyle`,
              description: 'El contexto de uso reduce la fricción de decisión.',
              badge: 'Use case',
              overlayText: true,
              linkLabel: 'Ir a categoría',
              href: '/categories',
            },
            media: {
              url: template.secondaryGridImage,
              alt: `${template.title} lifestyle`,
              title: `${template.title} lifestyle`,
              type: CmsMediaType.IMAGE,
              source: 'marketing_cms_seed',
            },
          },
        ],
      },
      {
        type: CmsPageSectionType.CTA_BANNER,
        key: `${template.slug}-cta`,
        settings: {
          title: 'Listo para decidir',
          description: 'La última CTA cierra la narrativa con una acción concreta.',
          label: 'Explorar catálogo',
          href: '/categories',
          intent: 'conversion',
        },
      },
    ],
  }
}

const storyCmsPages = [...MARKETING_HOME_STORY_SEEDS]
  .sort((left, right) => left.priority - right.priority)
  .map(buildMarketingStoryCmsPage)

const marketingPages = [
  homePage,
  categoriesPage,
  ...guidePages,
  ...storyCmsPages,
  ...productPageTemplates.map(buildProductPage),
]

async function seedMarketingHomeCmsSections(prisma: PrismaClient) {
  const now = new Date()

  const homeStoriesSection = await prisma.cmsSection.upsert({
    where: { key: 'HOME_STORIES' },
    update: {
      name: 'Home Stories',
      description: 'Stories destacadas del home storefront.',
      sortOrder: 0,
      isActive: true,
    },
    create: {
      key: 'HOME_STORIES',
      name: 'Home Stories',
      description: 'Stories destacadas del home storefront.',
      sortOrder: 0,
      isActive: true,
    },
    select: { id: true },
  })

  const homeHighlightsSection = await prisma.cmsSection.upsert({
    where: { key: 'HOME_HIGHLIGHTS' },
    update: {
      name: 'Atención comercial',
      description: 'Visitas, pagos y garantía destacados del home storefront.',
      sortOrder: 10,
      isActive: true,
    },
    create: {
      key: 'HOME_HIGHLIGHTS',
      name: 'Atención comercial',
      description: 'Visitas, pagos y garantía destacados del home storefront.',
      sortOrder: 10,
      isActive: true,
    },
    select: { id: true },
  })

  const homeStorySeeds = [
    { sectionId: homeStoriesSection.id, entries: MARKETING_HOME_STORY_SEEDS },
    { sectionId: homeHighlightsSection.id, entries: MARKETING_HOME_HIGHLIGHT_SEEDS },
  ]

  for (const { sectionId, entries } of homeStorySeeds) {
    for (const entry of entries) {
      const saved = await prisma.cmsEntry.upsert({
        where: {
          sectionId_locale_slug: {
            sectionId,
            locale: 'es',
            slug: entry.slug,
          },
        },
        update: {
          title: entry.title,
          subtitle: entry.subtitle,
          description: entry.description,
          status: CmsEntryStatus.PUBLISHED,
          priority: entry.priority,
          isActive: true,
          publishedAt: now,
          thumbnailUrl: entry.thumbnailUrl,
          ctaLabel: entry.ctaLabel,
          ctaUrl: entry.ctaUrl,
        },
        create: {
          sectionId,
          slug: entry.slug,
          locale: 'es',
          title: entry.title,
          subtitle: entry.subtitle,
          description: entry.description,
          status: CmsEntryStatus.PUBLISHED,
          priority: entry.priority,
          isActive: true,
          publishedAt: now,
          thumbnailUrl: entry.thumbnailUrl,
          ctaLabel: entry.ctaLabel,
          ctaUrl: entry.ctaUrl,
        },
        select: { id: true },
      })

      await replaceCmsEntryAssets(prisma, saved.id, entry.assets)
    }
  }
}

async function buildHomeShopProductsSection(prisma: PrismaClient): Promise<CmsSectionSeed> {
  const products = await prisma.product.findMany({
    where: {
      productCode: { in: HOME_SHOP_PRODUCT_CODES },
    },
    select: {
      id: true,
      name: true,
      productCode: true,
      salePrice: true,
      currency: true,
      img: true,
    },
  })

  const productByCode = new Map(products.map((product) => [product.productCode, product]))

  return {
    type: CmsPageSectionType.MEDIA_GRID_ENHANCED,
    key: 'home-shop-products',
    settings: {
      title: 'Productos destacados de la tienda',
      description: 'Una selección comercial para comparar opciones y encontrar la solución adecuada.',
      variant: 'products',
    },
    blocks: HOME_SHOP_PRODUCT_CODES.map((code) => {
      const product = productByCode.get(code)
      if (!product) {
        return null
      }

      const salePrice = product.salePrice != null ? String(product.salePrice) : ''
      const imageUrl = product.img && String(product.img).trim().length > 0 ? String(product.img) : null
      const card: CmsBlockSeed = {
        type: CmsPageBlockType.CARD,
        name: product.name,
        content: {
          title: product.name,
          description: HOME_SHOP_PRODUCT_DESCRIPTIONS[code] ?? '',
          badge: salePrice ? `Desde $${salePrice}` : 'Producto de tienda',
          linkLabel: 'Ver producto',
          href: `/product/${product.productCode}`,
          slug: product.productCode,
          productId: product.id,
          price: Number(salePrice || 0),
          currencyCode: product.currency ?? 'UYU',
          imgUrl: imageUrl,
          images: imageUrl ? [imageUrl] : [],
          rating: 4,
        },
      }

      if (imageUrl) {
        card.media = {
          url: imageUrl,
          alt: product.name,
          title: product.name,
          type: CmsMediaType.IMAGE,
          source: 'marketing_cms_seed',
        }
      }

      return card
    }).filter((block): block is CmsBlockSeed => Boolean(block)),
  }
}

async function buildMarketingPages(prisma: PrismaClient): Promise<CmsPageSeed[]> {
  const homeShopProductsSection = await buildHomeShopProductsSection(prisma)

  return marketingPages.map((page) => {
    if (page.path !== '') {
      return page
    }

    return {
      ...page,
      sections: [page.sections[0], page.sections[1], homeShopProductsSection, ...page.sections.slice(2)],
    }
  })
}

async function ensureMedia(prisma: PrismaClient, asset: MediaSeed) {
  const existing = await prisma.cmsMedia.findFirst({
    where: { url: asset.url },
    select: { id: true },
  })

  const data = {
    url: asset.url,
    type: asset.type ?? CmsMediaType.IMAGE,
    alt: asset.alt ?? null,
    title: asset.title ?? null,
    source: asset.source ?? 'marketing_cms_seed',
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

async function upsertPage(prisma: PrismaClient, page: CmsPageSeed) {
  const existing = await prisma.cmsPage.findFirst({
    where: { path: normalizePath(page.path) },
    select: { id: true },
  })

  const pageData = {
    path: normalizePath(page.path),
    title: page.title,
    summary: page.summary ?? null,
    scope: CmsPageScope.GENERAL_SITE,
    locale: 'es',
    status: CmsEntryStatus.PUBLISHED,
    visible: true,
    seoTitle: page.seoTitle ?? null,
    seoDescription: page.seoDescription ?? null,
    seoImageUrl: page.seoImageUrl ?? null,
    layoutKey: 'landing-default',
    legacySource: 'marketing_cms_seed',
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

  await prisma.cmsPageAlias.deleteMany({ where: { pageId: pageRecord.id } })
  if (page.aliases?.length) {
    await prisma.cmsPageAlias.createMany({
      data: page.aliases
        .map((alias) => normalizePath(alias))
        .filter((alias) => alias && alias !== normalizePath(page.path))
        .map((alias) => ({ pageId: pageRecord.id, path: alias })),
      skipDuplicates: true,
    })
  }

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
      const mediaId = block.media ? await ensureMedia(prisma, block.media) : null
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

export async function seedMarketingCmsPages(prisma: PrismaClient) {
  for (const media of marketingMedia) {
    await ensureMedia(prisma, {
      ...media,
      source: media.source ?? 'marketing_cms_seed',
    })
  }

  await seedMarketingHomeCmsSections(prisma)
  const pagesToSeed = await buildMarketingPages(prisma)

  for (const page of pagesToSeed) {
    await upsertPage(prisma, page)
  }

  console.log(`[seed] Marketing CMS pages seeded: ${pagesToSeed.length} pages`)
}

async function main() {
  const prisma = new PrismaClient()
  try {
    await seedMarketingCmsPages(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[seed] Marketing CMS pages failed', error)
    process.exitCode = 1
  })
}
