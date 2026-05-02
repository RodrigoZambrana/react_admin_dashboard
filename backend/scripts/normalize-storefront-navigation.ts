import { PrismaClient, CmsEntryStatus } from '@prisma/client'

type NavLink = { label: string; href: string }
type NavNode = NavLink & { items?: NavNode[] }

const prisma = new PrismaClient()

const normalizeHref = (path: string) => (path.startsWith('/') ? path : `/${path}`)

const buildLeaf = (titleByPath: Map<string, string>, path: string): NavLink => ({
  label: titleByPath.get(path) ?? path,
  href: normalizeHref(path),
})

const buildNode = (
  label: string,
  items: NavNode[] = [],
): NavNode => ({
  label,
  href: '#',
  items,
})

const MENU_PATHS = {
  products: [
    'productos/cortinas-roller.html',
    'productos/cortinas-de-enrollar.html',
    'productos/cortinas-de-enrollar-pvc.html',
    'productos/cortinas-de-enrollar-aluminio.html',
    'productos/aberturas-aluminio.html',
    'productos/toldos-y-cerramientos.html',
    'productos/motores-cortinas-y-persianas.html',
    'productos/cortinas-metalicas.html',
    'productos/venecianas.html',
    'productos/bandas-verticales.html',
    'productos/cortinas-tradicionales.html',
    'productos/persianas',
  ],
  services: [
    'servicios/reparacion-cortinas-y-persianas.html',
    'servicios/reparacion-urgente',
    'servicios/instalacion-aberturas.html',
  ],
  guides: [
    'articulos/dvh.html',
    'guias/cortinas-pvc-vs-aluminio',
    'guias/aberturas-probba',
    'guias/aberturas-gala',
    'guias/aberturas-summa',
    'precios/cortinas-de-enrollar',
  ],
  information: ['quienes-somos', 'preguntas-frecuentes', 'contacto.html'],
} as const

const PAGE_UPDATES = [
  {
    path: 'productos/aberturas-aluminio.html',
    title: 'Aberturas de aluminio',
    seoTitle: 'Aberturas de Aluminio Alta Prestación | Probba, Gala y Summa - Urucortinas',
    summary: 'Soluciones en aluminio a medida con DVH y perfilería de alta prestación.',
  },
  {
    path: 'productos/toldos-y-cerramientos.html',
    title: 'Toldos y cerramientos',
    seoTitle: 'Toldos y Cerramientos en PVC | Protección y Estilo - Urucortinas',
    summary: 'Protección solar y cerramientos a medida para exteriores.',
  },
  {
    path: 'productos/motores-cortinas-y-persianas.html',
    title: 'Motores para cortinas y persianas',
    seoTitle: 'Motores para Cortinas y Persianas | Automatización y Confort - Urucortinas',
    summary: 'Automatización de cortinas y persianas con control y confort.',
  },
  {
    path: 'productos/cortinas-metalicas.html',
    title: 'Cortinas metálicas',
    seoTitle: 'Cortinas Metálicas | Seguridad para comercios y hogares - Urucortinas',
    summary: 'Seguridad a medida para hogares y comercios.',
  },
  {
    path: 'productos/cortinas-tradicionales.html',
    title: 'Cortinas tradicionales',
    seoTitle: 'Cortinas Tradicionales con Riel | Elegancia y Estilo - Urucortinas',
    summary: 'Solución clásica a medida para hogares y oficinas.',
  },
  {
    path: 'servicios/instalacion-aberturas.html',
    title: 'Instalación de aberturas',
    seoTitle: 'Instalación de Aberturas en Aluminio | Urucortinas',
    summary: 'Instalación profesional de aberturas y DVH.',
  },
  {
    path: 'contacto.html',
    title: 'Contacto',
    seoTitle: 'Contacto | Urucortinas - Solicita tu presupuesto',
    summary: 'Canal directo para consultas y presupuesto.',
  },
  {
    path: 'articulos/dvh.html',
    title: 'DVH',
    seoTitle: '¿Qué es el Doble Vidriado Hermético (DVH)? - Urucortinas',
    summary: 'Qué es el DVH, cuándo conviene y cómo mejora el aislamiento.',
  },
] as const

async function main() {
  const pagePaths = Array.from(
    new Set([
      ...MENU_PATHS.products,
      ...MENU_PATHS.services,
      ...MENU_PATHS.guides,
      ...MENU_PATHS.information,
      ...PAGE_UPDATES.map((entry) => entry.path),
    ]),
  )

  await prisma.$transaction(async (tx) => {
    for (const entry of PAGE_UPDATES) {
      const page = await tx.cmsPage.findFirst({
        where: {
          path: entry.path,
        },
        select: {
          id: true,
          title: true,
        },
      })

      if (!page) {
        continue
      }

      await tx.cmsPage.update({
        where: { id: page.id },
        data: {
          title: entry.title,
          seoTitle: entry.seoTitle,
          summary: entry.summary,
        },
      })
    }
  })

  const refreshedPages = await prisma.cmsPage.findMany({
    where: {
      path: { in: pagePaths },
    },
    select: {
      path: true,
      title: true,
    },
  })

  const titleByPath = new Map(refreshedPages.map((page) => [page.path, page.title]))

  const headerItems: NavNode[] = [
    { label: 'Inicio', href: '/' },
    buildNode('Productos', [
      buildNode('Cortinas', [
        buildLeaf(titleByPath, 'productos/cortinas-roller.html') as NavNode,
        buildLeaf(titleByPath, 'productos/bandas-verticales.html') as NavNode,
        buildLeaf(titleByPath, 'productos/cortinas-tradicionales.html') as NavNode,
        buildLeaf(titleByPath, 'productos/venecianas.html') as NavNode,
      ]),
      buildNode('Persianas', [
        buildLeaf(titleByPath, 'productos/persianas') as NavNode,
        buildLeaf(titleByPath, 'productos/cortinas-de-enrollar.html') as NavNode,
        buildLeaf(titleByPath, 'productos/cortinas-de-enrollar-pvc.html') as NavNode,
        buildLeaf(titleByPath, 'productos/cortinas-de-enrollar-aluminio.html') as NavNode,
      ]),
      buildNode('Aberturas', [
        buildLeaf(titleByPath, 'productos/aberturas-aluminio.html') as NavNode,
      ]),
      buildNode('Toldos', [
        buildLeaf(titleByPath, 'productos/toldos-y-cerramientos.html') as NavNode,
      ]),
      buildNode('Motores', [
        buildLeaf(titleByPath, 'productos/motores-cortinas-y-persianas.html') as NavNode,
      ]),
      buildNode('Seguridad', [
        buildLeaf(titleByPath, 'productos/cortinas-metalicas.html') as NavNode,
      ]),
    ]),
    buildNode('Servicios', [
      buildNode('Reparación', [
        buildLeaf(titleByPath, 'servicios/reparacion-cortinas-y-persianas.html') as NavNode,
        buildLeaf(titleByPath, 'servicios/reparacion-urgente') as NavNode,
      ]),
      buildNode('Instalación', [
        buildLeaf(titleByPath, 'servicios/instalacion-aberturas.html') as NavNode,
      ]),
    ]),
    buildNode('Guías', [
      buildNode('Comparativas', [
        buildLeaf(titleByPath, 'articulos/dvh.html') as NavNode,
        buildLeaf(titleByPath, 'guias/cortinas-pvc-vs-aluminio') as NavNode,
      ]),
      buildNode('Series de aberturas', [
        buildLeaf(titleByPath, 'guias/aberturas-probba') as NavNode,
        buildLeaf(titleByPath, 'guias/aberturas-gala') as NavNode,
        buildLeaf(titleByPath, 'guias/aberturas-summa') as NavNode,
      ]),
      buildNode('Precios', [
        buildLeaf(titleByPath, 'precios/cortinas-de-enrollar') as NavNode,
      ]),
    ]),
    buildNode('Información', [
      buildLeaf(titleByPath, 'quienes-somos') as NavNode,
      buildLeaf(titleByPath, 'preguntas-frecuentes') as NavNode,
    ]),
    buildLeaf(titleByPath, 'contacto.html') as NavNode,
  ]

  const footerGroups: NavNode[][] = [
    [
      buildLeaf(titleByPath, 'quienes-somos') as NavNode,
      buildLeaf(titleByPath, 'preguntas-frecuentes') as NavNode,
      buildLeaf(titleByPath, 'contacto.html') as NavNode,
    ],
    [
      buildLeaf(titleByPath, 'productos/cortinas-roller.html') as NavNode,
      buildLeaf(titleByPath, 'productos/cortinas-de-enrollar.html') as NavNode,
      buildLeaf(titleByPath, 'productos/aberturas-aluminio.html') as NavNode,
      buildLeaf(titleByPath, 'productos/toldos-y-cerramientos.html') as NavNode,
    ],
    [
      buildLeaf(titleByPath, 'servicios/reparacion-cortinas-y-persianas.html') as NavNode,
      buildLeaf(titleByPath, 'servicios/reparacion-urgente') as NavNode,
      buildLeaf(titleByPath, 'servicios/instalacion-aberturas.html') as NavNode,
    ],
    [
      buildLeaf(titleByPath, 'articulos/dvh.html') as NavNode,
      buildLeaf(titleByPath, 'guias/cortinas-pvc-vs-aluminio') as NavNode,
      buildLeaf(titleByPath, 'precios/cortinas-de-enrollar') as NavNode,
    ],
  ]

  const rootPage = await prisma.cmsPage.findUnique({
    where: { path: '' },
    include: {
      sections: true,
    },
  })

  if (!rootPage) {
    throw new Error('Root storefront CMS page was not found')
  }

  const headerSection = rootPage.sections.find((section) => section.type === 'SITE_HEADER')
  const footerSection = rootPage.sections.find((section) => section.type === 'SITE_FOOTER')

  if (!headerSection) {
    throw new Error('Root storefront CMS header section was not found')
  }
  if (!footerSection) {
    throw new Error('Root storefront CMS footer section was not found')
  }

  const headerSettings = {
    ...(typeof headerSection.settings === 'object' && headerSection.settings !== null
      ? (headerSection.settings as Record<string, unknown>)
      : {}),
    brandLabel: 'urucortinas',
    navigationMode: 'flat',
    items: headerItems,
  }

  const footerSettings = {
    ...(typeof footerSection.settings === 'object' && footerSection.settings !== null
      ? (footerSection.settings as Record<string, unknown>)
      : {}),
    linkGroups: footerGroups,
  }

  await prisma.$transaction(async (tx) => {
    await tx.cmsPageSection.update({
      where: { id: headerSection.id },
      data: {
        settings: headerSettings,
      },
    })

    await tx.cmsPageSection.update({
      where: { id: footerSection.id },
      data: {
        settings: footerSettings,
      },
    })
  })

  console.log('Storefront navigation normalized from CMS content.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
