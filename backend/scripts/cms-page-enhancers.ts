import { CmsEntryStatus, CmsMediaType, CmsPageBlockType, CmsPageSectionType } from '@prisma/client'

export type CmsEnhancerMediaSpec = {
  url: string
  type?: CmsMediaType
  alt?: string | null
  title?: string | null
  source?: string | null
  metadata?: Record<string, unknown> | null
}

export type CmsEnhancerBlockSpec = {
  type: CmsPageBlockType
  key?: string | null
  name?: string | null
  sortOrder?: number
  visible?: boolean
  content?: Record<string, unknown> | null
  media?: CmsEnhancerMediaSpec | null
}

export type CmsEnhancerSectionSpec = {
  key: string
  type: CmsPageSectionType
  name?: string | null
  sortOrder?: number
  visible?: boolean
  settings?: Record<string, unknown> | null
  blocks?: CmsEnhancerBlockSpec[]
}

export type CmsEnhancerPagePatch = {
  title?: string
  summary?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  seoImageUrl?: string | null
  layoutKey?: string | null
  legacySource?: string | null
  status?: CmsEntryStatus
  visible?: boolean
}

export type CmsEnhancerSectionMatch = {
  key?: string | null
  type?: CmsPageSectionType | null
  name?: string | null
}

export type CmsPageEnhancerSpec = {
  id: string
  pagePath: string
  pagePatch?: CmsEnhancerPagePatch
  hideSections?: CmsEnhancerSectionMatch[]
  sections: CmsEnhancerSectionSpec[]
}

const featureCard = (
  name: string,
  title: string,
  description: string,
  href: string,
  mediaUrl: string,
  alt: string,
  badge = 'Detalle',
): CmsEnhancerBlockSpec => ({
  type: CmsPageBlockType.CARD,
  name,
  content: {
    title,
    description,
    badge,
    overlayText: true,
    linkLabel: 'Ver más',
    href,
    headingLevel: 'h3',
  },
  media: {
    url: mediaUrl,
    alt,
    title,
    type: CmsMediaType.IMAGE,
    source: 'product_page_enhancer',
  },
})

const faqItem = (name: string, question: string, answer: string): CmsEnhancerBlockSpec => ({
  type: CmsPageBlockType.FAQ_ITEM,
  name,
  content: {
    question,
    answerRichText: [
      {
        type: 'element',
        tag: 'p',
        children: [{ type: 'text', value: answer }],
      },
    ],
  },
})

const featureGridSection = (
  key: string,
  name: string,
  title: string,
  description: string,
  blocks: CmsEnhancerBlockSpec[],
): CmsEnhancerSectionSpec => ({
  key,
  type: CmsPageSectionType.FEATURE_GRID,
  name,
  settings: {
    title,
    description,
    itemHeadingLevel: 'h3',
  },
  blocks,
})

const faqSection = (
  key: string,
  name: string,
  title: string,
  description: string,
  blocks: CmsEnhancerBlockSpec[],
): CmsEnhancerSectionSpec => ({
  key,
  type: CmsPageSectionType.FAQ,
  name,
  settings: {
    title,
    description,
  },
  blocks,
})

const rtText = (value: string) => ({
  type: 'text',
  value,
})

const rtElement = (tag: string, children: Array<Record<string, unknown>> = []) => ({
  type: 'element',
  tag,
  children,
})

const rtParagraph = (children: Array<Record<string, unknown>> | string) =>
  rtElement('p', Array.isArray(children) ? children : [rtText(String(children))])

const rtHeading = (tag: 'h2' | 'h3' | 'h4', value: string) => rtElement(tag, [rtText(value)])

const rtStrong = (value: string) => rtElement('strong', [rtText(value)])

const rtList = (items: Array<Array<Record<string, unknown>>>) =>
  rtElement(
    'ul',
    items.map((children) =>
      rtElement('li', Array.isArray(children) ? children : [rtText(String(children))]),
    ),
  )

const editorialSplitSection = (
  key: string,
  name: string,
  title: string,
  description: string,
  imageUrl: string | null,
  imageAlt: string,
  actions: Array<{ label: string; href: string }>,
  contentNodes: Array<Record<string, unknown>>,
  gallery: Array<{
    imageUrl: string
    imageAlt: string
    href?: string
    linkLabel?: string
  }> = [],
): CmsEnhancerSectionSpec => ({
  key,
  type: CmsPageSectionType.CONTENT_SPLIT,
  name,
  settings: {
    title,
    description,
    variant: 'media-gallery-content',
    mediaPosition: 'start',
    imageAlt,
    imageUrl,
    gallery,
    actions,
  },
  blocks: [
    {
      type: CmsPageBlockType.RICH_TEXT,
      key: `${key}-copy`,
      name: 'Contenido editorial',
      sortOrder: 0,
      visible: true,
      content: {
        richText: contentNodes,
      },
    },
  ],
})

export const CMS_PAGE_ENHANCERS: CmsPageEnhancerSpec[] = [
  {
    id: 'roller-product-page',
    pagePath: 'productos/cortinas-roller.html',
    pagePatch: {
      title: 'Cortinas Roller',
      summary: 'Screen, blackout y roller doble para controlar luz y privacidad según cada ambiente.',
      seoTitle: 'Cortinas Roller Blackout y Screen a Medida | Urucortinas',
      seoDescription:
        'Cortinas roller blackout, screen y dobles a medida para hogar y oficina. Elegí según la luz, la privacidad y el uso diario.',
    },
    sections: [
      {
        key: 'roller-variant-comparison',
        type: CmsPageSectionType.MEDIA_GRID_ENHANCED,
        name: 'Comparativa de variantes',
        settings: {
          title: 'Elegí entre Screen, Blackout o Roller Doble',
          description:
            'La decisión cambia según la luz que querés dejar pasar, el nivel de privacidad y el uso del ambiente.',
          columns: 3,
          gap: 1.1,
          aspectRatio: '4 / 5',
        },
        blocks: [
          {
            type: CmsPageBlockType.CARD,
            name: 'Screen',
            sortOrder: 0,
            content: {
              title: 'Screen',
              description:
                'Deja pasar luz natural y ayuda a mantener vista hacia el exterior. Es una opción práctica para livings, oficinas y espacios de uso diario.',
              badge: 'Luz + vista',
              overlayText: true,
              linkLabel: 'Pedir asesoramiento',
              href: '/contacto.html',
            },
            media: {
              url: '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_2.jpeg',
              alt: 'Cortinas roller screen',
              title: 'Screen',
              type: CmsMediaType.IMAGE,
              source: 'roller_product_enhancement',
            },
          },
          {
            type: CmsPageBlockType.CARD,
            name: 'Blackout',
            sortOrder: 1,
            content: {
              title: 'Blackout',
              description:
                'Reduce la entrada de luz y mejora la privacidad. Conviene en dormitorios, salas de proyección y ambientes donde querés más oscuridad.',
              badge: 'Oscurecimiento',
              overlayText: true,
              linkLabel: 'Pedir asesoramiento',
              href: '/contacto.html',
            },
            media: {
              url: '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg',
              alt: 'Cortinas roller blackout',
              title: 'Blackout',
              type: CmsMediaType.IMAGE,
              source: 'roller_product_enhancement',
            },
          },
          {
            type: CmsPageBlockType.CARD,
            name: 'Roller doble',
            sortOrder: 2,
            content: {
              title: 'Roller doble',
              description:
                'Combina dos telas en una sola instalación para alternar luz y oscuridad según el momento y el uso del ambiente.',
              badge: 'Versatilidad',
              overlayText: true,
              linkLabel: 'Pedir asesoramiento',
              href: '/contacto.html',
            },
            media: {
              url: '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_4.jpeg',
              alt: 'Cortinas roller doble',
              title: 'Roller doble',
              type: CmsMediaType.IMAGE,
              source: 'roller_product_enhancement',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'cortinas-enrollar-detail',
    pagePath: 'productos/cortinas-de-enrollar.html',
    pagePatch: {
      title: 'Cortinas de enrollar',
      summary: 'Cortinas de enrollar en PVC o aluminio para controlar luz, privacidad y seguridad.',
      seoTitle: 'Cortinas de enrollar en PVC y aluminio | Urucortinas',
      seoDescription:
        'Cortinas de enrollar en PVC o aluminio para hogar, comercio y recambio. Soluciones manuales o motorizadas con instalación y reparación.',
      legacySource: '/productos/cortinas-de-enrollar.html',
    },
    sections: [
      editorialSplitSection(
        'cortinas-enrollar-editorial',
        'Guía comercial de cortinas de enrollar',
        'Elegí según el material, el uso y la exposición',
        'PVC y aluminio resuelven necesidades distintas. La instalación y el tamaño del frente también influyen en la elección.',
        '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_1.jpeg',
        'Cortinas de enrollar en PVC y aluminio',
        [
          { label: 'Pedir asesoramiento', href: '/contacto.html' },
          { label: 'Ver precios', href: '/precios/cortinas-de-enrollar' },
        ],
        [
          rtParagraph([
            rtStrong('PVC'),
            rtText(' conviene cuando buscás una solución práctica, más accesible y con buen aislamiento para uso cotidiano.'),
          ]),
          rtParagraph([
            rtStrong('Aluminio'),
            rtText(' gana cuando el frente necesita más resistencia, más durabilidad y una respuesta más sólida al uso diario.'),
          ]),
          rtParagraph(
            'En frentes anchos puede convenir dividir la cortina en dos tramos para mejorar la manipulación y el funcionamiento.',
          ),
          rtList([
            [rtText('Uso en hogar, comercio o recambio de sistemas viejos.')],
            [rtText('Posibilidad de versión manual o motorizada según el caso.')],
            [rtText('La medida y el tipo de instalación impactan en el presupuesto final.')],
          ]),
        ],
        [
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_1.jpeg',
            imageAlt: 'Cortina de enrollar en PVC',
            href: '/productos/cortinas-de-enrollar-pvc.html',
            linkLabel: 'Ver PVC',
          },
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_2.jpeg',
            imageAlt: 'Cortina de enrollar en aluminio',
            href: '/productos/cortinas-de-enrollar-aluminio.html',
            linkLabel: 'Ver aluminio',
          },
        ],
      ),
      featureGridSection(
        'cortinas-enrollar-features',
        'Qué define la elección',
        'Material, uso y nivel de exposición',
        'Cada combinación resuelve una necesidad distinta de confort, resistencia y mantenimiento.',
        [
          featureCard(
            'PVC',
            'PVC',
            'Solución práctica y accesible para recambio o instalación nueva.',
            '/productos/cortinas-de-enrollar-pvc.html',
            '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_1.jpeg',
            'Cortina de enrollar PVC',
            'Material',
          ),
          featureCard(
            'Aluminio',
            'Aluminio',
            'Más resistencia y mejor respuesta para uso exigente.',
            '/productos/cortinas-de-enrollar-aluminio.html',
            '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_2.jpeg',
            'Cortina de enrollar aluminio',
            'Resistencia',
          ),
          featureCard(
            'Manual o motorizada',
            'Manual o motorizada',
            'Elegí según comodidad, tamaño del frente y frecuencia de uso.',
            '/productos/motores-cortinas-y-persianas.html',
            '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
            'Cortina de enrollar motorizada',
            'Automatización',
          ),
          featureCard(
            'Recambio',
            'Recambio y reparación',
            'Si ya tenés una instalación previa, evaluamos qué conviene reparar o reemplazar.',
            '/servicios/reparacion-cortinas-y-persianas.html',
            '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
            'Recambio de cortina de enrollar',
            'Servicio',
          ),
        ],
      ),
      faqSection(
        'cortinas-enrollar-faq',
        'Preguntas frecuentes',
        'Cortinas de enrollar: dudas útiles',
        'Respuestas para avanzar con una cotización o decidir el material correcto.',
        [
          faqItem(
            'cortinas-enrollar-faq-1',
            '¿Conviene PVC o aluminio?',
            'PVC suele ser una opción más práctica y accesible. Aluminio conviene cuando necesitás más resistencia y durabilidad.',
          ),
          faqItem(
            'cortinas-enrollar-faq-2',
            '¿Se puede motorizar?',
            'Sí, en muchos casos podés sumar motorización según el sistema y el tamaño del frente.',
          ),
          faqItem(
            'cortinas-enrollar-faq-3',
            '¿Qué datos ayudan a cotizar?',
            'Ancho, alto, material y si la instalación es nueva o de recambio alcanzan para orientar mejor el presupuesto.',
          ),
        ],
      ),
    ],
  },
  {
    id: 'cortinas-enrollar-aluminio-detail',
    pagePath: 'productos/cortinas-de-enrollar-aluminio.html',
    pagePatch: {
      title: 'Cortinas de enrollar en aluminio',
      summary: 'Cortinas en aluminio para sumar resistencia, aislamiento y durabilidad en uso diario.',
      seoTitle: 'Cortinas de enrollar en aluminio | Resistencia y aislamiento - Urucortinas',
      seoDescription:
        'Cortinas de enrollar en aluminio para frentes expuestos, recambio o instalación nueva. Más resistencia, mejor aislación y opción manual o motorizada.',
      legacySource: '/productos/cortinas-de-enrollar-aluminio.html',
    },
    sections: [
      editorialSplitSection(
        'cortinas-aluminio-editorial',
        'Guía comercial de cortinas de enrollar en aluminio',
        'Elegí aluminio cuando necesitás más resistencia y durabilidad',
        'Las cortinas de enrollar en aluminio resuelven bien frentes exigentes, uso diario y situaciones donde buscás una solución más sólida que otras alternativas.',
        '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_2.jpeg',
        'Cortinas de enrollar en aluminio',
        [
          { label: 'Pedir asesoramiento', href: '/contacto.html' },
          { label: 'Ver comparativa PVC', href: '/guias/cortinas-pvc-vs-aluminio' },
        ],
        [
          rtParagraph([
            rtStrong('Resistencia'),
            rtText(' cuando el frente necesita una respuesta más firme frente al uso cotidiano, el clima y la exposición.'),
          ]),
          rtParagraph([
            rtStrong('Aislación'),
            rtText(' porque las lamas rellenas de espuma ayudan a mejorar el confort térmico y acústico.'),
          ]),
          rtParagraph(
            'También es una opción muy útil para reemplazos donde querés mejorar el sistema sin perder una estética prolija.',
          ),
          rtList([
            [rtText('Opción manual o motorizada según tamaño y comodidad deseada.')],
            [rtText('Variedad de colores para adaptar la terminación al frente o interior.')],
            [rtText('Mantenimiento simple y buena durabilidad para uso frecuente.')],
          ]),
        ],
        [
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_1.jpeg',
            imageAlt: 'Cortina de enrollar en aluminio',
            href: '/contacto.html',
            linkLabel: 'Pedir asesoramiento',
          },
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
            imageAlt: 'Cortina de enrollar aluminio',
            href: '/guias/cortinas-pvc-vs-aluminio',
            linkLabel: 'Ver comparativa',
          },
        ],
      ),
      featureGridSection(
        'cortinas-aluminio-features',
        'Qué define al aluminio',
        'Elegí según resistencia, aislamiento y uso',
        'La combinación de material, exposición y comodidad de uso define la mejor opción.',
        [
          featureCard(
            'Resistencia',
            'Más resistencia',
            'La construcción en aluminio responde mejor en frentes expuestos y uso frecuente.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_2.jpeg',
            'Cortina de enrollar aluminio resistencia',
            'Material',
          ),
          featureCard(
            'Aislación',
            'Aislación térmica y acústica',
            'Las lamas rellenas de espuma ayudan a mejorar el confort interior.',
            '/guias/cortinas-pvc-vs-aluminio',
            '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_1.jpeg',
            'Cortina de enrollar aluminio aislación',
            'Confort',
          ),
          featureCard(
            'Colores',
            'Terminación adaptable',
            'La variedad de colores permite acompañar mejor la estética del frente.',
            '/productos/cortinas-de-enrollar-aluminio.html',
            '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
            'Cortina de enrollar aluminio colores',
            'Terminación',
          ),
          featureCard(
            'Uso',
            'Manual o motorizada',
            'Podés definir la solución según el tamaño y el uso diario del ambiente.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
            'Cortina de enrollar aluminio motorizada',
            'Uso',
          ),
        ],
      ),
      faqSection(
        'cortinas-aluminio-faq',
        'Preguntas frecuentes',
        'Cortinas de enrollar en aluminio: dudas útiles',
        'Respuestas breves para avanzar con una cotización clara.',
        [
          faqItem(
            'cortinas-aluminio-faq-1',
            '¿Cuándo conviene aluminio?',
            'Conviene cuando buscás más resistencia, mejor aislación y una solución sólida para uso frecuente o frentes expuestos.',
          ),
          faqItem(
            'cortinas-aluminio-faq-2',
            '¿Se puede motorizar?',
            'Sí, la motorización puede sumarse según el tamaño y el tipo de instalación.',
          ),
          faqItem(
            'cortinas-aluminio-faq-3',
            '¿Qué datos ayudan a cotizar?',
            'Las medidas, el tipo de instalación y si buscás versión manual o motorizada alcanzan para orientar el presupuesto.',
          ),
        ],
      ),
    ],
  },
  {
    id: 'bandas-verticales-detail',
    pagePath: 'productos/bandas-verticales.html',
    pagePatch: {
      title: 'Bandas verticales a medida',
      summary: 'Bandas verticales para ventanales amplios, oficinas y ambientes con grandes paños vidriados.',
      seoTitle: 'Bandas Verticales a medida | Blackout, Screen y poliéster - Urucortinas',
      seoDescription:
        'Bandas verticales a medida en blackout, screen y poliéster. Ideales para ventanales amplios, oficinas y ambientes de uso diario.',
      legacySource: '/productos/bandas-verticales.html',
    },
    sections: [
      editorialSplitSection(
        'bands-verticales-editorial',
        'Guía comercial de bandas verticales',
        'Resolvé ventanales grandes con control gradual de luz',
        'Las bandas verticales funcionan muy bien cuando necesitás cubrir superficies amplias sin perder orden visual.',
        '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_verticales_3.jpeg',
        'Bandas verticales a medida',
        [
          { label: 'Pedir asesoramiento', href: '/contacto.html' },
          { label: 'Ver multimedia', href: '/multimedia/bandas-verticales' },
        ],
        [
          rtParagraph([
            rtStrong('Screen, blackout o poliéster'),
            rtText(' son las alternativas más útiles según cuánto querés filtrar luz, oscurecer o sumar presencia decorativa.'),
          ]),
          rtParagraph(
            'Convienen en oficinas, livings, comedores y escritorios donde el tamaño del frente pide una solución funcional y prolija.',
          ),
          rtParagraph(
            'También podés definir plegado normal, invertido, al centro o hacia ambos lados para acompañar la circulación del ambiente.',
          ),
          rtList([
            [rtText('Regulación gradual de luz con giro simple de las lamas.')],
            [rtText('Buena lectura visual en ventanales amplios.')],
            [rtText('Materiales aptos para uso funcional y decorativo.')],
          ]),
        ],
        [
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_verticales_3.jpeg',
            imageAlt: 'Bandas verticales control de luz',
            href: '/multimedia/bandas-verticales',
            linkLabel: 'Ver fotos',
          },
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/banda_vertical_1.jpeg',
            imageAlt: 'Bandas verticales en living',
            href: '/contacto.html',
            linkLabel: 'Pedir asesoramiento',
          },
        ],
      ),
      featureGridSection(
        'bands-verticales-features',
        'Qué define a las bandas verticales',
        'Bandas verticales para ventanales amplios',
        'Elegí por superficie, uso y nivel de control que necesitás.',
        [
          featureCard(
            'Control de luz',
            'Control gradual de luz',
            'Las lamas permiten regular la entrada de luz con un giro simple y práctico.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_verticales_3.jpeg',
            'Bandas verticales control de luz',
            'Luz',
          ),
          featureCard(
            'Materiales',
            'Blackout, screen o poliéster',
            'Se adaptan a distintos niveles de oscurecimiento y a usos más decorativos o funcionales.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/banda_vertical_2.jpeg',
            'Bandas verticales materiales',
            'Materiales',
          ),
          featureCard(
            'Grandes superficies',
            'Pensadas para ventanales grandes',
            'Funcionan muy bien en aberturas anchas, escritorios, living y comedor.',
            '/multimedia/bandas-verticales',
            '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_8.jpeg',
            'Bandas verticales ventanales',
            'Superficie',
          ),
          featureCard(
            'Plegado',
            'Normal, invertido o al centro',
            'Podés definir el sentido de apertura según la circulación y la forma del ambiente.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_7.jpeg',
            'Bandas verticales plegado',
            'Apertura',
          ),
        ],
      ),
      faqSection(
        'bandas-verticales-faq',
        'Preguntas frecuentes',
        'Bandas verticales: dudas comunes',
        'Respuestas útiles antes de pedir presupuesto o comparar con otra solución.',
        [
          faqItem(
            'bands-faq-1',
            '¿En qué ambientes convienen?',
            'Convienen en oficinas, living, comedor y ventanales amplios donde necesitás regular luz y circulación.',
          ),
          faqItem(
            'bands-faq-2',
            '¿Qué materiales se usan?',
            'Trabajamos opciones en poliéster, screen y blackout según la prestación que busques.',
          ),
          faqItem(
            'bands-faq-3',
            '¿Qué datos ayudan a cotizar mejor?',
            'Ancho, alto, ambiente de uso y preferencia de apertura alcanzan para orientar mejor la propuesta.',
          ),
        ],
      ),
    ],
  },
  {
    id: 'venecianas-detail',
    pagePath: 'productos/venecianas.html',
    pagePatch: {
      title: 'Cortinas venecianas en aluminio',
      summary: 'Venecianas de aluminio para controlar luz, privacidad y mantenimiento simple.',
      seoTitle: 'Cortinas Venecianas en aluminio | 16 mm y 25 mm - Urucortinas',
      seoDescription:
        'Cortinas venecianas de aluminio con lamas de 16 mm y 25 mm. Regulación precisa de luz y privacidad para hogar y oficina.',
      legacySource: '/productos/venecianas.html',
    },
    sections: [
      editorialSplitSection(
        'venecianas-editorial',
        'Guía comercial de venecianas',
        'Elegí venecianas según el frente y la terminación',
        'Las venecianas resuelven muy bien ambientes donde querés precisión en la entrada de luz y una terminación prolija.',
        '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_4.jpeg',
        'Venecianas en aluminio',
        [
          { label: 'Pedir asesoramiento', href: '/contacto.html' },
          { label: 'Ver multimedia', href: '/multimedia/venecianas' },
        ],
        [
          rtParagraph([
            rtStrong('Lamas de 16 mm y 25 mm'),
            rtText(' cubren necesidades distintas de presencia visual y control de la luz según el ambiente.'),
          ]),
          rtParagraph(
            'El aluminio suma durabilidad y un mantenimiento simple, por eso funcionan bien en hogar y oficina.',
          ),
          rtParagraph(
            'Si buscás una solución para regular con precisión sin recargar el frente, venecianas es una opción muy sólida.',
          ),
          rtList([
            [rtText('Regulación precisa de luz y privacidad.')],
            [rtText('Terminaciones limpias con colores variados.')],
            [rtText('Buenas para dormitorios, oficinas y salas de estar.')],
          ]),
        ],
        [
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_1.jpeg',
            imageAlt: 'Venecianas de aluminio 16 mm',
            href: '/multimedia/venecianas',
            linkLabel: 'Ver fotos',
          },
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_4.jpeg',
            imageAlt: 'Venecianas de aluminio 25 mm',
            href: '/contacto.html',
            linkLabel: 'Pedir asesoramiento',
          },
        ],
      ),
      featureGridSection(
        'venecianas-features',
        'Qué define a las venecianas',
        'Elegí venecianas según uso y terminación',
        'La regulación de luz, la medida de lama y el mantenimiento marcan la diferencia.',
        [
          featureCard(
            'Regulación',
            'Regulación precisa de luz',
            'Las lamas orientables permiten graduar la entrada de luz con bastante exactitud.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_1.jpeg',
            'Venecianas regulación',
            'Luz',
          ),
          featureCard(
            'Medidas',
            'Lamas de 16 mm y 25 mm',
            'Las dos medidas cubren necesidades distintas de presencia visual y lectura del frente.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_4.jpeg',
            'Venecianas lamas',
            'Lamas',
          ),
          featureCard(
            'Mantenimiento',
            'Mantenimiento simple',
            'El aluminio ofrece una solución práctica para uso cotidiano y limpieza sencilla.',
            '/multimedia/venecianas',
            '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_3.jpeg',
            'Venecianas mantenimiento',
            'Mantenimiento',
          ),
          featureCard(
            'Uso',
            'Hogar y oficina',
            'Funcionan bien en ambientes donde querés orden visual, privacidad y una solución prolija.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_5.jpeg',
            'Venecianas hogar oficina',
            'Uso',
          ),
        ],
      ),
      faqSection(
        'venecianas-faq',
        'Preguntas frecuentes',
        'Venecianas: dudas frecuentes',
        'Respuestas breves para cerrar mejor la decisión.',
        [
          faqItem(
            'venecianas-faq-1',
            '¿Conviene 16 mm o 25 mm?',
            '16 mm suele verse más liviana y 25 mm suele tener más presencia visual. La elección depende del frente y del ambiente.',
          ),
          faqItem(
            'venecianas-faq-2',
            '¿Sirven para hogar y oficina?',
            'Sí. Son una solución muy práctica para ambos casos cuando buscás regular luz y privacidad.',
          ),
          faqItem(
            'venecianas-faq-3',
            '¿Qué datos ayudan a cotizar?',
            'Ancho, alto, ambiente y medida de lama preferida son suficientes para orientar el presupuesto.',
          ),
        ],
      ),
    ],
  },
  {
    id: 'aberturas-aluminio-detail',
    pagePath: 'productos/aberturas-aluminio.html',
    pagePatch: {
      title: 'Aberturas de aluminio por serie',
      summary: 'Aberturas en aluminio organizadas por serie, con DVH como guía aparte para comparar prestaciones.',
      seoTitle: 'Aberturas de Aluminio por Serie | 20/25, Probba, Gala y Summa - Urucortinas',
      seoDescription:
        'Aberturas de aluminio por serie: 20/25, Probba, Gala y Summa. Elegí según obra, recambio y nivel de prestación. DVH como guía aparte.',
      legacySource: '/productos/aberturas-aluminio.html',
    },
    sections: [
      editorialSplitSection(
        'aberturas-aluminio-editorial',
        'Guía comercial de aberturas',
        'Elegí la serie según obra, recambio y nivel de prestación',
        'Las líneas estándar y de alta prestación no resuelven lo mismo. El proyecto, las medidas y el confort esperado cambian la elección.',
        '/uploads/cms/legacy-assets/img/aberturas/dvh-main.jpg',
        'Aberturas de aluminio por serie',
        [
          { label: 'Pedir asesoramiento', href: '/contacto.html' },
          { label: 'Ver guía DVH', href: '/articulos/dvh.html' },
        ],
        [
          rtParagraph([
            rtStrong('Serie 20 y 25'),
            rtText(' resuelven una necesidad estándar, con una alternativa funcional y más accesible para obra o recambio.'),
          ]),
          rtParagraph([
            rtStrong('Probba'),
            rtText(' abre la puerta a una alta prestación de entrada, con mejor cierre y posibilidad de DVH.'),
          ]),
          rtParagraph([
            rtStrong('Gala y Summa'),
            rtText(' apuntan a mayor confort, mejor terminación y una respuesta más sólida en proyectos exigentes.'),
          ]),
          rtList([
            [rtText('Obra nueva o reemplazo de aberturas existentes.')],
            [rtText('DVH como guía aparte para comparar aislamiento y confort.')],
            [rtText('Series y terminaciones según el nivel de exigencia del proyecto.')],
          ]),
        ],
        [
          {
            imageUrl: '/uploads/cms/legacy-assets/img/aberturas/dvh-main.jpg',
            imageAlt: 'Aberturas de aluminio por serie',
            href: '/articulos/dvh.html',
            linkLabel: 'Ver guía DVH',
          },
          {
            imageUrl: '/uploads/cms/legacy-assets/img/aberturas/monoblocks.jpg',
            imageAlt: 'Aberturas de aluminio con monoblock',
            href: '/contacto.html',
            linkLabel: 'Pedir asesoramiento',
          },
        ],
      ),
      featureGridSection(
        'aberturas-features',
        'Series y prestaciones',
        'Elegí la serie según tu proyecto',
        'Cada línea responde a un nivel distinto de exigencia, aislamiento y terminación.',
        [
          featureCard(
            'Serie 20 y 25',
            'Serie 20 y 25',
            'Una opción funcional y más accesible para resoluciones estándar.',
            '/productos/aberturas-serie-20-y-25.html',
            '/uploads/cms/legacy-assets/img/aberturas/ventana.jpg',
            'Serie 20 y 25',
            'Estándar',
          ),
          featureCard(
            'Probba',
            'Probba',
            'Punto de entrada a la alta prestación, con mejor cierre y posibilidad de DVH.',
            '/productos/aberturas-probba.html',
            '/uploads/cms/legacy-assets/img/aberturas/abertura_1.png',
            'Probba',
            'Alta prestación',
          ),
          featureCard(
            'Gala',
            'Gala',
            'Versátil y estética, pensada para proyectos que buscan más confort y mejor terminación.',
            '/productos/aberturas-gala.html',
            '/uploads/cms/legacy-assets/img/aberturas/gala.jpg',
            'Gala',
            'Confort',
          ),
          featureCard(
            'Summa',
            'Summa',
            'Línea premium orientada a grandes dimensiones, hermeticidad y prestaciones superiores.',
            '/productos/aberturas-summa.html',
            '/uploads/cms/legacy-assets/img/portfolio/aberturas/dvh-main.jpg',
            'Summa',
            'Premium',
          ),
        ],
      ),
      faqSection(
        'aberturas-faq',
        'Preguntas frecuentes',
        'Aberturas de aluminio: dudas comunes',
        'Respuestas para avanzar con obra nueva, recambio o líneas de mayor prestación.',
        [
          faqItem(
            'aberturas-faq-1',
            '¿Qué cambia entre serie estándar y alta prestación?',
            'La alta prestación suma mejor cierre, más confort y posibilidad de DVH según la línea.',
          ),
          faqItem(
            'aberturas-faq-2',
            '¿Qué serie conviene para empezar?',
            'Serie 20 y 25 resuelve lo estándar; Probba, Gala y Summa acompañan proyectos con más exigencia.',
          ),
          faqItem(
            'aberturas-faq-3',
            '¿Dónde veo la guía de DVH?',
            'La guía de DVH queda como referencia aparte para comparar aislamiento y confort.',
          ),
        ],
      ),
    ],
  },
  {
    id: 'toldos-cerramientos-detail',
    pagePath: 'productos/toldos-y-cerramientos.html',
    pagePatch: {
      title: 'Toldos y cerramientos',
      summary: 'Toldos y cerramientos para sombra, protección climática y más uso del exterior.',
      seoTitle: 'Toldos y Cerramientos | Protección exterior y confort - Urucortinas',
      seoDescription:
        'Toldos de brazo invisible, toldos verticales, corredizos y cerramientos en PVC para terrazas, patios y frentes con más confort.',
      legacySource: '/productos/toldos-y-cerramientos.html',
    },
    sections: [
      editorialSplitSection(
        'toldos-editorial',
        'Guía comercial de exterior',
        'Elegí la solución según sombra, protección y uso del espacio',
        'Cada sistema resuelve una necesidad distinta en terrazas, patios y frentes con exposición al clima.',
        '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo_indico_1.jpeg',
        'Toldos y cerramientos',
        [
          { label: 'Pedir asesoramiento', href: '/contacto.html' },
          { label: 'Ver multimedia', href: '/multimedia/toldos-y-cerramientos' },
        ],
        [
          rtParagraph([
            rtStrong('Brazo invisible, vertical o corredizo'),
            rtText(' son soluciones distintas para niveles distintos de sombra y cobertura.'),
          ]),
          rtParagraph(
            'El cerramiento en PVC suma protección frente a viento y lluvia, y permite aprovechar más el exterior.',
          ),
          rtParagraph(
            'La elección suele depender del frente, el avance, la altura y el nivel de resguardo que necesitás.',
          ),
          rtList([
            [rtText('Protección solar y climática en terrazas y patios.')],
            [rtText('Mayor uso del exterior con cerramientos en PVC.')],
            [rtText('Posibilidad de motorización según el sistema.')],
          ]),
        ],
        [
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo_indico_1.jpeg',
            imageAlt: 'Toldo de brazo invisible',
            href: '/multimedia/toldos-y-cerramientos',
            linkLabel: 'Ver fotos',
          },
          {
            imageUrl: '/media/products/toldos-cerramientos/images/3b4802df-8fac-4372-8824-3b410d057349.jpg__3b4802df-8fac-4372-8824-3b410d057349.jpg',
            imageAlt: 'Cerramiento en PVC',
            href: '/contacto.html',
            linkLabel: 'Pedir asesoramiento',
          },
        ],
      ),
      featureGridSection(
        'toldos-features',
        'Soluciones para exterior',
        'Elegí según el tipo de uso exterior',
        'Cada sistema resuelve una necesidad distinta de sombra, protección y circulación.',
        [
          featureCard(
            'Brazo invisible',
            'Toldo de brazo invisible',
            'Da sombra sin apoyos delanteros y mantiene libre la circulación.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo_indico_1.jpeg',
            'Toldo de brazo invisible',
            'Sombra',
          ),
          featureCard(
            'Vertical',
            'Toldo vertical',
            'Funciona como un roller para exterior y protege del sol, viento y lluvia ligera.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo_zen_1.jpeg',
            'Toldo vertical',
            'Exterior',
          ),
          featureCard(
            'Corredizo',
            'Toldo corredizo',
            'Cubre superficies grandes y permite recoger la cobertura cuando no se usa.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo.jpg',
            'Toldo corredizo',
            'Cobertura',
          ),
          featureCard(
            'Cerramiento PVC',
            'Cerramiento en PVC',
            'Resguarda sin perder visibilidad y suma protección frente a clima adverso.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/toldos/cerramiento-pvc.jpg',
            'Cerramiento PVC',
            'Protección',
          ),
        ],
      ),
      faqSection(
        'toldos-faq',
        'Preguntas frecuentes',
        'Toldos y cerramientos: dudas útiles',
        'Respuestas para elegir mejor en patios, galerías y terrazas.',
        [
          faqItem(
            'toldos-faq-1',
            '¿Qué conviene para una terraza?',
            'Depende del nivel de sombra y protección que necesites. Brazo invisible y corredizo resuelven usos distintos.',
          ),
          faqItem(
            'toldos-faq-2',
            '¿Se pueden motorizar?',
            'Sí, varias soluciones admiten motorización según el sistema elegido.',
          ),
          faqItem(
            'toldos-faq-3',
            '¿Qué datos ayudan a cotizar?',
            'Frente, avance, altura, si va a muro o techo y si querés motorización.',
          ),
        ],
      ),
    ],
  },
  {
    id: 'motores-detail',
    pagePath: 'productos/motores-cortinas-y-persianas.html',
    pagePatch: {
      title: 'Motores para cortinas y persianas',
      summary: 'Automatización para cortinas y persianas con más confort, control y uso cotidiano.',
      seoTitle: 'Motores para Cortinas y Persianas | Automatización y confort - Urucortinas',
      seoDescription:
        'Motores para cortinas y persianas con control remoto, botonera, app y domótica para vivienda, oficina y comercios.',
      legacySource: '/productos/motores-cortinas-y-persianas.html',
    },
    sections: [
      editorialSplitSection(
        'motores-editorial',
        'Guía comercial de automatización',
        'Automatizá según tu rutina y el tipo de frente',
        'La motorización suma comodidad en cortinas, persianas y cortinas metálicas cuando el uso ya es frecuente o la medida es grande.',
        '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
        'Motores para cortinas y persianas',
        [
          { label: 'Pedir asesoramiento', href: '/contacto.html' },
          { label: 'Ver fotos', href: '/multimedia/motores-cortinas-y-persianas' },
        ],
        [
          rtParagraph([
            rtStrong('Control remoto, botonera, app o domótica'),
            rtText(' son los caminos más habituales para adaptar la automatización a la rutina real.'),
          ]),
          rtParagraph(
            'En muchos casos se puede automatizar una instalación ya existente, según el sistema y el estado actual.',
          ),
          rtParagraph(
            'La elección del control depende de la comodidad que busques y del nivel de integración que quieras sumar.',
          ),
          rtList([
            [rtText('Más confort en uso diario.')],
            [rtText('Integración con hogar u oficina.')],
            [rtText('Apertura y cierre más simples en frentes grandes.')],
          ]),
        ],
        [
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
            imageAlt: 'Persianas motorizadas',
            href: '/multimedia/motores-cortinas-y-persianas',
            linkLabel: 'Ver fotos',
          },
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/motores/motor_cortina_1.jpg',
            imageAlt: 'Motor para cortinas',
            href: '/contacto.html',
            linkLabel: 'Pedir asesoramiento',
          },
        ],
      ),
      featureGridSection(
        'motores-features',
        'Cómo automatizar',
        'Automatización para el uso diario',
        'Elegí el control que mejor encaja con tu rutina y el tipo de cortina o persiana.',
        [
          featureCard(
            'Control remoto',
            'Control remoto',
            'La forma más simple de subir o bajar sin esfuerzo físico.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/motores/motor_cortina_1.jpg',
            'Control remoto',
            'Comodidad',
          ),
          featureCard(
            'Botonera',
            'Botonera fija',
            'Ideal cuando querés un punto de control fijo y práctico.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/motores/motor_cortina_2.png',
            'Botonera',
            'Control',
          ),
          featureCard(
            'App',
            'App móvil',
            'Permite integrar el uso con un teléfono o automatizar rutinas simples.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
            'App móvil',
            'App',
          ),
          featureCard(
            'Domótica',
            'Hogar inteligente',
            'Puede integrarse con soluciones de programación y control remoto más avanzado.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
            'Domótica',
            'Automatización',
          ),
        ],
      ),
      faqSection(
        'motores-faq',
        'Preguntas frecuentes',
        'Motores: dudas frecuentes',
        'Respuestas para decidir si motorizás una cortina o persiana.',
        [
          faqItem(
            'motores-faq-1',
            '¿Se puede motorizar una cortina ya instalada?',
            'En muchos casos sí, pero depende del sistema y del estado actual del frente.',
          ),
          faqItem(
            'motores-faq-2',
            '¿Qué opciones de control existen?',
            'Tenemos control remoto, botonera, app y alternativas de integración con automatización.',
          ),
          faqItem(
            'motores-faq-3',
            '¿Qué se necesita para cotizar?',
            'Tipo de cortina o persiana, medidas aproximadas y si querés control remoto o integración extra.',
          ),
        ],
      ),
    ],
  },
  {
    id: 'metallic-curtains-detail',
    pagePath: 'productos/cortinas-metalicas.html',
    pagePatch: {
      title: 'Cortinas metálicas de seguridad',
      summary: 'Cortinas metálicas para seguridad, uso intensivo y cierre de frentes comerciales.',
      seoTitle: 'Cortinas Metálicas de seguridad | Urucortinas',
      seoDescription:
        'Cortinas metálicas manuales o motorizadas para comercios, industrias y frentes que necesitan seguridad y cierre robusto.',
      legacySource: '/productos/cortinas-metalicas.html',
    },
    sections: [
      editorialSplitSection(
        'metallic-editorial',
        'Guía comercial de seguridad',
        'Elegí seguridad según uso, tamaño y frecuencia de apertura',
        'Las cortinas metálicas resuelven cierres exigentes donde la protección y la resistencia pesan más que la estética.',
        '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_1.jpg',
        'Cortinas metálicas de seguridad',
        [
          { label: 'Pedir asesoramiento', href: '/contacto.html' },
          { label: 'Ver motorización', href: '/productos/motores-cortinas-y-persianas.html' },
        ],
        [
          rtParagraph([
            rtStrong('Manual o motorizada'),
            rtText(' según el tamaño del frente y la frecuencia de uso que tenga el local o la industria.'),
          ]),
          rtParagraph(
            'Cuando el cierre se usa seguido, la motorización mejora la comodidad y reduce el esfuerzo operativo.',
          ),
          rtParagraph(
            'Si el frente exige más resguardo, la cortina metálica aporta un cierre robusto y pensado para uso intensivo.',
          ),
          rtList([
            [rtText('Seguridad en comercios e industrias.')],
            [rtText('Posibilidad de automatización.')],
            [rtText('Solución robusta para cierres exigentes.')],
          ]),
        ],
        [
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_1.jpg',
            imageAlt: 'Cortina metálica manual',
            href: '/contacto.html',
            linkLabel: 'Pedir asesoramiento',
          },
          {
            imageUrl: '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_2.jpg',
            imageAlt: 'Cortina metálica motorizada',
            href: '/productos/motores-cortinas-y-persianas.html',
            linkLabel: 'Ver motorización',
          },
        ],
      ),
      featureGridSection(
        'metallic-features',
        'Cómo se usan',
        'Elegí cortinas metálicas según la exigencia del frente',
        'Manual o motorizada, para uso comercial o industrial según necesidad.',
        [
          featureCard(
            'Manual',
            'Manual',
            'Una opción simple cuando el frente no necesita automatización.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_1.jpg',
            'Cortina metálica manual',
            'Base',
          ),
          featureCard(
            'Motorizada',
            'Motorizada',
            'Mejora la comodidad de uso en frentes más grandes o de uso frecuente.',
            '/productos/motores-cortinas-y-persianas.html',
            '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_2.jpg',
            'Cortina metálica motorizada',
            'Automatización',
          ),
          featureCard(
            'Seguridad',
            'Cierre robusto',
            'Pensada para comercios e industrias que priorizan seguridad y resistencia.',
            '/contacto.html',
            '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_4.jpg',
            'Cortina metálica seguridad',
            'Seguridad',
          ),
        ],
      ),
      faqSection(
        'metallic-faq',
        'Preguntas frecuentes',
        'Cortinas metálicas: preguntas útiles',
        'Respuestas cortas para avanzar con una cotización correcta.',
        [
          faqItem(
            'metallic-faq-1',
            '¿Son para comercio o industria?',
            'Sirven para ambos escenarios cuando el frente requiere un cierre robusto.',
          ),
          faqItem(
            'metallic-faq-2',
            '¿Se pueden motorizar?',
            'Sí, según el tamaño y el tipo de uso del frente.',
          ),
          faqItem(
            'metallic-faq-3',
            '¿Qué datos ayudan a cotizar?',
            'Ancho, alto, tipo de frente y si querés versión manual o motorizada.',
          ),
        ],
      ),
    ],
  },
]

export const CMS_PAGE_ENHANCER_BY_ID = Object.fromEntries(
  CMS_PAGE_ENHANCERS.map((enhancer) => [enhancer.id, enhancer] as const),
)
