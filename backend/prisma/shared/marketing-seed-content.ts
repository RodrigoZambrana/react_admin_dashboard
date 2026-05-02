import {
  CmsEntryAssetType,
  CmsMediaType,
  CmsPageBlockType,
  CmsPageSectionType,
  Prisma,
  PrismaClient,
} from '@prisma/client'

export type MarketingStoryAssetSeed = {
  title: string
  caption: string
  mediaType: CmsEntryAssetType
  mediaUrl: string
  posterUrl: string
  sortOrder: number
}

export type MarketingStorySeed = {
  slug: string
  title: string
  subtitle: string
  description: string
  priority: number
  ctaLabel: string
  ctaUrl: string
  thumbnailUrl: string
  assets: MarketingStoryAssetSeed[]
}

export const MARKETING_HOME_STORY_SEEDS: MarketingStorySeed[] = [
  {
    slug: 'home-story-cortinas-de-enrollar',
    title: 'Cortinas de enrollar',
    subtitle: 'Obra nueva o recambio',
    description:
      'Persianas en PVC o aluminio con opción manual o motorizada según uso, exposición y mantenimiento.',
    priority: 80,
    ctaLabel: 'Ver cortinas de enrollar',
    ctaUrl: '/productos/cortinas-de-enrollar.html',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
    assets: [
      {
        title: 'Cortinas de enrollar',
        caption: 'Una solución práctica para frentes, hogares y comercios.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
        posterUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
        sortOrder: 0,
      },
    ],
  },
  {
    slug: 'home-story-aberturas-aluminio',
    title: 'Aberturas en aluminio',
    subtitle: 'Puertas, ventanas y DVH',
    description:
      'Una familia para obra y recambio con opciones de vidrio simple o doble vidriado hermético.',
    priority: 70,
    ctaLabel: 'Ver aberturas',
    ctaUrl: '/productos/aberturas-aluminio.html',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/aberturas/images.jpg',
    assets: [
      {
        title: 'Aberturas en aluminio',
        caption: 'Soluciones de alto uso para hogares, comercios y proyectos a medida.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/aberturas/images.jpg',
        posterUrl: '/uploads/cms/legacy-assets/img/aberturas/images.jpg',
        sortOrder: 0,
      },
    ],
  },
  {
    slug: 'home-story-toldos-cerramientos',
    title: 'Toldos y cerramientos',
    subtitle: 'Protección solar exterior',
    description:
      'Toldos verticales, de brazo y cerramientos en PVC para sumar sombra, confort y uso exterior.',
    priority: 60,
    ctaLabel: 'Ver toldos',
    ctaUrl: '/productos/toldos-y-cerramientos.html',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo.jpg',
    assets: [
      {
        title: 'Toldos y cerramientos',
        caption: 'Protección solar y solución exterior para distintos usos.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo.jpg',
        posterUrl: '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo.jpg',
        sortOrder: 0,
      },
    ],
  },
  {
    slug: 'home-story-motores',
    title: 'Motores y automatismos',
    subtitle: 'Comodidad y uso diario',
    description:
      'Automatización para cortinas roller, persianas y cortinas metálicas con mayor confort diario.',
    priority: 50,
    ctaLabel: 'Ver motores',
    ctaUrl: '/productos/motores-cortinas-y-persianas.html',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
    assets: [
      {
        title: 'Motores y automatismos',
        caption: 'Automatización inteligente para más confort y uso diario.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
        posterUrl: '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
        sortOrder: 0,
      },
    ],
  },
  {
    slug: 'home-story-cortinas-roller',
    title: 'Cortinas Roller',
    subtitle: 'Interior moderno y funcional',
    description:
      'Solución interior para regular luz y privacidad con una estética limpia en hogar u oficina.',
    priority: 40,
    ctaLabel: 'Ver cortinas roller',
    ctaUrl: '/productos/cortinas-roller.html',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/roller/rollers.png',
    assets: [
      {
        title: 'Cortinas Roller',
        caption: 'Soluciones para ambientes que necesitan control de luz y un acabado limpio.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/roller/rollers.png',
        posterUrl: '/uploads/cms/legacy-assets/img/portfolio/roller/rollers.png',
        sortOrder: 0,
      },
    ],
  },
  {
    slug: 'home-story-bandas-verticales',
    title: 'Bandas verticales',
    subtitle: 'Ventanales amplios',
    description:
      'Versatilidad y elegancia para oficinas, living y ventanales amplios con control de luz.',
    priority: 30,
    ctaLabel: 'Ver bandas verticales',
    ctaUrl: '/productos/bandas-verticales.html',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_verticales_3.jpeg',
    assets: [
      {
        title: 'Bandas verticales',
        caption: 'Ideales para ventanales amplios, oficinas y living.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_verticales_3.jpeg',
        posterUrl: '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_verticales_3.jpeg',
        sortOrder: 0,
      },
    ],
  },
  {
    slug: 'home-story-venecianas',
    title: 'Cortinas Venecianas',
    subtitle: 'Lamas 16 mm y 25 mm',
    description:
      'Control de luz y privacidad con una terminación limpia para dormitorios, oficinas y espacios de uso diario.',
    priority: 20,
    ctaLabel: 'Ver venecianas',
    ctaUrl: '/productos/venecianas.html',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_4.jpeg',
    assets: [
      {
        title: 'Cortinas Venecianas',
        caption: 'Lamas de 16 mm y 25 mm para controlar luz y privacidad.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_4.jpeg',
        posterUrl: '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_4.jpeg',
        sortOrder: 0,
      },
    ],
  },
  {
    slug: 'home-story-cortinas-metalicas',
    title: 'Cortinas metálicas',
    subtitle: 'Seguridad para accesos',
    description: 'Máxima seguridad para locales y accesos con una línea pensada para uso intensivo.',
    priority: 10,
    ctaLabel: 'Ver cortinas metálicas',
    ctaUrl: '/productos/cortinas-metalicas.html',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_1.jpg',
    assets: [
      {
        title: 'Cortinas metálicas',
        caption: 'Máxima seguridad para locales y accesos.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_1.jpg',
        posterUrl: '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_1.jpg',
        sortOrder: 0,
      },
    ],
  },
]

export const MARKETING_HOME_HIGHLIGHT_SEEDS: MarketingStorySeed[] = [
  {
    slug: 'home-highlight-compra-segura',
    title: 'Visita y toma de medidas',
    subtitle: 'Acompañamiento comercial real',
    description:
      'Podemos coordinar una visita a domicilio para tomar medidas y orientar tu compra. En Montevideo la visita es sin costo.',
    priority: 40,
    ctaLabel: 'Solicitar visita',
    ctaUrl: '/contact',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/reparacion-persiana.jpeg',
    assets: [
      {
        title: 'Visita y toma de medidas',
        caption:
          'Coordinamos la visita a domicilio para tomar medidas y revisar el producto adecuado antes de avanzar.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/reparacion-persiana.jpeg',
        posterUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/reparacion-persiana.jpeg',
        sortOrder: 0,
      },
    ],
  },
  {
    slug: 'home-highlight-entrega-coordinada',
    title: 'Pagos y financiación',
    subtitle: 'Medios de pago vigentes',
    description:
      'Aceptamos transferencia, efectivo, Mercado Pago y tarjetas. Con Mercado Pago se puede pagar en cuotas, y las cortinas de enrollar cuentan con garantía de 2 años.',
    priority: 30,
    ctaLabel: 'Ver formas de pago',
    ctaUrl: '/contacto.html',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/mercadopago-img.jpg',
    assets: [
      {
        title: 'Pagos y garantía',
        caption:
          'Formas de pago flexibles y garantía clara para cortinas de enrollar y soluciones afines.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/mercadopago-img.jpg',
        posterUrl: '/uploads/cms/legacy-assets/img/mercadopago-img.jpg',
        sortOrder: 0,
      },
    ],
  },
  {
    slug: 'home-highlight-reparacion',
    title: 'Reparación y mantenimiento',
    subtitle: 'Resolver antes de reemplazar',
    description:
      'Si el sistema todavía tiene arreglo, te orientamos sobre la reparación más conveniente.',
    priority: 20,
    ctaLabel: 'Solicitar reparación',
    ctaUrl: '/servicios/reparacion-cortinas-y-persianas.html',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/reparacion-persiana.jpeg',
    assets: [
      {
        title: 'Reparación y mantenimiento',
        caption:
          'Recuperá la operatividad con una intervención clara y enfocada en el uso diario.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/reparacion-persiana.jpeg',
        posterUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/reparacion-persiana.jpeg',
        sortOrder: 0,
      },
    ],
  },
  {
    slug: 'home-highlight-trabajos-medida',
    title: 'Trabajos a medida',
    subtitle: 'Soluciones según el espacio',
    description:
      'Fabricamos y adaptamos la solución al espacio real, al tipo de abertura y al uso diario.',
    priority: 10,
    ctaLabel: 'Pedir presupuesto',
    ctaUrl: '/contacto.html',
    thumbnailUrl: '/uploads/cms/legacy-assets/img/intro-carousel/cerramiento-pvc.jpeg',
    assets: [
      {
        title: 'Trabajos a medida',
        caption: 'La solución se adapta al espacio real y al uso diario.',
        mediaType: CmsEntryAssetType.IMAGE,
        mediaUrl: '/uploads/cms/legacy-assets/img/intro-carousel/cerramiento-pvc.jpeg',
        posterUrl: '/uploads/cms/legacy-assets/img/intro-carousel/cerramiento-pvc.jpeg',
        sortOrder: 0,
      },
    ],
  },
]

export const buildMarketingStoryCmsPage = (story: MarketingStorySeed) => ({
  path: `stories/${story.slug}`,
  title: story.title,
  summary: story.subtitle,
  seoTitle: `${story.title} | Historias`,
  seoDescription: story.description,
  seoImageUrl: story.thumbnailUrl,
  sections: [
    {
      type: CmsPageSectionType.STORIES_CAROUSEL,
      key: 'story-items',
      name: story.title,
      settings: {
        autoplay: true,
        showProgressBar: true,
        interval: 5000,
      },
      blocks: story.assets.map((asset, index) => ({
        type: CmsPageBlockType.IMAGE,
        key: `${index}`,
        name: `${story.title} ${index + 1}`,
        content: {
          title: story.title,
          caption: asset.caption,
          description: story.description,
          mediaPublicId: asset.mediaUrl,
          mediaUrl: asset.mediaUrl,
          mediaType: asset.mediaType === CmsEntryAssetType.VIDEO ? 'video' : 'image',
          durationSec: undefined,
          ctaLabel: story.ctaLabel,
          ctaUrl: story.ctaUrl,
          alt: story.title,
        },
        media: {
          url: asset.mediaUrl,
          type: asset.mediaType === CmsEntryAssetType.VIDEO ? CmsMediaType.VIDEO : CmsMediaType.IMAGE,
          alt: story.title,
          title: asset.title,
          source: 'marketing_cms_seed',
        },
      })),
    },
  ],
})

export async function replaceCmsEntryAssets(
  prisma: PrismaClient,
  entryId: number,
  assets: MarketingStoryAssetSeed[],
) {
  await prisma.cmsEntryAsset.deleteMany({ where: { entryId } })

  for (const asset of assets) {
    const mediaType = asset.mediaType === CmsEntryAssetType.VIDEO ? 'VIDEO' : 'IMAGE'
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "CmsEntryAsset"
          ("entryId", "title", "caption", "mediaType", "mediaUrl", "posterUrl", "externalUrl", "durationSec", "sortOrder", "isActive", "createdAt", "updatedAt")
        VALUES
          (
            ${entryId},
            ${asset.title ?? null},
            ${asset.caption ?? null},
            CAST(${mediaType} AS "CmsEntryAssetType"),
            ${asset.mediaUrl},
            ${asset.posterUrl ?? null},
            ${null},
            ${null},
            ${asset.sortOrder},
            ${true},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
      `,
    )
  }
}
