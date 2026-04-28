import {
  CmsEntryStatus,
  CmsPageBlockType,
  CmsPageScope,
  CmsPageSectionType,
  PrismaClient,
} from '@prisma/client'
import { htmlFragmentToCmsRichTextNodes } from '../src/cms/rich-text'

type NavigationItem = {
  id?: string
  label: string
  href: string
  external?: boolean
  items?: NavigationItem[]
}

type PageSectionSeed = {
  type: CmsPageSectionType
  key: string
  name?: string | null
  sortOrder: number
  visible?: boolean
  settings?: Record<string, unknown> | null
  blocks?: Array<{
    type: CmsPageBlockType
    key?: string | null
    name?: string | null
    sortOrder?: number
    visible?: boolean
    content?: Record<string, unknown> | null
  }>
}

type PageSeed = {
  path: string
  aliases?: string[]
  title: string
  summary: string
  seoTitle: string
  seoDescription: string
  seoImageUrl: string
  legacySource: string
  sections: PageSectionSeed[]
}

type BudgetLandingPageSeed = PageSeed & {
  budgetProductSlug: string
}

const PUBLIC_NAVIGATION_PRIMARY: NavigationItem[] = [
  { id: 'nav-home', label: 'Inicio', href: '/' },
  { id: 'nav-shop', label: 'Tienda', href: '/shop' },
  { id: 'nav-categories', label: 'Categorías', href: '/categories' },
  { id: 'nav-about', label: 'Quiénes somos', href: '/quienes-somos' },
  { id: 'nav-faq', label: 'Preguntas frecuentes', href: '/preguntas-frecuentes' },
  { id: 'nav-contact', label: 'Contacto', href: '/contacto.html' },
]

const PUBLIC_NAVIGATION_HELP_LINKS: NavigationItem[] = [
  { id: 'help-faq', label: 'Preguntas frecuentes', href: '/preguntas-frecuentes' },
  { id: 'help-contact', label: 'Contacto', href: '/contacto.html' },
]

const ABOUT_HERO_IMAGE = '/uploads/cms/legacy-assets/img/intro-carousel/roller-6.jpeg'
const FAQ_HERO_IMAGE = '/uploads/cms/legacy-assets/img/contacto/contacto.jpeg'

const PUBLIC_FAQ_BLOCKS = [
  {
    question: '¿Dónde trabaja urucortinas?',
    answerRichText: htmlFragmentToCmsRichTextNodes(
      '<p>Atendemos Montevideo y realizamos trabajos en todo Uruguay. En Montevideo las visitas de relevamiento pueden coordinarse sin costo.</p>',
    ),
  },
  {
    question: '¿Cómo solicito un presupuesto?',
    answerRichText: htmlFragmentToCmsRichTextNodes(
      '<p>Puedes escribirnos por WhatsApp, completar el formulario de contacto o revisar la tienda para comparar soluciones antes de pedir asesoramiento.</p>',
    ),
  },
  {
    question: '¿Instalan y dan mantenimiento?',
    answerRichText: htmlFragmentToCmsRichTextNodes(
      '<p>Sí. Hacemos instalación, mantenimiento y reparación de cortinas roller, bandas verticales, venecianas, persianas, toldos, cortinas metálicas y aberturas de aluminio.</p>',
    ),
  },
  {
    question: '¿Trabajan con soluciones manuales y motorizadas?',
    answerRichText: htmlFragmentToCmsRichTextNodes(
      '<p>Sí. Disponemos de opciones manuales y motorizadas según el uso, el presupuesto y el nivel de automatización que necesite cada proyecto.</p>',
    ),
  },
  {
    question: '¿Pueden asesorar para hogares, comercios y obras?',
    answerRichText: htmlFragmentToCmsRichTextNodes(
      '<p>Sí. Brindamos asesoramiento para viviendas, locales comerciales, oficinas y obras nuevas, siempre con soluciones a medida.</p>',
    ),
  },
  {
    question: '¿Tienen opciones de financiación?',
    answerRichText: htmlFragmentToCmsRichTextNodes(
      '<p>Sí. Las compras pueden canalizarse con Mercado Pago y planes de cuotas sujetos a las condiciones disponibles al momento de la compra.</p>',
    ),
  },
  {
    question: '¿Qué productos se trabajan con mayor frecuencia?',
    answerRichText: htmlFragmentToCmsRichTextNodes(
      '<p>Las líneas más solicitadas incluyen cortinas roller blackout y screen, bandas verticales, venecianas, persianas de PVC y aluminio, toldos, cerramientos, cortinas metálicas y aberturas de aluminio.</p>',
    ),
  },
  {
    question: '¿Tienen atención personalizada?',
    answerRichText: htmlFragmentToCmsRichTextNodes(
      '<p>Sí. Cada proyecto se evalúa según medidas, orientación, nivel de luz, privacidad y terminación buscada para proponer la solución más conveniente.</p>',
    ),
  },
] as const

const mergeNavigationItems = (existing: NavigationItem[], desired: NavigationItem[]) => {
  const seen = new Set(
    existing.map((item) => `${item.label.trim().toLowerCase()}::${item.href.trim().toLowerCase()}`),
  )
  const output = existing.map((item) => ({
    ...item,
    items: item.items ? mergeNavigationItems([], item.items) : undefined,
  }))

  for (const item of desired) {
    const key = `${item.label.trim().toLowerCase()}::${item.href.trim().toLowerCase()}`
    if (seen.has(key)) continue
    output.push({
      ...item,
      items: item.items ? mergeNavigationItems([], item.items) : undefined,
    })
    seen.add(key)
  }

  return output
}

const parseConfig = (value: string | null | undefined): Record<string, unknown> => {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const buildFaqSection = (title: string, description: string, sortOrder: number, key: string) => ({
  type: CmsPageSectionType.FAQ,
  key,
  name: title,
  sortOrder,
  visible: true,
  settings: { title, description },
  blocks: PUBLIC_FAQ_BLOCKS.map((faq, index) => ({
    type: CmsPageBlockType.FAQ_ITEM,
    key: `${key}-faq-${index + 1}`,
    name: faq.question,
    sortOrder: index,
    visible: true,
    content: {
      question: faq.question,
      answerRichText: faq.answerRichText,
    },
  })),
})

const paragraphRichText = (value: string) => [
  {
    type: 'element',
    tag: 'p',
    children: [{ type: 'text', value }],
  },
]

const syncSeedSection = async (
  prisma: PrismaClient,
  pageId: number,
  existingSection: {
    id: number
    key: string | null
    type: CmsPageSectionType
    name: string | null
    sortOrder: number
    visible: boolean
    settings: unknown
    blocks: Array<{
      id: number
      key: string | null
      type: CmsPageBlockType
      name: string | null
      sortOrder: number
      visible: boolean
      content: unknown
    }>
  } | null,
  seedSection: PageSectionSeed,
) => {
  if (!existingSection) {
    await prisma.cmsPageSection.create({
      data: {
        pageId,
        type: seedSection.type,
        key: seedSection.key,
        name: seedSection.name,
        sortOrder: seedSection.sortOrder,
        visible: seedSection.visible ?? true,
        settings: seedSection.settings as any,
        blocks: seedSection.blocks
          ? {
              create: seedSection.blocks.map((block) => ({
                type: block.type,
                key: block.key ?? null,
                name: block.name ?? null,
                sortOrder: block.sortOrder ?? 0,
                visible: block.visible ?? true,
                content: block.content as any,
              })) as any,
            }
          : undefined,
      },
    })
    return
  }

  await prisma.cmsPageSection.update({
    where: { id: existingSection.id },
    data: {
      type: seedSection.type,
      key: seedSection.key,
      name: seedSection.name,
      sortOrder: seedSection.sortOrder,
      visible: seedSection.visible ?? true,
      settings: seedSection.settings as any,
    },
  })

  const existingBlocksByKey = new Map(
    existingSection.blocks.map((block) => [block.key ?? `__id:${block.id}`, block]),
  )

  for (const [index, seedBlock] of (seedSection.blocks ?? []).entries()) {
    const blockKey = seedBlock.key ?? `__index:${index}`
    const existingBlock = existingBlocksByKey.get(blockKey)
    const nextData = {
      type: seedBlock.type,
      key: seedBlock.key ?? null,
      name: seedBlock.name ?? null,
      sortOrder: seedBlock.sortOrder ?? index,
      visible: seedBlock.visible ?? true,
      content: seedBlock.content as any,
    }

    if (existingBlock) {
      await prisma.cmsPageBlock.update({
        where: { id: existingBlock.id },
        data: nextData,
      })
    } else {
      await prisma.cmsPageBlock.create({
        data: {
          sectionId: existingSection.id,
          ...nextData,
        },
      })
    }
  }
}

const aboutPage: PageSeed = {
  path: 'quienes-somos',
  aliases: ['quienes-somos.html'],
  title: 'Quiénes somos',
  summary:
    'Conocé a urucortinas, su propuesta de valor y el alcance de sus soluciones a medida en Uruguay.',
  seoTitle: 'Quiénes somos | urucortinas',
  seoDescription:
    'urucortinas diseña, fabrica e instala cortinas, persianas, toldos, cerramientos y aberturas a medida con atención personalizada en todo Uruguay.',
  seoImageUrl: ABOUT_HERO_IMAGE,
  legacySource: 'knowledge:public-curated',
  sections: [
    {
      type: CmsPageSectionType.HERO,
      key: 'hero',
      name: 'Quiénes somos',
      sortOrder: 0,
      visible: true,
      settings: {
        eyebrow: 'Conocé urucortinas',
        title: 'Quiénes somos',
        description:
          'Diseñamos, fabricamos e instalamos soluciones a medida para hogares, comercios y obras en todo Uruguay.',
        primaryCtaLabel: 'Ver tienda',
        primaryCtaHref: '/shop',
        secondaryCtaLabel: 'Pedir presupuesto',
        secondaryCtaHref: '/contacto.html',
        slides: [
          {
            title: 'Diseño e instalación a medida',
            description:
              'Acompañamos cada proyecto con asesoramiento técnico, relevamiento y seguimiento de punta a punta.',
            imageUrl: ABOUT_HERO_IMAGE,
            imageAlt: 'Soluciones a medida de urucortinas',
            href: '/shop',
            linkLabel: 'Ver tienda',
          },
        ],
      },
    },
    {
      type: CmsPageSectionType.CONTENT_SPLIT,
      key: 'who-we-are',
      name: 'Nuestro enfoque',
      sortOrder: 1,
      visible: true,
      settings: {
        mediaPosition: 'start',
        imageUrl: ABOUT_HERO_IMAGE,
        imageAlt: 'Equipo y soluciones de urucortinas',
        gallery: [
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg',
            imageAlt: 'Cortinas roller a medida',
            href: '/productos/cortinas-roller.html',
            linkLabel: 'Ver producto',
          },
        ],
      },
      blocks: [
        {
          type: CmsPageBlockType.RICH_TEXT,
          key: 'who-we-are-copy',
          name: 'Descripción general',
          sortOrder: 0,
          visible: true,
          content: {
            richText: htmlFragmentToCmsRichTextNodes(
              '<p><strong>urucortinas</strong> trabaja con foco en soluciones reales para el uso diario.</p><p>La propuesta combina asesoramiento, medición, fabricación e instalación para que cada espacio gane confort, control de luz, privacidad y estética.</p><ul><li>Cortinas roller blackout y screen</li><li>Bandas verticales, venecianas y persianas</li><li>Toldos, cerramientos y aberturas de aluminio</li><li>Instalación, mantenimiento y reparación</li></ul>',
            ),
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.FEATURE_GRID,
      key: 'capabilities',
      name: 'Capacidades',
      sortOrder: 2,
      visible: true,
      settings: {
        title: 'Qué hacemos',
        description:
          'Soluciones pensadas para vender mejor, instalar rápido y resolver proyectos con acompañamiento profesional.',
        variant: 'services',
      },
      blocks: [
        {
          type: CmsPageBlockType.CARD,
          key: 'capability-1',
          name: 'Asesoramiento',
          sortOrder: 0,
          visible: true,
          content: {
            title: 'Asesoramiento técnico',
            richText: paragraphRichText(
              'Te ayudamos a elegir la opción correcta según orientación, luz, privacidad, uso y presupuesto.',
            ),
            href: '/preguntas-frecuentes',
            linkLabel: 'Ver FAQ',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          key: 'capability-2',
          name: 'Fabricación',
          sortOrder: 1,
          visible: true,
          content: {
            title: 'Fabricación a medida',
            richText: paragraphRichText(
              'Adaptamos cada solución a la medida del ambiente para lograr terminaciones prolijas y funcionales.',
            ),
            href: '/shop',
            linkLabel: 'Ver tienda',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          key: 'capability-3',
          name: 'Instalación',
          sortOrder: 2,
          visible: true,
          content: {
            title: 'Instalación y mantenimiento',
            richText: paragraphRichText(
              'Acompañamos el proyecto con colocación, mantenimiento y reparación cuando el producto ya está en uso.',
            ),
            href: '/contacto.html',
            linkLabel: 'Coordinar visita',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          key: 'capability-4',
          name: 'Automatización',
          sortOrder: 3,
          visible: true,
          content: {
            title: 'Opciones motorizadas',
            richText: paragraphRichText(
              'Integramos soluciones motorizadas cuando el proyecto necesita más confort, control o practicidad.',
            ),
            href: '/productos/motores-cortinas-y-persianas.html',
            linkLabel: 'Ver motores',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.CTA_BANNER,
      key: 'about-cta',
      name: 'Contacto comercial',
      sortOrder: 3,
      visible: true,
      settings: {
        title: 'Pedí asesoramiento para tu proyecto',
        description:
          'Te ayudamos a elegir la solución más conveniente para tu espacio y te derivamos a la tienda o al contacto comercial según necesites.',
        actions: [
          { label: 'Ir a la tienda', href: '/shop' },
          { label: 'Solicitar presupuesto', href: '/contacto.html' },
        ],
        variant: 'default',
      },
    },
  ],
}

const faqPage: PageSeed = {
  path: 'preguntas-frecuentes',
  aliases: ['faq.html', 'preguntas-frecuentes.html'],
  title: 'Preguntas frecuentes',
  summary:
    'Respuestas reales sobre cobertura, presupuestos, instalación, financiación y tipos de producto.',
  seoTitle: 'Preguntas frecuentes | urucortinas',
  seoDescription:
    'Respuestas útiles sobre presupuestos, instalación, financiación, cobertura y productos de urucortinas.',
  seoImageUrl: FAQ_HERO_IMAGE,
  legacySource: 'knowledge:public-curated',
  sections: [
    {
      type: CmsPageSectionType.HERO,
      key: 'hero',
      name: 'Preguntas frecuentes',
      sortOrder: 0,
      visible: true,
      settings: {
        eyebrow: 'Ayuda comercial',
        title: 'Preguntas frecuentes',
        description:
          'Reunimos las respuestas más comunes para ayudarte a avanzar más rápido hacia la compra o el presupuesto.',
        primaryCtaLabel: 'Ver tienda',
        primaryCtaHref: '/shop',
        secondaryCtaLabel: 'Pedir presupuesto',
        secondaryCtaHref: '/contacto.html',
        slides: [
          {
            title: 'Preguntas que destraban la compra',
            description:
              'Si estás comparando opciones, esta sección te ayuda a entender cobertura, tiempos y formas de trabajo.',
            imageUrl: FAQ_HERO_IMAGE,
            imageAlt: 'Preguntas frecuentes de urucortinas',
            href: '/shop',
            linkLabel: 'Ver tienda',
          },
        ],
      },
    },
    buildFaqSection(
      'Respuestas clave',
      'Si no encontrás tu consulta, escribinos y te respondemos con una propuesta ajustada a tu caso.',
      1,
      'faq-public',
    ),
    {
      type: CmsPageSectionType.CTA_BANNER,
      key: 'faq-cta',
      name: 'Cierre comercial',
      sortOrder: 2,
      visible: true,
      settings: {
        title: '¿Querés una recomendación concreta?',
        description:
          'Escribinos y te ayudamos a definir la solución según medidas, uso, luz, privacidad y presupuesto.',
        actions: [
          { label: 'Pedir presupuesto', href: '/contacto.html' },
          { label: 'Ir a la tienda', href: '/shop' },
        ],
        variant: 'default',
      },
    },
  ],
}

const buildBudgetCalculatorSection = (
  title: string,
  description: string,
  productSlug: string,
  sortOrder: number,
): PageSectionSeed => ({
  type: CmsPageSectionType.BUDGET_CALCULATOR,
  key: 'budget-calculator',
  name: 'Calculadora de presupuesto',
  sortOrder,
  visible: true,
  settings: {
    title,
    description,
    productSlug,
    compact: true,
    showCustomerFields: true,
    submitLabel: 'Validar y agregar',
    initialWidth: 1,
    initialHeight: 1,
  },
  blocks: [],
})

const budgetLandingPages: BudgetLandingPageSeed[] = [
  {
    path: 'productos/cortinas-roller.html',
    aliases: ['cortinas-roller.html'],
    title: 'Cortinas Roller',
    summary: 'Calculá tu presupuesto de cortinas roller en línea con selección validada por backend.',
    seoTitle: 'Cortinas Roller | urucortinas',
    seoDescription: 'Presupuesto online de cortinas roller con cálculo por backend.',
    seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg',
    legacySource: 'knowledge:public-curated',
    budgetProductSlug: 'cortinas-roller',
    sections: [
      {
        type: CmsPageSectionType.HERO,
        key: 'hero',
        name: 'Cortinas Roller',
        sortOrder: 0,
        visible: true,
        settings: {
          eyebrow: 'Presupuesto online',
          title: 'Cortinas roller a medida',
          description:
            'Seleccioná el producto, cargá ancho y alto, y obtené un presupuesto validado en backend.',
          primaryCtaLabel: 'Ver tienda',
          primaryCtaHref: '/shop',
          secondaryCtaLabel: 'Contactar',
          secondaryCtaHref: '/contacto.html',
          slides: [
            {
              title: 'Cortinas roller',
              description: 'Blackout, screen y soluciones a medida.',
              imageUrl: '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg',
              imageAlt: 'Cortinas roller a medida',
              href: '/shop',
              linkLabel: 'Ver tienda',
            },
          ],
        },
        blocks: [],
      },
      {
        type: CmsPageSectionType.RICH_TEXT,
        key: 'intro',
        name: 'Introducción',
        sortOrder: 1,
        visible: true,
        settings: {
          title: 'Configurá tu presupuesto',
          description:
            'Este flujo preselecciona el producto actual y conserva un selector de presupuesto para productos equivalentes del mismo catálogo.',
        },
        blocks: [
          {
            type: CmsPageBlockType.RICH_TEXT,
            key: 'intro-copy',
          name: 'Copy',
          sortOrder: 0,
          visible: true,
          content: {
            richText: htmlFragmentToCmsRichTextNodes(
              '<p>Usá esta página para presupuestar cortinas roller con un recorrido simple: elegís el producto, ingresás ancho y alto, y confirmás la selección.</p><p>El cálculo y la validación se resuelven en backend para evitar diferencias entre el storefront y el panel administrativo.</p>',
            ),
          },
        },
      ],
      },
      buildBudgetCalculatorSection(
        'Presupuestá tus cortinas roller',
        'La página se abre con el producto correcto instanciado, pero el selector sigue mostrando todo el universo de productos válidos para presupuesto.',
        'cortinas-roller',
        2,
      ),
      {
        type: CmsPageSectionType.CTA_BANNER,
        key: 'cta',
        name: 'Contacto comercial',
        sortOrder: 3,
        visible: true,
        settings: {
          title: '¿Querés que revisemos tu caso?',
          description: 'Si preferís, podemos acompañarte con asesoramiento antes de confirmar el carrito.',
          actions: [
            { label: 'Contactar', href: '/contacto.html' },
            { label: 'Ver tienda', href: '/shop' },
          ],
          variant: 'default',
        },
      },
    ],
  },
  {
    path: 'productos/bandas-verticales.html',
    aliases: ['bandas-verticales.html'],
    title: 'Bandas Verticales',
    summary: 'Calculá online tus bandas verticales con el mismo flujo de presupuesto validado.',
    seoTitle: 'Bandas Verticales | urucortinas',
    seoDescription: 'Presupuesto online de bandas verticales con cálculo por backend.',
    seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/verticals/bandas_verticales_1.jpeg',
    legacySource: 'knowledge:public-curated',
    budgetProductSlug: 'bandas-verticales',
    sections: [
      {
        type: CmsPageSectionType.HERO,
        key: 'hero',
        name: 'Bandas Verticales',
        sortOrder: 0,
        visible: true,
        settings: {
          eyebrow: 'Presupuesto online',
          title: 'Bandas verticales a medida',
          description: 'Instanciá el presupuesto con el producto correcto y cerrá la compra cuando quieras.',
          primaryCtaLabel: 'Ver tienda',
          primaryCtaHref: '/shop',
          secondaryCtaLabel: 'Contactar',
          secondaryCtaHref: '/contacto.html',
          slides: [
            {
              title: 'Bandas verticales',
              description: 'Control de luz y privacidad en ambientes amplios.',
              imageUrl: '/uploads/cms/legacy-assets/img/portfolio/verticals/bandas_verticales_1.jpeg',
              imageAlt: 'Bandas verticales a medida',
              href: '/shop',
              linkLabel: 'Ver tienda',
            },
          ],
        },
        blocks: [],
      },
      buildBudgetCalculatorSection(
        'Presupuestá bandas verticales',
        'Partimos del producto actual, pero el listado de presupuesto sigue gobernado por backend.',
        'bandas-verticales',
        1,
      ),
    ],
  },
  {
    path: 'productos/cortinas-de-enrollar-aluminio.html',
    aliases: ['cortinas-de-enrollar-aluminio.html'],
    title: 'Cortinas de enrollar en aluminio',
    summary: 'Presupuesto online para cortinas de enrollar en aluminio.',
    seoTitle: 'Cortinas de enrollar en aluminio | urucortinas',
    seoDescription: 'Presupuesto online de cortinas de enrollar en aluminio con validación backend.',
    seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/shutters/aluminio/cortina_enrollar_aluminio_1.jpeg',
    legacySource: 'knowledge:public-curated',
    budgetProductSlug: 'cortinas-de-enrollar-aluminio',
    sections: [
      {
        type: CmsPageSectionType.HERO,
        key: 'hero',
        name: 'Cortinas de enrollar en aluminio',
        sortOrder: 0,
        visible: true,
        settings: {
          eyebrow: 'Presupuesto online',
          title: 'Cortinas de enrollar en aluminio',
          description: 'Conservamos el selector y preinstanciamos el producto adecuado para esta página.',
          primaryCtaLabel: 'Ver tienda',
          primaryCtaHref: '/shop',
          secondaryCtaLabel: 'Contactar',
          secondaryCtaHref: '/contacto.html',
          slides: [
            {
              title: 'Cortinas de enrollar en aluminio',
              description: 'Aislamiento, resistencia y motorización opcional.',
              imageUrl: '/uploads/cms/legacy-assets/img/portfolio/shutters/aluminio/cortina_enrollar_aluminio_1.jpeg',
              imageAlt: 'Cortinas de enrollar en aluminio',
              href: '/shop',
              linkLabel: 'Ver tienda',
            },
          ],
        },
        blocks: [],
      },
      buildBudgetCalculatorSection(
        'Presupuestá cortinas de enrollar en aluminio',
        'La configuración de página fija el producto inicial, mientras el backend mantiene la selección válida.',
        'cortinas-de-enrollar-aluminio',
        1,
      ),
    ],
  },
  {
    path: 'productos/cortinas-de-enrollar-pvc.html',
    aliases: ['cortinas-de-enrollar-pvc.html'],
    title: 'Cortinas de enrollar en PVC',
    summary: 'Presupuesto online para cortinas de enrollar en PVC.',
    seoTitle: 'Cortinas de enrollar en PVC | urucortinas',
    seoDescription: 'Presupuesto online de cortinas de enrollar en PVC con cálculo backend.',
    seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/shutters/pvc/cortina_enrollar_pvc_1.jpeg',
    legacySource: 'knowledge:public-curated',
    budgetProductSlug: 'cortinas-de-enrollar-pvc',
    sections: [
      {
        type: CmsPageSectionType.HERO,
        key: 'hero',
        name: 'Cortinas de enrollar en PVC',
        sortOrder: 0,
        visible: true,
        settings: {
          eyebrow: 'Presupuesto online',
          title: 'Cortinas de enrollar en PVC',
          description: 'Producto instanciado para la página, con cálculo validado en backend.',
          primaryCtaLabel: 'Ver tienda',
          primaryCtaHref: '/shop',
          secondaryCtaLabel: 'Contactar',
          secondaryCtaHref: '/contacto.html',
          slides: [
            {
              title: 'Cortinas de enrollar en PVC',
              description: 'Privacidad y aislamiento con una solución de bajo mantenimiento.',
              imageUrl: '/uploads/cms/legacy-assets/img/portfolio/shutters/pvc/cortina_enrollar_pvc_1.jpeg',
              imageAlt: 'Cortinas de enrollar en PVC',
              href: '/shop',
              linkLabel: 'Ver tienda',
            },
          ],
        },
        blocks: [],
      },
      buildBudgetCalculatorSection(
        'Presupuestá cortinas de enrollar en PVC',
        'La página arranca con el producto indicado, pero el catálogo presupuestable sigue siendo el mismo.',
        'cortinas-de-enrollar-pvc',
        1,
      ),
    ],
  },
  {
    path: 'productos/venecianas.html',
    aliases: ['venecianas.html'],
    title: 'Venecianas',
    summary: 'Presupuesto online para venecianas a medida.',
    seoTitle: 'Venecianas | urucortinas',
    seoDescription: 'Presupuesto online de venecianas con cálculo validado por backend.',
    seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/venecianas/venecianas_1.jpeg',
    legacySource: 'knowledge:public-curated',
    budgetProductSlug: 'venecianas',
    sections: [
      {
        type: CmsPageSectionType.HERO,
        key: 'hero',
        name: 'Venecianas',
        sortOrder: 0,
        visible: true,
        settings: {
          eyebrow: 'Presupuesto online',
          title: 'Venecianas a medida',
          description: 'Preselección correcta y selector de presupuesto alineado al backend.',
          primaryCtaLabel: 'Ver tienda',
          primaryCtaHref: '/shop',
          secondaryCtaLabel: 'Contactar',
          secondaryCtaHref: '/contacto.html',
          slides: [
            {
              title: 'Venecianas a medida',
              description: 'Control fino de luz y privacidad con terminación prolija.',
              imageUrl: '/uploads/cms/legacy-assets/img/portfolio/venecianas/venecianas_1.jpeg',
              imageAlt: 'Venecianas a medida',
              href: '/shop',
              linkLabel: 'Ver tienda',
            },
          ],
        },
        blocks: [],
      },
      buildBudgetCalculatorSection(
        'Presupuestá venecianas',
        'El selector se inicializa en esta línea y sigue gobernado por el mismo pool de productos válidos.',
        'venecianas',
        1,
      ),
    ],
  },
]

const PUBLIC_PAGES: PageSeed[] = [aboutPage, faqPage, ...budgetLandingPages]

async function ensureStorefrontConfig(prisma: PrismaClient) {
  const configRow = await prisma.systemConfig.findUnique({ where: { key: 'storefront:config' } })
  const existingConfig = parseConfig(configRow?.value)
  const existingNavigation = (existingConfig.navigation as Record<string, unknown> | undefined) ?? {}

  const nextNavigation = {
    ...existingNavigation,
    primary: mergeNavigationItems(
      (existingNavigation.primary as NavigationItem[] | undefined) ?? [],
      PUBLIC_NAVIGATION_PRIMARY,
    ),
    helpLinks: mergeNavigationItems(
      (existingNavigation.helpLinks as NavigationItem[] | undefined) ?? [],
      PUBLIC_NAVIGATION_HELP_LINKS,
    ),
  }

  const nextConfig = {
    ...existingConfig,
    navigation: nextNavigation,
  }

  if (!configRow) {
    await prisma.systemConfig.create({
      data: {
        key: 'storefront:config',
        value: JSON.stringify(nextConfig),
      },
    })
    return
  }

  if (configRow.value !== JSON.stringify(nextConfig)) {
    await prisma.systemConfig.update({
      where: { key: 'storefront:config' },
      data: { value: JSON.stringify(nextConfig) },
    })
  }
}

async function ensurePage(prisma: PrismaClient, page: PageSeed) {
  const existing = await prisma.cmsPage.findUnique({
    where: { path: page.path },
    include: {
      sections: {
        include: { blocks: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
    },
  })

  if (existing) {
    await prisma.cmsPage.update({
      where: { id: existing.id },
      data: {
        title: page.title,
        summary: page.summary,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        seoImageUrl: page.seoImageUrl,
        legacySource: page.legacySource,
      },
    })

    const existingSectionByKey = new Map(existing.sections.map((section) => [section.key ?? '', section]))
    for (const seedSection of page.sections) {
      await syncSeedSection(
        prisma,
        existing.id,
        existingSectionByKey.get(seedSection.key) ?? null,
        seedSection,
      )
    }

    return existing.id
  }

  const created = await prisma.cmsPage.create({
    data: {
      path: page.path,
      title: page.title,
      summary: page.summary,
      scope: CmsPageScope.STOREFRONT,
      locale: 'es',
      status: CmsEntryStatus.PUBLISHED,
      visible: true,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      seoImageUrl: page.seoImageUrl,
      layoutKey: null,
      legacySource: page.legacySource,
      aliases: {
        create: (page.aliases ?? []).map((alias) => ({ path: alias })),
      },
      sections: {
        create: page.sections.map((section) => ({
          type: section.type,
          key: section.key,
          name: section.name,
          sortOrder: section.sortOrder,
          visible: section.visible ?? true,
          settings: section.settings as any,
          blocks: section.blocks
            ? {
                create: section.blocks.map((block) => ({
                  type: block.type,
                  key: block.key ?? null,
                  name: block.name ?? null,
                  sortOrder: block.sortOrder ?? 0,
                  visible: block.visible ?? true,
                  content: block.content as any,
                })) as any,
              }
            : undefined,
        })) as any,
      },
    },
    select: { id: true },
  })

  return created.id
}

async function ensureHomePageEnhancements(prisma: PrismaClient) {
  const page = await prisma.cmsPage.findUnique({
    where: { path: '' },
    include: {
      sections: {
        include: { blocks: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
    },
  })

  if (!page) {
    return
  }

  if (
    page.title !== 'urucortinas' ||
    page.seoTitle !== 'urucortinas | Cortinas y Aberturas' ||
    page.seoDescription !==
      'Soluciones en cortinas roller, toldos, persianas y aberturas en aluminio con fabricación a medida en Uruguay.'
  ) {
    await prisma.cmsPage.update({
      where: { id: page.id },
      data: {
        title: 'urucortinas',
        summary:
          'Soluciones en cortinas roller, toldos, persianas y aberturas en aluminio con fabricación a medida en Uruguay.',
        seoTitle: 'urucortinas | Cortinas y Aberturas',
        seoDescription:
          'Soluciones en cortinas roller, toldos, persianas y aberturas en aluminio con fabricación a medida en Uruguay.',
      },
    })
  }

  const sections = page.sections
  const portfolioGrid = sections.find((section) => section.key === 'portfolio-grid')
  if (portfolioGrid) {
    const descriptiveLabels: Record<string, string> = {
      'feature-1': 'Ver Cortinas Roller',
      'feature-2': 'Ver Persianas y Cortinas de Enrollar',
      'feature-3': 'Ver Cortinas Metálicas',
      'feature-4': 'Ver Bandas Verticales',
      'feature-5': 'Ver Cortinas Tradicionales',
      'feature-6': 'Ver Cortinas Venecianas',
      'feature-7': 'Ver Motores para Cortinas',
      'feature-8': 'Ver Aberturas en Aluminio',
      'feature-9': 'Ver Toldos y Cerramientos',
    }

    await Promise.all(
      portfolioGrid.blocks.map((block) => {
        if (!block.key) return null
        const nextLinkLabel = descriptiveLabels[block.key]
        if (!nextLinkLabel) return null
        const content = (block.content as Record<string, unknown> | null) ?? {}
        if (content.linkLabel === nextLinkLabel) return null
        return prisma.cmsPageBlock.update({
          where: { id: block.id },
          data: {
            content: {
              ...content,
              linkLabel: nextLinkLabel,
            } as any,
          },
        })
      }),
    )
  }

  const heroSection = sections.find((section) => section.key === 'hero')
  if (heroSection) {
    await prisma.cmsPageSection.update({
      where: { id: heroSection.id },
      data: {
          settings: {
          ...((heroSection.settings as Record<string, unknown> | null) ?? {}),
          eyebrow: 'Soluciones a medida en Uruguay',
          title: 'Cortinas, persianas y aberturas a medida en Uruguay',
          description:
            'Asesoramiento, medición, fabricación e instalación para hogares, comercios y obras con foco en resultados reales.',
          primaryCtaLabel: 'Solicitar presupuesto',
          primaryCtaHref: '/presupuesto',
          secondaryCtaLabel: '',
          secondaryCtaHref: '',
          tertiaryCtaLabel: '',
          tertiaryCtaHref: '',
          slides: Array.isArray((heroSection.settings as Record<string, unknown> | null)?.slides)
            ? ((heroSection.settings as Record<string, unknown> | null)?.slides as Array<Record<string, unknown>>).map(
                (slide) => ({
                  ...slide,
                  href: '/presupuesto',
                  linkLabel: 'Solicitar presupuesto',
                }),
              )
            : undefined,
        },
      },
    })
  }

  const contentSplit = sections.find((section) => section.key === 'content-split-2')
  if (contentSplit) {
    await prisma.cmsPageSection.update({
      where: { id: contentSplit.id },
      data: {
        settings: {
          ...((contentSplit.settings as Record<string, unknown> | null) ?? {}),
          description:
            'Aceptamos pagos mediante Mercado Pago y ofrecemos alternativas comerciales para facilitar la compra.',
        },
      },
    })
  }

  const servicesGrid = sections.find((section) => section.key === 'services-grid')
  if (servicesGrid) {
    await prisma.cmsPageSection.update({
      where: { id: servicesGrid.id },
      data: {
        settings: {
          ...((servicesGrid.settings as Record<string, unknown> | null) ?? {}),
          description:
            'Brindamos venta, instalación, mantenimiento y reparación con productos a medida y acompañamiento profesional.',
        },
      },
    })
  }

  const faqHomeSeed = buildFaqSection(
    'Preguntas frecuentes',
    'Consultas reales que ayudan a cerrar la compra más rápido.',
    10,
    'faq-home',
  )
  const faqHomeSection = sections.find((section) => section.key === 'faq-home')
  await syncSeedSection(prisma, page.id, faqHomeSection ?? null, faqHomeSeed as PageSectionSeed)

  if (!sections.some((section) => section.key === 'cta-3')) {
    await prisma.cmsPageSection.create({
      data: {
        pageId: page.id,
        type: CmsPageSectionType.CTA_BANNER,
        key: 'cta-3',
        name: 'Quiénes somos y FAQ',
        sortOrder: 11,
        visible: true,
        settings: {
          title: 'Conocé urucortinas y resolvé tus dudas antes de comprar',
          description:
            'Encontrá información útil para avanzar con confianza y pedí presupuesto cuando quieras pasar a la acción.',
          actions: [
            { label: 'Quiénes somos', href: '/quienes-somos' },
            { label: 'Preguntas frecuentes', href: '/preguntas-frecuentes' },
            { label: 'Ir a la tienda', href: '/shop' },
          ],
          variant: 'default',
        },
      },
    })
  } else {
    const ctaSection = sections.find((section) => section.key === 'cta-3')
    if (ctaSection) {
      const nextActions = [
        { label: 'Quiénes somos', href: '/quienes-somos' },
        { label: 'Preguntas frecuentes', href: '/preguntas-frecuentes' },
        { label: 'Ir a la tienda', href: '/shop' },
      ]
      const dedupedActions = nextActions.filter(
        (candidate, index, list) =>
          index ===
          list.findIndex(
            (item) =>
              String(item.label).trim().toLowerCase() === String(candidate.label).trim().toLowerCase() &&
              String(item.href).trim().toLowerCase() === String(candidate.href).trim().toLowerCase(),
          ),
      )
      await prisma.cmsPageSection.update({
        where: { id: ctaSection.id },
        data: {
          settings: {
            ...((ctaSection.settings as Record<string, unknown> | null) ?? {}),
            title: 'Conocé urucortinas y resolvé tus dudas antes de comprar',
            description:
              'Encontrá información útil para avanzar con confianza y pedí presupuesto cuando quieras pasar a la acción.',
            actions: dedupedActions,
            variant: 'default',
          },
        },
      })
    }
  }
}

async function ensureShopCtaForPublicPages(prisma: PrismaClient) {
  const pages = await prisma.cmsPage.findMany({
    where: {
      OR: [{ path: { startsWith: 'productos/' } }, { path: { startsWith: 'servicios/' } }],
    },
    include: {
      sections: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
    },
  })

  for (const page of pages) {
    if (page.sections.some((section) => section.key === 'shop-cta')) {
      continue
    }

    const nextSortOrder = (page.sections.at(-1)?.sortOrder ?? 0) + 1
    await prisma.cmsPageSection.create({
      data: {
        pageId: page.id,
        type: CmsPageSectionType.CTA_BANNER,
        key: 'shop-cta',
        name: 'Ver la tienda',
        sortOrder: nextSortOrder,
        visible: true,
        settings: {
          title: 'Encontrá la solución ideal en la tienda',
          description:
            'Explorá el catálogo para comparar modelos, revisar opciones y avanzar con una compra o presupuesto.',
          actions: [
            { label: 'Ir a la tienda', href: '/shop' },
            { label: 'Pedir presupuesto', href: '/contacto.html' },
          ],
          variant: 'default',
        },
      },
    })
  }
}

export async function seedUrucortinasPublicCmsContent(prisma: PrismaClient) {
  await ensureStorefrontConfig(prisma)
  for (const page of PUBLIC_PAGES) {
    await ensurePage(prisma, page)
  }
  await ensureHomePageEnhancements(prisma)
  await ensureShopCtaForPublicPages(prisma)
  console.log('[seed] urucortinas public CMS content loaded.')
}
