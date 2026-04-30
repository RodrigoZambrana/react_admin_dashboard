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

const categoriesPage: CmsPageSeed = {
  path: 'categories',
  title: 'Categorías con intención',
  summary: 'Una landing visual para entrar por inspiración, uso y estilo antes de ver el catálogo.',
  seoTitle: 'Categorías con intención | Descubrí productos y estilos',
  seoDescription: 'Explorá categorías, usos y colecciones con una experiencia visual pensada para conversión.',
  seoImageUrl: '/assets/images/banners/category-3.png',
  sections: [
    {
      type: CmsPageSectionType.MEDIA_HERO,
      key: 'categories-hero',
      settings: {
        mediaType: 'image',
        overlay: true,
        overlayOpacity: 0.66,
        title: 'Descubrí la categoría correcta más rápido',
        subtitle:
          'Una entrada visual para reducir fricción, ordenar la oferta y llevar al usuario hacia la compra.',
        eyebrow: 'Catálogo visual',
        mediaAlt: 'Categorías y colecciones',
        primaryCta: { label: 'Explorar catálogo', href: '/shop' },
        secondaryCta: { label: 'Ver destacados', href: '/product/qa-var-003' },
      },
      blocks: [
        {
          type: CmsPageBlockType.IMAGE,
          name: 'Hero image',
          media: {
            url: '/assets/images/banners/category-3.png',
            alt: 'Hero de categorías',
            title: 'Hero de categorías',
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
        title: 'Accesos rápidos por intención',
        description: 'Bloques de navegación para entrar por uso, estilo o necesidad concreta.',
      },
      blocks: [
        {
          type: CmsPageBlockType.CARD,
          name: 'Electrónica',
          content: {
            title: 'Electrónica que resuelve rápido',
            description: 'Compará, elegí y avanzá con productos de alto impacto visual.',
            badge: 'Top search',
            linkLabel: 'Ver electrónica',
            href: '/product/qa-var-003',
          },
          media: {
            url: '/assets/images/products/bghead-phone.png',
            alt: 'Electrónica',
            title: 'Electrónica',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Accesorios',
          content: {
            title: 'Accesorios con detalle',
            description: 'Pequeños productos, gran peso en la percepción de marca.',
            badge: 'New',
            linkLabel: 'Ver accesorios',
            href: '/product/ventana-corrediza-20-blanco-3mm-1200x2000',
          },
          media: {
            url: '/assets/images/products/ring-1.png',
            alt: 'Accesorios',
            title: 'Accesorios',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Moda',
          content: {
            title: 'Moda y outfits listos',
            description: 'Sección pensada para convertir por combinación visual.',
            badge: 'Curated',
            linkLabel: 'Ver moda',
            href: '/product/ventana-corrediza-20-blanco-3mm-1400x600',
          },
          media: {
            url: '/assets/images/products/clothes.png',
            alt: 'Moda',
            title: 'Moda',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Lifestyle',
          content: {
            title: 'Lifestyle que inspira',
            description: 'Colecciones que funcionan como editorial y como catálogo.',
            badge: 'Story',
            linkLabel: 'Ver lifestyle',
            href: '/product/ventana-corrediza-20-blanco-3mm-1500x1500',
          },
          media: {
            url: '/assets/images/banners/banner-14.jpg',
            alt: 'Lifestyle',
            title: 'Lifestyle',
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
        description: 'Un bloque corto para despejar dudas y aumentar confianza.',
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
            title: 'Bloque de tendencia',
            description: 'Composición pensada para escaneo rápido en mobile.',
            badge: 'Trend',
            overlayText: true,
            linkLabel: 'Explorar',
            href: '/product/ventana-corrediza-20-blanco-3mm-1200x2000',
          },
          media: {
            url: '/assets/images/banners/banner-21.jpg',
            alt: 'Colección tendencia',
            title: 'Colección tendencia',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Colección 2',
          content: {
            title: 'Punto de decisión',
            description: 'Destacá valor visual sin meter una ficha larga.',
            badge: 'Focus',
            overlayText: true,
            linkLabel: 'Ver más',
            href: '/product/qa-var-003',
          },
          media: {
            url: '/assets/images/banners/banner-17.jpg',
            alt: 'Punto de decisión',
            title: 'Punto de decisión',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Colección 3',
          content: {
            title: 'Uso cotidiano',
            description: 'Contexto real para reducir la percepción de riesgo.',
            badge: 'Use case',
            overlayText: true,
            linkLabel: 'Descubrir',
            href: '/product/ventana-corrediza-20-blanco-3mm-1400x600',
          },
          media: {
            url: '/assets/images/banners/banner-16.jpg',
            alt: 'Uso cotidiano',
            title: 'Uso cotidiano',
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
      type: CmsPageSectionType.MEDIA_HERO,
      key: 'home-hero',
      settings: {
        mediaType: 'image',
        overlay: true,
        overlayOpacity: 0.58,
        title: 'Soluciones a medida para hogar, comercio y obra',
        subtitle:
          'Cortinas roller, persianas de enrollar, toldos y aberturas en aluminio con instalación, mantenimiento y reparación.',
        eyebrow: 'Urucortinas',
        mediaAlt: 'Urucortinas soluciones a medida',
        primaryCta: { label: 'Ver tienda', href: '/shop' },
        secondaryCta: {
          label: 'Cortinas de enrollar',
          href: '/productos/cortinas-de-enrollar.html',
        },
      },
      blocks: [
        {
          type: CmsPageBlockType.IMAGE,
          name: 'Hero main media',
          media: {
            url: '/uploads/cms/legacy-assets/img/intro-carousel/roller-6.jpeg',
            alt: 'Urucortinas soluciones a medida',
            title: 'Urucortinas soluciones a medida',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.MEDIA_CAROUSEL,
      key: 'home-products-carousel',
      settings: {
        title: 'Familias principales',
        description: 'Elegí por uso real: interior, exterior, obra, recambio o automatización.',
        variant: 'cards',
        slidesToShow: 4,
        autoplay: false,
        autoplaySpeed: 3200,
        spaceBetween: 16,
      },
      blocks: [
        {
          type: CmsPageBlockType.CARD,
          name: 'Cortinas Roller',
          content: {
            title: 'Cortinas Roller',
            description:
              'Una solución interior limpia y práctica para regular luz y privacidad en hogar u oficina.',
            badge: 'Interior',
            linkLabel: 'Ver línea',
            href: '/productos/cortinas-roller.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/portfolio/roller/rollers.png',
            alt: 'Cortinas Roller',
            title: 'Cortinas Roller',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Cortinas de enrollar',
          content: {
            title: 'Cortinas de enrollar',
            description:
              'Opciones en PVC o aluminio para frentes, ventanas y accesos con manual o motorización.',
            badge: 'Exterior',
            linkLabel: 'Ver línea',
            href: '/productos/cortinas-de-enrollar.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
            alt: 'Cortinas de enrollar',
            title: 'Cortinas de enrollar',
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
              'Control de luz y presencia para aberturas amplias, oficinas y livings.',
            badge: 'Amplios vidriados',
            linkLabel: 'Ver línea',
            href: '/productos/bandas-verticales.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_verticales_3.jpeg',
            alt: 'Bandas verticales',
            title: 'Bandas verticales',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Venecianas',
          content: {
            title: 'Venecianas',
            description:
              'Lamas de 16 mm y 25 mm para controlar la luz con terminación prolija y simple mantenimiento.',
            badge: 'Control de luz',
            linkLabel: 'Ver línea',
            href: '/productos/venecianas.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_4.jpeg',
            alt: 'Venecianas',
            title: 'Venecianas',
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
              'Puertas, ventanas y monoblocks para obra nueva o reemplazo con vidrio simple o DVH.',
            badge: 'Obra y recambio',
            linkLabel: 'Ver línea',
            href: '/productos/aberturas-aluminio.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/aberturas/images.jpg',
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
            description:
              'Soluciones para sombra, protección y uso exterior en viviendas, comercios y terrazas.',
            badge: 'Exterior',
            linkLabel: 'Ver línea',
            href: '/productos/toldos-y-cerramientos.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo.jpg',
            alt: 'Toldos y cerramientos',
            title: 'Toldos y cerramientos',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.MEDIA_GRID_ENHANCED,
      key: 'home-products-grid',
      settings: {
        title: 'Nuestra gama de productos',
        description:
          'Soluciones en cortinas, toldos y aberturas diseñadas para ofrecer estilo, funcionalidad y protección solar.',
        columns: 4,
        gap: 1.1,
        aspectRatio: '4 / 5',
      },
      blocks: [
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
            url: '/uploads/cms/legacy-assets/img/portfolio/roller/rollers.png',
            alt: 'Cortinas Roller',
            title: 'Cortinas Roller',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
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
            url: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
            alt: 'Cortinas de enrollar',
            title: 'Cortinas de enrollar',
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
            url: '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_verticales_3.jpeg',
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
            url: '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_4.jpeg',
            alt: 'Cortinas Venecianas',
            title: 'Cortinas Venecianas',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Aberturas',
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
            url: '/uploads/cms/legacy-assets/img/aberturas/images.jpg',
            alt: 'Aberturas en aluminio',
            title: 'Aberturas en aluminio',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Toldos',
          content: {
            title: 'Toldos y cerramientos',
            description:
              'Toldos verticales, de brazo y cerramientos en PVC para protección solar y exterior.',
            badge: 'Exterior',
            overlayText: true,
            linkLabel: 'Ver toldos',
            href: '/productos/toldos-y-cerramientos.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo.jpg',
            alt: 'Toldos y cerramientos',
            title: 'Toldos y cerramientos',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Motores',
          content: {
            title: 'Motores y automatismos',
            description:
              'Automatización para cortinas roller, persianas y cortinas metálicas con mayor confort diario.',
            badge: 'Automatización',
            overlayText: true,
            linkLabel: 'Ver motores',
            href: '/productos/motores-cortinas-y-persianas.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
            alt: 'Motores y automatismos',
            title: 'Motores y automatismos',
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
            url: '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_1.jpg',
            alt: 'Cortinas metálicas',
            title: 'Cortinas metálicas',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
      ],
    },
    {
      type: CmsPageSectionType.MEDIA_GRID_ENHANCED,
      key: 'home-solution-clusters',
      settings: {
        title: 'Elegí por necesidad',
        description:
          'Entradas directas para quienes ya saben qué problema quieren resolver.',
        columns: 4,
        gap: 1.05,
        aspectRatio: '4 / 5',
      },
      blocks: [
        {
          type: CmsPageBlockType.CARD,
          name: 'Interior y control de luz',
          content: {
            title: 'Interior y control de luz',
            description:
              'Cortinas roller y venecianas para regular luz, privacidad y terminación en hogar u oficina.',
            badge: 'Interior',
            overlayText: true,
            linkLabel: 'Ver líneas',
            href: '/productos/cortinas-roller.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/portfolio/roller/rollers.png',
            alt: 'Interior y control de luz',
            title: 'Interior y control de luz',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Exterior y seguridad',
          content: {
            title: 'Exterior y seguridad',
            description:
              'Cortinas de enrollar y cortinas metálicas para frentes, accesos y mayor protección.',
            badge: 'Exterior',
            overlayText: true,
            linkLabel: 'Ver líneas',
            href: '/productos/cortinas-de-enrollar.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
            alt: 'Exterior y seguridad',
            title: 'Exterior y seguridad',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Obra y recambio',
          content: {
            title: 'Obra y recambio',
            description:
              'Aberturas en aluminio y toldos para renovar, ampliar o resolver una instalación nueva.',
            badge: 'Obra',
            overlayText: true,
            linkLabel: 'Ver líneas',
            href: '/productos/aberturas-aluminio.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/aberturas/images.jpg',
            alt: 'Obra y recambio',
            title: 'Obra y recambio',
            type: CmsMediaType.IMAGE,
            source: 'marketing_cms_seed',
          },
        },
        {
          type: CmsPageBlockType.CARD,
          name: 'Automatización y confort',
          content: {
            title: 'Automatización y confort',
            description:
              'Motores y automatismos para sumar comodidad, control y uso diario más simple.',
            badge: 'Automatización',
            overlayText: true,
            linkLabel: 'Ver motores',
            href: '/productos/motores-cortinas-y-persianas.html',
          },
          media: {
            url: '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
            alt: 'Automatización y confort',
            title: 'Automatización y confort',
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
            url: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/1.jpeg',
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
            title: 'Garantía según línea',
            description:
              'En varias líneas de aluminio y roller trabajamos con 2 años; en distintas opciones de PVC, la referencia habitual es 1 año.',
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

const marketingPages = [homePage, categoriesPage, ...productPageTemplates.map(buildProductPage)]

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

  for (const page of marketingPages) {
    await upsertPage(prisma, page)
  }

  console.log(`[seed] Marketing CMS pages seeded: ${marketingPages.length} pages`)
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
