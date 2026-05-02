const fs = require('fs/promises');
const path = require('path');
const {
  PrismaClient,
  CmsMediaType,
  CmsPageBlockType,
  CmsPageSectionType,
} = require('@prisma/client');

const prisma = new PrismaClient();

const VIDEO_SAMPLE_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
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
    ensureTopHero: true,
    moveFeatureGridAfterGallery: true,
  },
  'productos/cortinas-roller.html': {
    editorialGallerySplit: true,
    removeBudgetCalculator: true,
    removeMediaCarousel: true,
    ensureTopHero: true,
  },
  'productos/bandas-verticales.html': {
    ensureTopHero: true,
  },
  'productos/venecianas.html': {
    ensureTopHero: true,
  },
  'productos/aberturas-aluminio.html': {
    ensureTopHero: true,
  },
  'productos/toldos-y-cerramientos.html': {
    ensureTopHero: true,
  },
  'productos/motores-cortinas-y-persianas.html': {
    ensureTopHero: true,
  },
  'productos/cortinas-metalicas.html': {
    ensureTopHero: true,
  },
};

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

const resolvePosterUrl = (page) => {
  if (page.seoImageUrl) return page.seoImageUrl;
  for (const section of page.sections) {
    for (const block of section.blocks ?? []) {
      if (block.media?.url) return block.media.url;
    }
  }
  return page.sections.find((section) => section.type === CmsPageSectionType.HERO)?.blocks?.[0]?.media?.url ?? null;
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

const buildGallerySection = async (page, galleryUrls) => {
  if (!galleryUrls?.length) return null;

  const title = `Fotos de ${page.title}`;
  const description = 'Galería visual para revisar terminaciones, escala y contexto de uso.';
  const blocks = [];

  for (let index = 0; index < galleryUrls.length; index += 1) {
    const mediaUrl = await resolveCanonicalMediaUrl(galleryUrls[index], page.path);
    const mediaId = await ensureMedia(mediaUrl, `${page.title} foto ${index + 1}`, `${page.title} foto ${index + 1}`);
    blocks.push({
      type: CmsPageBlockType.CARD,
      key: `standard-gallery-${index + 1}`,
      name: `${page.title} foto ${index + 1}`,
      sortOrder: index,
      visible: true,
      mediaId,
      content: {
        title: index === 0 ? 'Foto principal' : `Foto ${index + 1}`,
        description: 'Material visual de apoyo para decidir con más contexto.',
        badge: index === 0 ? 'Fotos' : 'Detalle',
        overlayText: true,
        href: '/multimedia',
        linkLabel: 'Ver multimedia',
      },
    });
  }

  return {
    type: CmsPageSectionType.MEDIA_CAROUSEL,
    key: 'standard-media-carousel',
    name: 'Fotos y referencias',
    visible: true,
    sortOrder: 0,
    settings: {
      title,
      description,
      variant: 'gallery',
      slidesToShow: 1,
      autoplay: false,
    },
    blocks,
  };
};

const buildVideoSection = async (page, posterUrl) => {
  const canonicalPosterUrl = posterUrl ? await resolveCanonicalMediaUrl(posterUrl, page.path) : null;
  const mediaId = await ensureMedia(
    VIDEO_SAMPLE_URL,
    `${page.title} video`,
    `${page.title} en video`,
    CmsMediaType.VIDEO,
  );

  return {
    type: CmsPageSectionType.VIDEO_SECTION,
    key: 'standard-video-section',
    name: 'Video del producto',
    visible: true,
    sortOrder: 0,
    settings: {
      title: `Video de ${page.title}`,
      description: 'Una demostración breve para complementar la lectura visual.',
      layout: 'contained',
      autoplay: false,
      controls: true,
    },
    blocks: [
      {
        type: CmsPageBlockType.CARD,
        key: 'standard-video',
        name: 'Video',
        sortOrder: 0,
        visible: true,
        mediaId,
        content: {
          title: `Video de ${page.title}`,
          description: 'Contenido audiovisual de apoyo para entender el producto en uso.',
          posterUrl: canonicalPosterUrl || null,
          mediaType: 'video',
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
  const posterUrl = resolvePosterUrl(page);
  const layoutOverride = PAGE_LAYOUT_OVERRIDES[normalize(page.path)] ?? {};
  const hasCarousel = page.sections.some((section) => section.type === CmsPageSectionType.MEDIA_CAROUSEL);
  const hasVideo = page.sections.some((section) => section.type === CmsPageSectionType.VIDEO_SECTION);
  const hasHero = page.sections.some((section) => section.type === CmsPageSectionType.HERO);
  const gallerySection =
    !layoutOverride.galleryAsContentSplit && !hasCarousel ? await buildGallerySection(page, target.gallery) : null;
  const videoSection = hasVideo ? null : await buildVideoSection(page, posterUrl);
  const editorialGallerySplit = layoutOverride.editorialGallerySplit ? await buildEditorialGallerySplit(page) : null;
  let multimediaActionAdded = false;
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

    if (layoutOverride.removeBudgetCalculator && normalizedSection.type === CmsPageSectionType.BUDGET_CALCULATOR) {
      if (editorialGallerySplit) {
        nextSections.push(await normalizeMediaFields(deepClone(editorialGallerySplit), page.path));
      }
      continue;
    }

    if (layoutOverride.editorialGallerySplit && normalizedSection.type === CmsPageSectionType.RICH_TEXT) {
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
      nextSections.push(addMultimediaAction(normalizedSection));
      multimediaActionAdded = true;
      continue;
    }

    if (layoutOverride.removeMediaCarousel && normalizedSection.type === CmsPageSectionType.MEDIA_CAROUSEL) {
      continue;
    }

    if (
      gallerySection &&
      !nextSections.some((item) => item.type === CmsPageSectionType.MEDIA_CAROUSEL) &&
      (normalizedSection.type === CmsPageSectionType.CTA_BANNER ||
        normalizedSection.type === CmsPageSectionType.SITE_FOOTER)
    ) {
      nextSections.push(await normalizeMediaFields(deepClone(gallerySection), page.path));
    }

    if (
      videoSection &&
      !nextSections.some((item) => item.type === CmsPageSectionType.VIDEO_SECTION) &&
      (normalizedSection.type === CmsPageSectionType.CTA_BANNER ||
        normalizedSection.type === CmsPageSectionType.SITE_FOOTER)
    ) {
      nextSections.push(await normalizeMediaFields(deepClone(videoSection), page.path));
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

  if (gallerySection && !nextSections.some((item) => item.type === CmsPageSectionType.MEDIA_CAROUSEL)) {
    nextSections.push(await normalizeMediaFields(deepClone(gallerySection), page.path));
  }

  if (videoSection && !nextSections.some((item) => item.type === CmsPageSectionType.VIDEO_SECTION)) {
    nextSections.push(await normalizeMediaFields(deepClone(videoSection), page.path));
  }

  if (!multimediaActionAdded) {
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
