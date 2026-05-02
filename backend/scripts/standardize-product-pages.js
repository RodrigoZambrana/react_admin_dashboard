const fs = require('fs/promises');
const path = require('path');
const {
  PrismaClient,
  CmsMediaType,
  CmsPageBlockType,
  CmsPageSectionType,
} = require('@prisma/client');

const prisma = new PrismaClient();

const MEDIA_ROOT = path.resolve(__dirname, '..', 'media');
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');

const TARGET_PAGES = [
  {
    path: 'productos/cortinas-roller.html',
    gallery: [
      '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_4.jpeg',
      '/uploads/cms/legacy-assets/img/portfolio/roller/rollers.png',
      '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg',
      '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_2.jpeg',
    ],
  },
  {
    path: 'productos/cortinas-de-enrollar.html',
    gallery: [
      '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_1.jpeg',
      '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_2.jpeg',
      '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
    ],
  },
  {
    path: 'productos/cortinas-de-enrollar-aluminio.html',
    gallery: [
      '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_1.jpeg',
      '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_2.jpeg',
      '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
    ],
  },
  {
    path: 'productos/aberturas-serie-20-y-25.html',
    gallery: [
      '/uploads/cms/legacy-assets/img/aberturas/ventana.jpg',
      '/uploads/cms/legacy-assets/img/aberturas/monoblocks.jpg',
      '/uploads/cms/legacy-assets/img/aberturas/dvh-main.jpg',
    ],
  },
  {
    path: 'productos/aberturas-probba.html',
    gallery: [
      '/uploads/cms/legacy-assets/img/aberturas/abertura_1.png',
      '/uploads/cms/legacy-assets/img/aberturas/dvh-main.jpg',
      '/uploads/cms/legacy-assets/img/aberturas/gala.jpg',
    ],
  },
  {
    path: 'productos/aberturas-gala.html',
    gallery: [
      '/uploads/cms/legacy-assets/img/aberturas/gala.jpg',
      '/uploads/cms/legacy-assets/img/aberturas/dvh-main.jpg',
      '/uploads/cms/legacy-assets/img/aberturas/monoblocks.jpg',
    ],
  },
  {
    path: 'productos/aberturas-summa.html',
    gallery: [
      '/uploads/cms/legacy-assets/img/portfolio/aberturas/dvh-main.jpg',
      '/uploads/cms/legacy-assets/img/aberturas/monoblocks.jpg',
      '/uploads/cms/legacy-assets/img/aberturas/gala.jpg',
    ],
  },
  { path: 'productos/bandas-verticales.html', gallery: [] },
  { path: 'productos/venecianas.html', gallery: [] },
  { path: 'productos/aberturas-aluminio.html', gallery: [] },
  { path: 'productos/toldos-y-cerramientos.html', gallery: [] },
  { path: 'productos/motores-cortinas-y-persianas.html', gallery: [] },
  { path: 'productos/cortinas-metalicas.html', gallery: [] },
];

const PAGE_LAYOUT_OVERRIDES = {
  'productos/cortinas-de-enrollar.html': {
    galleryAsContentSplit: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
    ensureTopHero: true,
    moveFeatureGridAfterGallery: true,
  },
  'productos/cortinas-de-enrollar-aluminio.html': {
    galleryAsContentSplit: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
    ensureTopHero: true,
    moveFeatureGridAfterGallery: true,
  },
  'productos/aberturas-serie-20-y-25.html': {
    ensureTopHero: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
  },
  'productos/aberturas-probba.html': {
    ensureTopHero: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
  },
  'productos/aberturas-gala.html': {
    ensureTopHero: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
  },
  'productos/aberturas-summa.html': {
    ensureTopHero: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
  },
  'productos/cortinas-roller.html': {
    editorialGallerySplit: true,
    removeBudgetCalculator: false,
    removeMediaCarousel: true,
    removeVideoSection: true,
    ensureTopHero: true,
    allowBudgetCalculator: true,
  },
  'productos/bandas-verticales.html': {
    ensureTopHero: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
  },
  'productos/venecianas.html': {
    ensureTopHero: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
  },
  'productos/aberturas-aluminio.html': {
    ensureTopHero: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
  },
  'productos/toldos-y-cerramientos.html': {
    ensureTopHero: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
  },
  'productos/motores-cortinas-y-persianas.html': {
    ensureTopHero: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
  },
  'productos/cortinas-metalicas.html': {
    ensureTopHero: true,
    removeMediaCarousel: true,
    removeVideoSection: true,
  },
};

for (const key of Object.keys(PAGE_LAYOUT_OVERRIDES)) {
  PAGE_LAYOUT_OVERRIDES[key] = {
    removeMediaCarousel: true,
    removeVideoSection: true,
    ...PAGE_LAYOUT_OVERRIDES[key],
  };
}

const snapshotRoot = path.resolve(__dirname, '..', 'prisma', 'page-snapshots', 'products');
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const mediaIndexPromise = buildMediaIndex();

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();

const asString = (value) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';

const rtText = (value) => ({
  type: 'text',
  value,
});

const rtElement = (tag, children = [], attributes) => ({
  type: 'element',
  tag,
  ...(attributes ? { attributes } : {}),
  ...(children.length ? { children } : {}),
});

const rtParagraph = (children) => rtElement('p', Array.isArray(children) ? children : [rtText(String(children))]);

const rtHeading = (tag, value) => rtElement(tag, [rtText(value)]);

const rtStrong = (value) => rtElement('strong', [rtText(value)]);

const rtList = (items) =>
  rtElement(
    'ul',
    items.map((item) => {
      if (typeof item === 'string') {
        return rtElement('li', [rtText(item)]);
      }
      return rtElement('li', Array.isArray(item) ? item : [rtText(String(item))]);
    }),
  );

const buildProductSlugFromPagePath = (pagePath) =>
  asString(pagePath)
    .replace(/^productos\//i, '')
    .replace(/\.html?$/i, '');

const isRollerProductPage = (page) => normalize(page.path) === 'productos/cortinas-roller.html';

const buildProductMediaDetailHref = (productSlug, mediaSlug) =>
  `/multimedia/${encodeURIComponent(productSlug)}/${encodeURIComponent(mediaSlug)}`;

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const isExternalUrl = (value) => /^(https?:\/\/|data:|mailto:|tel:)/i.test(String(value ?? '').trim());

const cleanMediaReference = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^uploads\//i, '')
    .replace(/^media\//i, '')
    .replace(/^cms\/legacy-assets\//i, '');

const mediaFields = new Set([
  'image',
  'imageUrl',
  'mediaUrl',
  'posterUrl',
  'thumbnail',
  'videoUrl',
  'backgroundImageUrl',
  'src',
]);

async function walkMediaFiles(root, acc = []) {
  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return acc;
  }

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await walkMediaFiles(fullPath, acc);
      continue;
    }
    if (entry.isFile()) {
      acc.push(fullPath);
    }
  }

  return acc;
}

async function buildMediaIndex() {
  const files = await walkMediaFiles(MEDIA_ROOT);
  const byBaseName = new Map();
  const allPaths = [];

  for (const absolutePath of files) {
    const relativePath = path.relative(MEDIA_ROOT, absolutePath).replace(/\\/g, '/');
    allPaths.push(relativePath);
    const baseName = path.basename(relativePath);
    const list = byBaseName.get(baseName) ?? [];
    list.push(relativePath);
    byBaseName.set(baseName, list);
  }

  return { byBaseName, allPaths };
}

function scoreMediaCandidate(relativePath, pagePath) {
  const pageSlug = path.basename(pagePath).replace(/\.html?$/i, '').toLowerCase();
  const normalizedPath = relativePath.toLowerCase();
  let score = 0;

  if (normalizedPath.includes(pageSlug)) score += 6;
  for (const token of pageSlug.split(/[^a-z0-9]+/i).filter(Boolean)) {
    if (normalizedPath.includes(token)) score += 1;
  }

  score += Math.max(0, 4 - normalizedPath.split('/').length);
  return score;
}

async function resolveCanonicalMediaUrl(reference, pagePath) {
  const trimmed = String(reference ?? '').trim();
  if (!trimmed || isExternalUrl(trimmed)) return trimmed;

  const rawRelative = trimmed
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^uploads\//i, '')
    .replace(/^media\//i, '');
  if (/^cms\/legacy-assets\//i.test(rawRelative)) {
    const legacyAbsolute = path.join(UPLOADS_ROOT, rawRelative);
    try {
      const stat = await fs.stat(legacyAbsolute);
      if (stat.isFile()) {
        return `/uploads/${rawRelative}`;
      }
    } catch {
      // fall through to media root and basename matching
    }
  }

  const clean = cleanMediaReference(trimmed);
  if (!clean) return trimmed;

  const directCandidates = [
    clean,
    clean.replace(/^legacy-assets\//i, ''),
    clean.replace(/^img\//i, ''),
    clean.replace(/^portfolio\//i, ''),
  ];

  for (const candidate of directCandidates) {
    const absolute = path.join(MEDIA_ROOT, candidate);
    try {
      const stat = await fs.stat(absolute);
      if (stat.isFile()) {
        return `/media/${candidate}`;
      }
    } catch {
      continue;
    }
  }

  const { byBaseName } = await mediaIndexPromise;
  const baseName = path.basename(clean);
  const candidates = byBaseName.get(baseName) ?? [];
  const { allPaths } = await mediaIndexPromise;

  const scoredCandidates = candidates.length
    ? candidates
    : allPaths.filter((candidate) => scoreMediaCandidate(candidate, pagePath) > 0);

  if (!scoredCandidates.length) return trimmed;

  const best = [...scoredCandidates].sort(
    (left, right) => scoreMediaCandidate(right, pagePath) - scoreMediaCandidate(left, pagePath),
  )[0];
  return best ? `/media/${best}` : trimmed;
}

async function normalizeMediaFields(value, pagePath) {
  if (Array.isArray(value)) {
    const next = [];
    for (const item of value) {
      next.push(await normalizeMediaFields(item, pagePath));
    }
    return next;
  }

  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && mediaFields.has(key)) {
        next[key] = await resolveCanonicalMediaUrl(item, pagePath);
        continue;
      }
      next[key] = await normalizeMediaFields(item, pagePath);
    }
    return next;
  }

  return value;
}

const writeSnapshot = async (page) => {
  const dir = path.join(snapshotRoot, runStamp);
  await ensureDir(dir);
  const fileName = `${normalize(page.path).replace(/\//g, '__')}.json`;
  const snapshot = {
    path: page.path,
    title: page.title,
    summary: page.summary,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    seoImageUrl: page.seoImageUrl,
    legacySource: page.legacySource,
    layoutKey: page.layoutKey,
    updatedAt: page.updatedAt,
    sections: page.sections,
  };
  await fs.writeFile(path.join(dir, fileName), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
};

const ensureMedia = async (mediaUrl, title, alt, type = CmsMediaType.IMAGE) => {
  const existing = await prisma.cmsMedia.findFirst({
    where: { url: mediaUrl },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.cmsMedia.create({
    data: {
      url: mediaUrl,
      type,
      alt: alt || title || null,
      title: title || alt || null,
      source: 'product_page_standardization',
      metadata: {},
      isActive: true,
    },
    select: { id: true },
  });

  return created.id;
};

const uniqueStrings = (values) =>
  Array.from(
    new Set(
      values
        .map((value) => asString(value))
        .filter((value) => value.length > 0),
    ),
  );

const collectProductMediaUrls = (page, target) => {
  const heroCandidateUrls = collectHeroMediaCandidates(page);
  return uniqueStrings([...(target.gallery ?? []), ...heroCandidateUrls]).filter(Boolean);
};

const isImageLikeUrl = (value) =>
  /\.(avif|webp|png|jpe?g|gif|bmp|svg)(\?.*)?$/i.test(String(value ?? '').trim());

const derivePageDescription = (page) => {
  const richTextSection = page.sections.find((section) => section.type === CmsPageSectionType.RICH_TEXT);
  const splitSection = page.sections.find((section) => section.type === CmsPageSectionType.CONTENT_SPLIT);
  const ctaSection = page.sections.find((section) => section.type === CmsPageSectionType.CTA_BANNER);

  return (
    asString(richTextSection?.settings?.description) ||
    asString(richTextSection?.settings?.title) ||
    asString(splitSection?.settings?.description) ||
    asString(splitSection?.settings?.title) ||
    asString(ctaSection?.settings?.description) ||
    'Conocé la propuesta visual, sus terminaciones y el contenido editorial disponible.'
  );
};

const collectHeroMediaCandidates = (page) => {
  const candidates = [];
  const push = (value) => {
    const mediaUrl = asString(value);
    if (mediaUrl && !candidates.includes(mediaUrl)) {
      candidates.push(mediaUrl);
    }
  };

  for (const section of page.sections) {
    const settings = section.settings ?? {};

    if (section.type === CmsPageSectionType.HERO) {
      for (const slide of settings.slides ?? []) {
        push(slide?.imageUrl);
        push(slide?.backgroundImageUrl);
      }
      push(settings.backgroundImageUrl);
      push(settings.imageUrl);
    }

    push(settings.backgroundImageUrl);
    push(settings.imageUrl);

    for (const entry of settings.gallery ?? []) {
      push(entry?.imageUrl);
    }

    for (const block of section.blocks ?? []) {
      push(block?.media?.url);
      push(block?.content?.imageUrl);
      push(block?.content?.mediaUrl);
      push(block?.content?.thumbnail);
      push(block?.content?.posterUrl);
    }
  }

  return candidates.filter(isImageLikeUrl);
};

const buildTopHeroSection = async (page) => {
  const candidateUrls = collectHeroMediaCandidates(page);
  const resolvedMediaUrl = candidateUrls.length
    ? await resolveCanonicalMediaUrl(candidateUrls[0], page.path)
    : null;
  const heroMediaUrl = resolvedMediaUrl || page.seoImageUrl || null;
  const heroDescription = derivePageDescription(page);

  if (!heroMediaUrl) {
    return null;
  }

  const heroTitle = asString(page.title) || 'Producto';

  return {
    type: CmsPageSectionType.HERO,
    key: 'standard-top-hero',
    name: heroTitle,
    visible: true,
    sortOrder: 0,
    settings: {
      title: heroTitle,
      eyebrow: 'Solución a medida',
      description: heroDescription,
      headingLevel: 'h1',
      backgroundImageUrl: heroMediaUrl,
      slides: [
        {
          href: '/multimedia',
          title: heroTitle,
          description: heroDescription,
          imageAlt: heroTitle,
          imageUrl: heroMediaUrl,
          linkLabel: 'Ver fotos y videos',
        },
      ],
      primaryCtaHref: '/contacto.html',
      primaryCtaLabel: 'Pedir asesoramiento',
      secondaryCtaHref: '/multimedia',
      secondaryCtaLabel: 'Ver fotos y videos',
    },
    blocks: [],
  };
};

const buildProductBudgetCalculatorSection = (page) => {
  const productSlug = buildProductSlugFromPagePath(page.path);
  const rollerProduct = isRollerProductPage(page);

  return {
    type: CmsPageSectionType.BUDGET_CALCULATOR,
    key: 'standard-budget-calculator',
    name: 'Calculadora de presupuesto',
    visible: true,
    sortOrder: 0,
    settings: {
      title: rollerProduct ? 'Calculá tu presupuesto de roller' : 'Calculá tu presupuesto',
      description: rollerProduct
        ? 'Si ya tenés medidas aproximadas, obtené una referencia de precio. Si todavía estás definiendo la opción, primero podés revisar la guía, las fotos y escribirnos.'
        : 'Ingresá medidas aproximadas para ver una referencia de precio y avanzar más rápido.',
      compact: true,
      initialProductSlug: productSlug,
    },
    blocks: [],
  };
};

const MERCADO_PAGO_IMAGE_URL = '/uploads/cms/legacy-assets/img/mercadopago-img.jpg';

const buildStandardPaymentFacilitiesSection = (page) => {
  const productSlug = buildProductSlugFromPagePath(page.path);

  return {
    type: CmsPageSectionType.CONTENT_SPLIT,
    key: 'standard-payment-facilities',
    name: 'Facilidades de pago',
    visible: true,
    sortOrder: 0,
    settings: {
      title: '',
      description: '',
      variant: 'image-content',
      mediaPosition: 'start',
      imageAlt: 'Mercado Pago',
      imageUrl: MERCADO_PAGO_IMAGE_URL,
      gallery: [],
      actions: [],
      productSlug,
    },
    blocks: [
      {
        type: CmsPageBlockType.RICH_TEXT,
        key: 'standard-payment-facilities-copy',
        name: 'Facilidades de Pago',
        sortOrder: 0,
        visible: true,
        content: {
          richText: [
            rtHeading('h2', 'Facilidades de Pago'),
            rtHeading('h3', 'Aceptamos pagos hasta en 12 cuotas sin interés mediante Mercado Pago.'),
            rtList([
              [rtText('Compra segura y protegida.')],
              [rtText('Disponible para todos nuestros productos.')],
              [rtText('Rápido y sin complicaciones.')],
            ]),
          ],
        },
      },
    ],
  };
};

const sectionHasMercadoPagoContent = (section) => {
  const normalized = JSON.stringify({
    key: section?.key,
    name: section?.name,
    settings: section?.settings,
    blocks: section?.blocks,
  })
    .toLowerCase()
    .replace(/\s+/g, ' ');

  return (
    normalized.includes('facilidades de pago') ||
    (normalized.includes('mercado pago') && normalized.includes('12 cuotas sin interés'.toLowerCase()))
  );
};

// Canonical detail-page structure: hero + editorial split + calculator + multimedia + CTA.
// Cortinas Roller is the reference page that defines this baseline.
const buildCanonicalProductDetailEditorialSplitSection = async (page, target) => {
  const heroSection = page.sections.find((section) => section.type === CmsPageSectionType.HERO);
  const carouselSection = page.sections.find((section) => section.type === CmsPageSectionType.MEDIA_CAROUSEL);
  const targetGallery = Array.isArray(target?.gallery) ? target.gallery : [];

  const heroImages = [];
  for (const slide of heroSection?.settings?.slides ?? []) {
    const nextUrl = await resolveCanonicalMediaUrl(slide.imageUrl, page.path);
    if (nextUrl) {
      heroImages.push({
        href: '/shop?search=roller',
        imageAlt: asString(slide.imageAlt) || page.title,
        imageUrl: nextUrl,
        linkLabel: 'Ver tienda',
      });
    }
  }

  const carouselImages = [];
  for (const block of carouselSection?.blocks ?? []) {
    const mediaUrl = block.media?.url ? await resolveCanonicalMediaUrl(block.media.url, page.path) : '';
    if (!mediaUrl) continue;
    carouselImages.push({
      href: '/multimedia/cortinas-roller',
      imageAlt: block.media?.alt || page.title,
      imageUrl: mediaUrl,
      linkLabel: 'Ver multimedia',
    });
  }

  const targetGalleryImages = [];
  for (const mediaUrl of targetGallery) {
    const resolved = await resolveCanonicalMediaUrl(mediaUrl, page.path);
    if (!resolved) continue;
    targetGalleryImages.push({
      href: '/multimedia/cortinas-roller',
      imageAlt: page.title,
      imageUrl: resolved,
      linkLabel: 'Ver multimedia',
    });
  }

  const gallery = [...heroImages, ...targetGalleryImages, ...carouselImages].slice(0, 6);
  const title = 'Cortinas Roller en Blackout y Screen - Soluciones a Medida';
  const description =
    'Las roller se adaptan a cada ambiente según el pasaje de luz, con opciones screen, blackout o doble para combinar estética y funcionalidad.';
  const bodyRichText = {
    richText: [
      rtParagraph([
        rtText('Las '),
        rtStrong('Cortinas Roller'),
        rtText(
          ' se pueden clasificar en dos tipos según el pasaje de luz que permiten, lo que las hace versátiles en múltiples ambientes. Además de ser prácticas en su uso, son muy elegantes y decorativas.',
        ),
      ]),
      rtHeading('h2', 'Screen'),
      rtParagraph([
        rtText(
          'Es una tela microperforada que permite el paso de la luz y la visibilidad unidireccional (de día se ve hacia el exterior y de noche hacia el interior). Es una tela lavable, con un paño y agua, que requiere poco cuidado y su filtro UV ayuda a proteger muebles y pisos. Las cortinas sunscreen son recomendables para todo tipo de ambientes, desde living o dormitorios hasta cocinas u oficinas.',
        ),
      ]),
      rtHeading('h2', 'Blackout'),
      rtParagraph([
        rtText(
          'Las cortinas blackout son perfectas para dar oscuridad a los ambientes y disminuir casi en su totalidad el paso de la luz, así como también para regular la temperatura, ya que evita el paso de los rayos solares. Es por sus características que son ideales para dormitorios, salas de estar o incluso salas de reuniones para proyectar.',
        ),
      ]),
      rtHeading('h2', 'Roller Dobles'),
      rtParagraph([
        rtText(
          'Se pueden combinar ambos tipos en un único sistema obteniendo así lo mejor de cada uno de ellos. Perfectas para quienes desean flexibilidad en el control de luz y privacidad.',
        ),
      ]),
      rtHeading('h3', 'Características principales'),
      rtList([
        [
          rtStrong('Versatilidad:'),
          rtText(' Combinación de blackout y screen en una sola cortina.'),
        ],
        [
          rtStrong('Control total:'),
          rtText(' Permite regular la cantidad de luz en distintos momentos del día.'),
        ],
        [
          rtStrong('Privacidad:'),
          rtText(' Opción de visibilidad diurna con screen y total privacidad con blackout.'),
        ],
        [
          rtStrong('Estilo moderno:'),
          rtText(' Diseño elegante y adaptable a cualquier espacio.'),
        ],
        [
          rtStrong('Fácil uso:'),
          rtText(' Sistema de doble riel para un manejo cómodo y práctico.'),
        ],
      ]),
      rtParagraph([
        rtText('En rollers anchos puede convenir dividir la cortina en dos tramos para facilitar la manipulación y mejorar el funcionamiento.'),
      ]),
      rtParagraph([
        rtStrong('¿Buscás Cortinas Roller a medida?'),
        rtText(' Tenemos la mayor variedad y máxima calidad. ¡Escribinos! Compra al mejor precio, en cuotas y con instalación incluida.'),
      ]),
    ],
  };

  return {
    type: CmsPageSectionType.CONTENT_SPLIT,
    key: 'roller-editorial-split',
    name: 'Elegí tu roller',
    visible: true,
    sortOrder: 1,
    settings: {
      title,
      description,
      variant: 'media-gallery-content',
      mediaPosition: 'start',
      imageAlt: asString(heroSection?.settings?.title) || page.title,
      imageUrl: gallery[0]?.imageUrl || null,
      gallery,
      actions: [
        { label: 'Pedir asesoramiento', href: '/contacto.html' },
        { label: 'Ir a la tienda', href: '/shop?search=roller' },
      ],
    },
    blocks: [
      {
        type: CmsPageBlockType.RICH_TEXT,
        key: 'roller-editorial-copy',
        name: 'Contenido editorial',
        sortOrder: 0,
        visible: true,
        content: bodyRichText,
      },
    ],
  };
};

const buildRollerFaqSection = (page) => {
  const title = `${page.title} y dudas frecuentes`;

  return {
    type: CmsPageSectionType.FAQ,
    key: 'roller-faq',
    name: 'Preguntas frecuentes',
    visible: true,
    sortOrder: 0,
    settings: {
      title,
      description: 'Respuestas rápidas para avanzar con más claridad o pedir ayuda cuando todavía falta definir.',
    },
    blocks: [
      {
        type: CmsPageBlockType.FAQ_ITEM,
        key: 'roller-faq-1',
        name: '¿Qué conviene: screen, blackout o doble?',
        sortOrder: 0,
        visible: true,
        content: {
          question: '¿Qué conviene: screen, blackout o doble?',
          answer:
            'Screen es la mejor opción cuando querés luz natural y una vista más abierta. Blackout conviene cuando necesitás oscurecer y ganar privacidad. Doble es ideal si querés resolver ambas necesidades en una sola instalación.',
        },
      },
      {
        type: CmsPageBlockType.FAQ_ITEM,
        key: 'roller-faq-2',
        name: '¿Puedo pedir presupuesto con medidas aproximadas?',
        sortOrder: 1,
        visible: true,
        content: {
          question: '¿Puedo pedir presupuesto con medidas aproximadas?',
          answer:
            'Sí. Podés arrancar con medidas estimadas para tener una referencia de precio y después confirmar los detalles antes de cerrar el pedido.',
        },
      },
      {
        type: CmsPageBlockType.FAQ_ITEM,
        key: 'roller-faq-3',
        name: '¿Qué datos necesito para avanzar más rápido?',
        sortOrder: 2,
        visible: true,
        content: {
          question: '¿Qué datos necesito para avanzar más rápido?',
          answer:
            'Con ancho, alto aproximado, cantidad de paños y el ambiente donde se va a instalar ya podemos orientarte mucho mejor.',
        },
      },
      {
        type: CmsPageBlockType.FAQ_ITEM,
        key: 'roller-faq-4',
        name: '¿Cuándo conviene dividir la cortina en dos tramos?',
        sortOrder: 3,
        visible: true,
        content: {
          question: '¿Cuándo conviene dividir la cortina en dos tramos?',
          answer:
            'En roller muy anchos puede convenir dividir para mejorar la manipulación, el funcionamiento y la comodidad de uso diario.',
        },
      },
    ],
  };
};

const buildRollerDecisionCtaSection = () => ({
  type: CmsPageSectionType.CTA_BANNER,
  key: 'roller-decision-cta',
  name: 'Decisión comercial',
  visible: true,
  sortOrder: 0,
  settings: {
    title: '¿Tenés dudas o ya sabés lo que necesitás?',
    description:
      'Si todavía estás definiendo la mejor tela o querés confirmar medidas, escribinos. Si la compra ya está decidida, pasá a la tienda y avanzá con tu elección.',
    actions: [
      { label: 'Pedir asesoramiento', href: '/contacto.html' },
      { label: 'Ir a la tienda', href: '/shop?search=roller' },
    ],
    variant: 'default',
    intent: 'transactional',
  },
  blocks: [],
});

const buildProductMultimediaHubSection = async (page, mediaUrls) => {
  const resolvedMediaUrls = [];
  for (const mediaUrl of mediaUrls.slice(0, 3)) {
    const canonicalUrl = await resolveCanonicalMediaUrl(mediaUrl, page.path);
    if (canonicalUrl) {
      resolvedMediaUrls.push(canonicalUrl);
    }
  }

  if (!resolvedMediaUrls.length) return null;

  const productSlug = buildProductSlugFromPagePath(page.path);
  const mediaCount = Math.max(1, resolvedMediaUrls.length);
  const rollerProduct = isRollerProductPage(page);

  while (resolvedMediaUrls.length < 3) {
    resolvedMediaUrls.push(resolvedMediaUrls[resolvedMediaUrls.length - 1]);
  }

  const [firstMedia, secondMedia, thirdMedia] = resolvedMediaUrls;

  return {
    type: CmsPageSectionType.MEDIA_GRID_ENHANCED,
    key: 'standard-multimedia-hub',
    name: 'Multimedia comercial',
    visible: true,
    sortOrder: 0,
    settings: {
      variant: 'product-multimedia',
      productSlug,
      eyebrow: 'Multimedia y contexto',
      title: rollerProduct ? 'Fotos, videos y contexto real de la roller' : `Cómo avanzar con ${page.title}`,
      description: rollerProduct
        ? 'Mirá cómo cae la tela, cómo queda instalado y qué cambia entre screen, blackout o doble.'
        : 'Entrá a la galería, revisá medidas y pedí asesoramiento para decidir con más seguridad.',
    },
    blocks: [
      {
        type: CmsPageBlockType.CARD,
        key: 'standard-multimedia-1',
        name: 'Fotos reales',
        sortOrder: 0,
        visible: true,
        content: {
          title: 'Ver fotos y videos',
          description: rollerProduct
            ? 'Revisá el roller instalado para entender la caída, el recorrido y la terminación real.'
            : 'Mirá el producto en contexto real antes de tomar una decisión.',
          badge: 'Multimedia',
          linkLabel: 'Abrir galería',
          mediaUrl: firstMedia,
          mediaType: 'image',
          href: productSlug ? `/multimedia/${encodeURIComponent(productSlug)}` : buildProductMediaDetailHref(productSlug, `imagen_${Math.min(1, mediaCount)}`),
          overlayText: true,
        },
        media: {
          url: firstMedia,
          alt: `${page.title} fotos reales`,
          title: `${page.title} fotos reales`,
          type: CmsMediaType.IMAGE,
          source: 'product_page_standardization',
        },
      },
      {
        type: CmsPageBlockType.CARD,
        key: 'standard-multimedia-2',
        name: 'Más contexto',
        sortOrder: 1,
        visible: true,
        content: {
          title: 'Tomar medidas',
          description: rollerProduct
            ? 'Si todavía estás definiendo el frente, te guiamos para medir ancho y alto sin perder tiempo.'
            : 'Si todavía estás definiendo el frente, te guiamos para medir ancho y alto sin perder tiempo.',
          badge: 'Guía',
          linkLabel: 'Ver guía',
          mediaUrl: secondMedia,
          mediaType: 'image',
          href: '/guias/como-medir-ancho-y-alto',
          overlayText: true,
        },
        media: {
          url: secondMedia,
          alt: `${page.title} más contexto`,
          title: `${page.title} más contexto`,
          type: CmsMediaType.IMAGE,
          source: 'product_page_standardization',
        },
      },
      {
        type: CmsPageBlockType.CARD,
        key: 'standard-multimedia-3',
        name: 'Asesoramiento',
        sortOrder: 2,
        visible: true,
        content: {
          title: 'Pedir asesoramiento',
          description: rollerProduct
            ? 'Si querés avanzar, te ayudamos a definir la mejor tela y cerrar el pedido con una opción clara.'
            : 'Si querés avanzar, te ayudamos a definir la opción adecuada y resolver tus dudas.',
          badge: 'Contacto',
          linkLabel: 'Contactar',
          mediaUrl: thirdMedia,
          mediaType: 'image',
          href: '/contacto.html',
          overlayText: true,
        },
        media: {
          url: thirdMedia,
          alt: `${page.title} asesoramiento`,
          title: `${page.title} asesoramiento`,
          type: CmsMediaType.IMAGE,
          source: 'product_page_standardization',
        },
      },
    ],
  };
};

const buildEditorialGallerySplit = async (page) => {
  const richTextSection = page.sections.find((section) => section.type === CmsPageSectionType.RICH_TEXT);
  const heroSection = page.sections.find((section) => section.type === CmsPageSectionType.HERO);
  const carouselSection = page.sections.find((section) => section.type === CmsPageSectionType.MEDIA_CAROUSEL);

  const heroImages = [];
  for (const slide of heroSection?.settings?.slides ?? []) {
    const nextUrl = await resolveCanonicalMediaUrl(slide.imageUrl, page.path);
    if (nextUrl) {
      heroImages.push({
        href: asString(slide.href),
        imageAlt: asString(slide.imageAlt) || page.title,
        imageUrl: nextUrl,
        linkLabel: asString(slide.linkLabel),
      });
    }
  }

  const carouselImages = [];
  for (const block of carouselSection?.blocks ?? []) {
    const mediaUrl = block.media?.url ? await resolveCanonicalMediaUrl(block.media.url, page.path) : '';
    if (!mediaUrl) continue;
    carouselImages.push({
      href: '/multimedia',
      imageAlt: block.media?.alt || page.title,
      imageUrl: mediaUrl,
      linkLabel: 'Ver multimedia',
    });
  }

  const gallery = [...heroImages, ...carouselImages].slice(0, 6);
  const contentBlock = richTextSection?.blocks?.[0] ? deepClone(richTextSection.blocks[0]) : null;
  const title =
    asString(richTextSection?.settings?.title) ||
    asString(heroSection?.settings?.title) ||
    page.title;
  const description =
    asString(richTextSection?.settings?.description) ||
    asString(heroSection?.settings?.description) ||
    null;

  if (!contentBlock && !gallery.length) {
    return null;
  }

  return {
    type: CmsPageSectionType.CONTENT_SPLIT,
    key: 'editorial-gallery-split',
    name: 'Galería editorial',
    visible: true,
    sortOrder: 1,
    settings: {
      title,
      description,
      variant: 'media-gallery-content',
      mediaPosition: 'start',
      imageAlt: asString(heroSection?.settings?.title) || page.title,
      imageUrl: gallery[0]?.imageUrl || null,
      gallery,
      actions: [
        { label: 'Ver fotos y videos', href: '/multimedia' },
      ],
    },
    blocks: contentBlock
      ? [
          {
            type: CmsPageBlockType.RICH_TEXT,
            key: 'editorial-gallery-copy',
            name: richTextSection?.blocks?.[0]?.name || 'Contenido editorial',
            sortOrder: 0,
            visible: true,
            content: contentBlock.content,
          },
        ]
      : [],
  };
};

const addMultimediaAction = (section) => {
  const settings = deepClone(section.settings ?? {});
  const actions = Array.isArray(settings.actions) ? settings.actions.slice() : [];
  if (!actions.some((action) => normalize(action?.href) === 'multimedia')) {
    actions.push({
      label: 'Ver fotos y videos',
      href: '/multimedia',
    });
  }
  settings.actions = actions;
  return {
    ...section,
    settings,
  };
};

const rebuildPage = async (page, target) => {
  const nextSections = [];
  const layoutOverride = PAGE_LAYOUT_OVERRIDES[normalize(page.path)] ?? {};
  const rollerProduct = isRollerProductPage(page);
  const hasHero = page.sections.some((section) => section.type === CmsPageSectionType.HERO);
  const productMediaUrls = collectProductMediaUrls(page, target);
  const multimediaHubSection = await buildProductMultimediaHubSection(page, productMediaUrls);
  const standardPaymentFacilitiesSection = buildStandardPaymentFacilitiesSection(page);
  const editorialGallerySplit = rollerProduct
    ? await buildCanonicalProductDetailEditorialSplitSection(page, target)
    : layoutOverride.editorialGallerySplit
      ? await buildEditorialGallerySplit(page)
      : null;
  const budgetCalculatorSection = layoutOverride.allowBudgetCalculator
    ? buildProductBudgetCalculatorSection(page)
    : null;
  let multimediaActionAdded = false;
  let multimediaHubInserted = false;
  let budgetCalculatorInserted = false;
  let rollerEditorialInserted = false;
  let rollerHeroInserted = false;
  let paymentFacilitiesInserted = false;
  const carouselGallery = page.sections.find((section) => section.type === CmsPageSectionType.MEDIA_CAROUSEL);
  const carouselImages = carouselGallery
    ? carouselGallery.blocks
        .map((block) => block.media?.url)
        .filter((value) => typeof value === 'string' && value.trim().length > 0)
    : [];
  const topHeroSection = layoutOverride.ensureTopHero && !hasHero ? await buildTopHeroSection(page) : null;
  let topHeroInserted = !topHeroSection;
  const deferRichTextAfterDvh = normalize(page.path) === 'productos/aberturas-aluminio.html';
  let deferredRichTextSection = null;
  const deferFeatureGridAfterGallery = layoutOverride.moveFeatureGridAfterGallery && normalize(page.path) === 'productos/cortinas-de-enrollar.html';
  let deferredFeatureGridSection = null;

  if (rollerProduct) {
    const rollerHeroSection = page.sections.find((section) => section.type === CmsPageSectionType.HERO);
    if (rollerHeroSection) {
      nextSections.push(await normalizeMediaFields(deepClone(rollerHeroSection), page.path));
      rollerHeroInserted = true;
    }
  }

  for (const section of page.sections) {
    for (const block of section.blocks ?? []) {
      if (block.media?.id && block.media?.url) {
        const resolvedUrl = await resolveCanonicalMediaUrl(block.media.url, page.path);
        if (resolvedUrl && resolvedUrl !== block.media.url) {
          await prisma.cmsMedia.update({
            where: { id: block.media.id },
            data: { url: resolvedUrl },
          });
        }
      }
    }
  }

  for (const section of page.sections) {
    const normalizedSection = await normalizeMediaFields(deepClone(section), page.path);

    if (
      topHeroSection &&
      !topHeroInserted &&
      normalizedSection.type !== CmsPageSectionType.SITE_HEADER &&
      normalizedSection.type !== CmsPageSectionType.SITE_FOOTER &&
      normalizedSection.type !== CmsPageSectionType.HERO
    ) {
      nextSections.push(await normalizeMediaFields(deepClone(topHeroSection), page.path));
      topHeroInserted = true;
    }

    if (rollerProduct && normalizedSection.type === CmsPageSectionType.HERO) {
      continue;
    }

    if (
      rollerProduct &&
      editorialGallerySplit &&
      !rollerEditorialInserted &&
      normalizedSection.type !== CmsPageSectionType.SITE_HEADER &&
      normalizedSection.type !== CmsPageSectionType.SITE_FOOTER &&
      normalizedSection.type !== CmsPageSectionType.HERO
    ) {
      nextSections.push(await normalizeMediaFields(deepClone(editorialGallerySplit), page.path));
      rollerEditorialInserted = true;
    }

    if (layoutOverride.removeBudgetCalculator && normalizedSection.type === CmsPageSectionType.BUDGET_CALCULATOR) {
      continue;
    }

    if (rollerProduct && normalizedSection.type === CmsPageSectionType.BUDGET_CALCULATOR) {
      continue;
    }

    if (rollerProduct && normalizedSection.type === CmsPageSectionType.CONTENT_SPLIT) {
      continue;
    }

    if (rollerProduct && normalizedSection.type === CmsPageSectionType.FAQ) {
      continue;
    }

    if (layoutOverride.editorialGallerySplit && normalizedSection.type === CmsPageSectionType.RICH_TEXT) {
      continue;
    }

    if (
      normalizedSection.type === CmsPageSectionType.MEDIA_GRID_ENHANCED &&
      normalize(normalizedSection.key) === 'standard-multimedia-hub'
    ) {
      continue;
    }

    if (sectionHasMercadoPagoContent(normalizedSection)) {
      continue;
    }

    if (deferRichTextAfterDvh && normalizedSection.type === CmsPageSectionType.RICH_TEXT) {
      deferredRichTextSection = normalizedSection;
      continue;
    }

    if (deferFeatureGridAfterGallery && normalizedSection.type === CmsPageSectionType.FEATURE_GRID) {
      deferredFeatureGridSection = normalizedSection;
      continue;
    }

    if (
      layoutOverride.galleryAsContentSplit &&
      normalizedSection.type === CmsPageSectionType.CONTENT_SPLIT &&
      !normalizedSection.settings?.gallery
    ) {
      const contentSplitGallery = carouselImages.length
        ? carouselImages.map((imageUrl, index) => ({
            href: '',
            imageAlt: `${page.title} ${index + 1}`,
            imageUrl,
            linkLabel: '',
          }))
        : [];
      normalizedSection.settings = {
        ...(normalizedSection.settings ?? {}),
        variant: 'media-gallery-content',
        mediaPosition: 'start',
        gallery: contentSplitGallery,
      };
    }

    if (normalizedSection.type === CmsPageSectionType.CTA_BANNER && !multimediaActionAdded) {
      if (multimediaHubSection && !multimediaHubInserted) {
        nextSections.push(await normalizeMediaFields(deepClone(multimediaHubSection), page.path));
        multimediaHubInserted = true;
      }
      nextSections.push(addMultimediaAction(normalizedSection));
      multimediaActionAdded = true;
      continue;
    }

    if (layoutOverride.removeVideoSection && normalizedSection.type === CmsPageSectionType.VIDEO_SECTION) {
      continue;
    }

    if (layoutOverride.removeMediaCarousel && normalizedSection.type === CmsPageSectionType.MEDIA_CAROUSEL) {
      continue;
    }

    nextSections.push(normalizedSection);

    if (
      deferRichTextAfterDvh &&
      normalizedSection.type === CmsPageSectionType.CONTENT_SPLIT &&
      normalize(normalizedSection.key) === 'content-split-3' &&
      deferredRichTextSection
    ) {
      nextSections.push(deferredRichTextSection);
      deferredRichTextSection = null;
    }

    if (
      deferFeatureGridAfterGallery &&
      normalizedSection.type === CmsPageSectionType.CONTENT_SPLIT &&
      normalize(normalizedSection.key) === 'cortinas-enrollar-content' &&
      deferredFeatureGridSection
    ) {
      nextSections.push(deferredFeatureGridSection);
      deferredFeatureGridSection = null;
    }
  }

  if (topHeroSection && !topHeroInserted) {
    nextSections.unshift(await normalizeMediaFields(deepClone(topHeroSection), page.path));
  }

  if (deferredRichTextSection) {
    nextSections.push(deferredRichTextSection);
  }

  if (deferredFeatureGridSection) {
    nextSections.push(deferredFeatureGridSection);
  }

  if (!paymentFacilitiesInserted) {
    const insertionIndex = Math.max(
      1,
      nextSections.findIndex((section) => section.type === CmsPageSectionType.HERO) >= 0
        ? nextSections.findIndex((section) => section.type === CmsPageSectionType.HERO) + 1
        : 0,
    );
    nextSections.splice(insertionIndex, 0, await normalizeMediaFields(deepClone(standardPaymentFacilitiesSection), page.path));
    paymentFacilitiesInserted = true;
  }

  if (rollerProduct && budgetCalculatorSection && !budgetCalculatorInserted) {
    const budgetSection = await normalizeMediaFields(deepClone(budgetCalculatorSection), page.path);
    const paymentIndex = nextSections.findIndex((section) => normalize(section.key) === 'standard-payment-facilities');
    const editorialIndex = nextSections.findIndex((section) => normalize(section.key) === 'roller-editorial-split');
    const insertIndex =
      paymentIndex >= 0
        ? paymentIndex + 1
        : editorialIndex >= 0
          ? editorialIndex + 1
        : Math.max(
            1,
            nextSections.findIndex((section) => section.type === CmsPageSectionType.HERO) >= 0
              ? nextSections.findIndex((section) => section.type === CmsPageSectionType.HERO) + 1
              : nextSections.length,
          );
    nextSections.splice(insertIndex, 0, budgetSection);
    budgetCalculatorInserted = true;
  }

  if (multimediaHubSection && !multimediaHubInserted) {
    nextSections.push(await normalizeMediaFields(deepClone(multimediaHubSection), page.path));
    multimediaHubInserted = true;
  }

  if (budgetCalculatorSection && !budgetCalculatorInserted && !rollerProduct) {
    nextSections.push(await normalizeMediaFields(deepClone(budgetCalculatorSection), page.path));
    budgetCalculatorInserted = true;
  }

  if (!multimediaActionAdded && !rollerProduct) {
    nextSections.push(
      await normalizeMediaFields(
        addMultimediaAction({
        type: CmsPageSectionType.CTA_BANNER,
        key: 'standard-multimedia-cta',
        name: 'Fotos y videos',
        visible: true,
        sortOrder: nextSections.length,
        settings: {
          title: 'Fotos y videos del producto',
          description: 'Accedé al hub multimedia para ver más contenido visual.',
          actions: [{ label: 'Ver fotos y videos', href: '/multimedia' }],
          variant: 'default',
          intent: 'navigation',
        },
        blocks: [],
        }),
        page.path,
      ),
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.cmsPageSection.deleteMany({
      where: { pageId: page.id },
    });

    for (let sectionIndex = 0; sectionIndex < nextSections.length; sectionIndex += 1) {
      const section = nextSections[sectionIndex];
      const createdSection = await tx.cmsPageSection.create({
        data: {
          pageId: page.id,
          type: section.type,
          key: section.key ?? null,
          name: section.name ?? null,
          sortOrder: sectionIndex,
          visible: section.visible ?? true,
          settings: section.settings ?? null,
        },
        select: { id: true },
      });

      for (let blockIndex = 0; blockIndex < (section.blocks ?? []).length; blockIndex += 1) {
        const block = section.blocks[blockIndex];
        await tx.cmsPageBlock.create({
          data: {
            sectionId: createdSection.id,
            type: block.type,
            key: block.key ?? null,
            name: block.name ?? null,
            sortOrder: blockIndex,
            visible: block.visible ?? true,
            content: block.content ?? null,
            mediaId: block.mediaId ?? null,
          },
        });
      }
    }
  });
};

async function main() {
  const pages = await prisma.cmsPage.findMany({
    where: {
      path: {
        in: TARGET_PAGES.map((item) => item.path),
      },
    },
    include: {
      sections: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          blocks: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            include: { media: true },
          },
        },
      },
    },
  });

  const pagesByPath = new Map(pages.map((page) => [normalize(page.path), page]));
  const touched = [];

  for (const target of TARGET_PAGES) {
    const page = pagesByPath.get(normalize(target.path));
    if (!page) {
      continue;
    }

    await writeSnapshot(page);
    await rebuildPage(page, target);
    touched.push(page.path);
  }

  console.log(`[standardize] Updated ${touched.length} product pages`);
  if (touched.length) {
    console.log(`[standardize] ${touched.join(', ')}`);
  }
}

main()
  .catch((error) => {
    console.error('[standardize] Product page standardization failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
