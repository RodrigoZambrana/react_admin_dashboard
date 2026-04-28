import { promises as fs } from 'fs'
import { basename, dirname, extname, join, relative, resolve } from 'path'
import { load } from 'cheerio'
import {
  PrismaClient,
  Prisma,
  CmsEntryStatus,
  CmsMediaType,
  CmsPageBlockType,
  CmsPageScope,
  CmsPageSectionType,
} from '@prisma/client'
import { htmlFragmentToCmsRichTextNodes } from '../src/cms/rich-text'

type LegacyAction = {
  label: string
  href: string
  iconClass: string | null
  external: boolean
}

type LegacyNavItem = {
  label: string
  href?: string
  items?: LegacyNavItem[]
}

type ImportedSection = {
  type: CmsPageSectionType
  key?: string | null
  name?: string | null
  settings?: Record<string, unknown> | null
  blocks?: Array<{
    type: CmsPageBlockType
    key?: string | null
    name?: string | null
    content?: Record<string, unknown> | null
    mediaUrl?: string | null
    mediaAlt?: string | null
    mediaTitle?: string | null
  }>
}

type OrderedImportedSection = ImportedSection & { order: number }

type ImportedPage = {
  path: string
  aliases?: string[]
  title: string
  summary?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  seoImageUrl?: string | null
  legacySource: string
  sections: ImportedSection[]
}

const prisma = new PrismaClient()

const DEFAULT_SITE_ROOT =
  '/Users/rodrigo/git/personal/urucortinas_projects/urucortinas_html_version'

const siteRoot = resolve(process.argv[2] || DEFAULT_SITE_ROOT)
const uploadsRoot = join(process.cwd(), 'uploads', 'cms', 'legacy-assets')
const legacyPageAliasSeeds: Record<string, string[]> = {
  'productos/aberturas-aluminio.html': [
    'aberturas.html',
    'puertas-oblak.html',
    'productos/puertas-oblak.html',
  ],
}

const readFileIfExists = async (value: string) => {
  try {
    return await fs.readFile(value, 'utf8')
  } catch {
    return null
  }
}

const ensureDir = async (path: string) => {
  await fs.mkdir(path, { recursive: true })
}

const normalizeWhitespace = (value: string) =>
  value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const notNull = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined

const stripTags = (value: string) => normalizeWhitespace(value.replace(/<[^>]+>/g, ' '))

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

const normalizePublicPath = (relativeHtmlPath: string) => {
  const normalized = relativeHtmlPath.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase()
  if (normalized === 'index.html') {
    return ''
  }
  return normalized
}

const buildImportedAliases = (relativeHtmlPath: string) => {
  const normalizedPath = normalizePublicPath(relativeHtmlPath)
  const fileName = basename(normalizedPath)
  const derivedAliases = new Set<string>()

  if (normalizedPath.includes('/') && fileName && fileName !== normalizedPath) {
    derivedAliases.add(fileName)
  }

  for (const alias of legacyPageAliasSeeds[normalizedPath] ?? []) {
    const normalizedAlias = normalizePublicPath(alias)
    if (normalizedAlias && normalizedAlias !== normalizedPath) {
      derivedAliases.add(normalizedAlias)
    }
  }

  return Array.from(derivedAliases).sort((left, right) => left.localeCompare(right))
}

const ensureLocalAssetCopied = async (sourcePath: string) => {
  const relativePath = relative(siteRoot, sourcePath).replace(/\\/g, '/')
  const targetPath = join(uploadsRoot, relativePath)
  await ensureDir(dirname(targetPath))
  await fs.copyFile(sourcePath, targetPath)
  return `/uploads/cms/legacy-assets/${relativePath}`
}

const isExternalUrl = (value: string) =>
  /^(https?:\/\/|mailto:|tel:|#)/i.test(value)

const resolveRelativeHref = (sourceFile: string, href: string) => {
  const withoutHash = href.split('#')[0] ?? ''
  const withoutQuery = withoutHash.split('?')[0] ?? ''
  if (!withoutQuery) return href
  if (withoutQuery.startsWith('/')) {
    return resolve(siteRoot, `.${withoutQuery}`)
  }
  return resolve(dirname(sourceFile), withoutQuery)
}

const rewriteLegacyUrl = async (sourceFile: string, rawUrl: string) => {
  const trimmed = rawUrl.trim()
  if (!trimmed) return trimmed
  if (isExternalUrl(trimmed)) {
    return trimmed
  }
  if (/^https?:\/\/www\.urucortinas\.com\.uy/i.test(trimmed)) {
    const relativeUrl = trimmed.replace(/^https?:\/\/www\.urucortinas\.com\.uy\/?/i, '')
    return rewriteLegacyUrl(sourceFile, relativeUrl)
  }

  const absolutePath = resolveRelativeHref(sourceFile, trimmed)
  const normalizedExt = extname(absolutePath).toLowerCase()
  if (normalizedExt === '.html' || normalizedExt === '.htm') {
    const relativeHtmlPath = relative(siteRoot, absolutePath).replace(/\\/g, '/')
    const publicPath = normalizePublicPath(relativeHtmlPath)
    return publicPath ? `/${publicPath}` : '/'
  }

  try {
    const stats = await fs.stat(absolutePath)
    if (stats.isFile()) {
      return ensureLocalAssetCopied(absolutePath)
    }
  } catch {
    return trimmed
  }

  return trimmed
}

const rewriteDocumentUrls = async (sourceFile: string, $: ReturnType<typeof load>) => {
  const elements = $('[src], [href], [poster]').toArray()
  for (const element of elements) {
    const node = $(element)
    for (const attribute of ['src', 'href', 'poster'] as const) {
      const value = node.attr(attribute)
      if (!value) continue
      const nextValue = await rewriteLegacyUrl(sourceFile, value)
      node.attr(attribute, nextValue)
    }
  }
}

const findMetaContent = ($: ReturnType<typeof load>, selector: string) =>
  decodeHtmlEntities(
    $(`meta[name="${selector}"], meta[property="${selector}"]`).attr('content') ?? '',
  )

const findTitle = ($: ReturnType<typeof load>) => normalizeWhitespace($('title').first().text())

const textOf = ($root: ReturnType<typeof load>, selector?: string) =>
  normalizeWhitespace(selector ? $root(selector).first().text() : '')

const textWithin = ($: ReturnType<typeof load>, element: any, selector: string) =>
  normalizeWhitespace($(element).find(selector).first().text())

const htmlWithin = ($: ReturnType<typeof load>, element: any, selector: string) =>
  ($(element).find(selector).first().html() ?? '').trim()

const attrWithin = ($: ReturnType<typeof load>, element: any, selector: string, attribute: string) =>
  ($(element).find(selector).first().attr(attribute) ?? '').trim()

const buildDomOrderMap = ($: ReturnType<typeof load>) => {
  const map = new Map<any, number>()
  $('body *').each((index, element) => {
    map.set(element, index)
  })
  return map
}

const domOrderOf = (map: Map<any, number>, element: any) =>
  map.get(element) ?? Number.MAX_SAFE_INTEGER

const inferActionLabel = (label: string, href: string, iconClass?: string | null) => {
  if (label) return label
  const icon = iconClass ?? ''
  if (icon.includes('facebook')) return 'Facebook'
  if (icon.includes('instagram')) return 'Instagram'
  if (icon.includes('youtube')) return 'YouTube'
  if (/whatsapp/i.test(href)) return 'WhatsApp'
  if (/mailto:/i.test(href)) return 'Email'
  return 'Abrir'
}

const extractActions = ($: ReturnType<typeof load>, element: any): LegacyAction[] => {
  const actions: LegacyAction[] = []
  const seen = new Set<string>()
  $(element)
    .find('a[href]')
    .toArray()
    .forEach((anchor) => {
      const node = $(anchor)
      const href = (node.attr('href') ?? '').trim()
      if (!href || href === '#') return
      const iconClass = node.find('i').attr('class') ?? null
      const label = inferActionLabel(normalizeWhitespace(node.text()), href, iconClass)
      const key = `${label}::${href}`
      if (seen.has(key)) return
      seen.add(key)
      actions.push({
        label,
        href,
        iconClass,
        external: /^https?:\/\//i.test(href),
      })
    })
  return actions
}

const collectSectionHeader = ($: ReturnType<typeof load>, element: any) => {
  const header = $(element).find('.section-header').first()
  if (header.length) {
    return {
      title:
        normalizeWhitespace(header.find('h1, h2, h3').first().text()) ||
        normalizeWhitespace($(element).find('h1, h2, h3').first().text()),
      description: normalizeWhitespace(header.find('p').first().text()),
    }
  }

  return {
    title: normalizeWhitespace($(element).find('h1, h2, h3').first().text()),
    description: normalizeWhitespace($(element).find('p').first().text()),
  }
}

const isMeaningfulHtml = (html: string) =>
  stripTags(html).length > 20 || /<(img|table|ul|ol|blockquote|iframe|video)\b/i.test(html)

const removeContainerAround = ($: ReturnType<typeof load>, element: any) => {
  const parent = $(element).parent()
  if (parent.length === 1 && parent.children().length === 1) {
    parent.remove()
    return
  }
  $(element).remove()
}

const parseNavItem = ($: ReturnType<typeof load>, element: any): LegacyNavItem | null => {
  const node = $(element)
  const anchor = node.is('a') ? node : node.children('a').first()
  const label = normalizeWhitespace(anchor.text())
  const href = (anchor.attr('href') ?? '').trim()
  const children = node
    .children('.dropdown-menu')
    .find('a')
    .toArray()
    .map((child) => ({
      label: normalizeWhitespace($(child).text()),
      href: ($(child).attr('href') ?? '').trim(),
    }))
    .filter((item) => item.label)

  if (!label) return null

  if (children.length) {
    return {
      label,
      items: children,
    }
  }

  return {
    label,
    href: href || undefined,
  }
}

const extractHeaderSection = (
  $: ReturnType<typeof load>,
  orderMap: Map<any, number>,
): OrderedImportedSection | null => {
  const navBar = $('.nav-bar').first()
  if (!navBar.length) return null

  const topBar = $('.top-bar').first()
  const brand = navBar.find('.navbar-brand').first()
  const navItems = navBar
    .find('.navbar-nav')
    .first()
    .children()
    .toArray()
    .map((element) => parseNavItem($, element))
    .filter((item): item is LegacyNavItem => Boolean(item))

  const topbarContacts = topBar.length
    ? topBar
        .find('.top-bar-item')
        .toArray()
        .map((element) => {
          const node = $(element)
          const title = normalizeWhitespace(node.find('h3').first().text())
          const link = node.find('a').first()
          const href = (link.attr('href') ?? '').trim()
          const value = normalizeWhitespace(link.text()) || normalizeWhitespace(node.find('p').first().text())
          const iconClass = node.find('i').attr('class') ?? null
          return title || value
            ? {
                title,
                value,
                href: href || null,
                iconClass,
              }
            : null
        })
        .filter(notNull)
    : []

  const floatingAnchor = $('a[href*="api.whatsapp.com"]')
    .filter((_, element) => $(element).find('img[style*="position: fixed"]').length > 0)
    .first()

  const floatingImage = floatingAnchor.find('img').first()
  const floatingContact =
    floatingAnchor.length && floatingImage.length
      ? {
          label: 'WhatsApp',
          href: (floatingAnchor.attr('href') ?? '').trim(),
          imageUrl: (floatingImage.attr('src') ?? '').trim(),
          imageAlt: (floatingImage.attr('alt') ?? '').trim() || 'WhatsApp',
        }
      : null

  if (floatingAnchor.length) {
    const wrapper = floatingAnchor.closest('p')
    if (wrapper.length) wrapper.remove()
  }

  const brandImage = brand.find('img').first()
  const brandLabel = normalizeWhitespace(brand.text()) || (brandImage.attr('alt') ?? '').trim()
  const normalizedBrandLabel = brandLabel.toLowerCase() === 'menu' ? '' : brandLabel

  const order = Math.min(
    domOrderOf(orderMap, topBar.get(0)),
    domOrderOf(orderMap, navBar.get(0)),
  )

  topBar.remove()
  navBar.remove()

  return {
    order,
    type: CmsPageSectionType.SITE_HEADER,
      key: 'site-header',
      name: 'Header del sitio',
      settings: {
      brandLabel: normalizedBrandLabel,
      brandHref: (brand.attr('href') ?? '/').trim() || '/',
      navigationMode: 'grouped',
      navigationGroupLabel: 'Información',
      topbarContacts,
      items: navItems,
      floatingContact,
    },
    blocks: [],
  }
}

const extractFooterSection = (
  $: ReturnType<typeof load>,
  orderMap: Map<any, number>,
): OrderedImportedSection | null => {
  const footer = $('.footer').first()
  if (!footer.length) return null

  const footerContact = footer.find('.footer-contact').first()
  const contacts = footerContact
    .find('p')
    .toArray()
    .map((element) => {
      const node = $(element)
      const iconClass = node.find('i').attr('class') ?? null
      const value = normalizeWhitespace(node.text())
      return value ? { value, iconClass } : null
    })
    .filter(notNull)

  const socials = footer
    .find('.footer-social a[href]')
    .toArray()
    .map((element) => {
      const node = $(element)
      const href = (node.attr('href') ?? '').trim()
      const iconClass = node.find('i').attr('class') ?? null
      const label = inferActionLabel(normalizeWhitespace(node.text()), href, iconClass)
      return href ? { label, href, iconClass, external: /^https?:\/\//i.test(href) } : null
    })
    .filter(notNull)

  const order = domOrderOf(orderMap, footer.get(0))
  footer.remove()

  return {
    order,
    type: CmsPageSectionType.SITE_FOOTER,
    key: 'site-footer',
    name: 'Footer del sitio',
    settings: {
      title: normalizeWhitespace(footerContact.find('h2').first().text()) || 'Contacto',
      contacts,
      socials,
      linkGroups: [],
    },
    blocks: [],
  }
}

const extractHeroSection = async (
  $: ReturnType<typeof load>,
  orderMap: Map<any, number>,
  sourceFile: string,
): Promise<OrderedImportedSection | null> => {
  const intro = $('#intro').first()
  if (!intro.length) return null

  const slides = intro
    .find('.carousel-inner .carousel-item')
    .toArray()
    .map((element, index) => {
      const node = $(element)
      const image = node.find('img').first()
      const cta = node.find('a[href]').first()
      const title = normalizeWhitespace(node.find('h1, h2, h3').first().text())
      const description = normalizeWhitespace(node.find('p').first().text())
      return {
        title,
        description,
        imageUrl: (image.attr('src') ?? '').trim(),
        imageAlt: (image.attr('alt') ?? '').trim() || title,
        href: (cta.attr('href') ?? '').trim(),
        linkLabel: normalizeWhitespace(cta.text()),
      }
    })
    .filter((slide) => slide.title || slide.description || slide.imageUrl || slide.href)

  const firstSlide = slides[0]
  const order = domOrderOf(orderMap, intro.get(0))
  const ogImage = findMetaContent($, 'og:image')
  const heroImageUrl = ogImage ? await rewriteLegacyUrl(sourceFile, ogImage) : firstSlide?.imageUrl ?? ''

  intro.remove()

  return {
    order,
    type: CmsPageSectionType.HERO,
    key: 'hero',
    name: 'Hero',
    settings: {
      eyebrow: '',
      title: firstSlide?.title || '',
      description: firstSlide?.description || '',
      primaryCtaLabel: firstSlide?.linkLabel || '',
      primaryCtaHref: firstSlide?.href || '',
      secondaryCtaLabel: '',
      secondaryCtaHref: '',
      backgroundImageUrl: firstSlide?.imageUrl || heroImageUrl,
      slides,
    },
    blocks: [],
  }
}

const extractFeatureGridSections = (
  $: ReturnType<typeof load>,
  orderMap: Map<any, number>,
): OrderedImportedSection[] => {
  const sections: OrderedImportedSection[] = []

  const teamSection = $('section#team').first()
  if (teamSection.length) {
    const header = collectSectionHeader($, teamSection)
    const blocks = teamSection
      .find('.member')
      .toArray()
      .map((element, index) => {
        const node = $(element)
        const image = node.find('img').first()
        const link = node.find('a[href]').first()
        const title = normalizeWhitespace(node.find('h4').first().text())
        const body = normalizeWhitespace(node.find('p').first().text())
        return {
          type: CmsPageBlockType.CARD,
          key: `feature-${index + 1}`,
          name: title || null,
          mediaUrl: (image.attr('src') ?? '').trim() || null,
          mediaAlt: (image.attr('alt') ?? '').trim() || title,
          content: {
            title,
            body,
            href: (link.attr('href') ?? '').trim(),
            linkLabel: normalizeWhitespace(link.text()),
          },
        }
      })
      .filter((item) => item.mediaUrl || item.content.title || item.content.body || item.content.href)

    sections.push({
      order: domOrderOf(orderMap, teamSection.get(0)),
      type: CmsPageSectionType.FEATURE_GRID,
      key: 'portfolio-grid',
      name: header.title || null,
      settings: {
        title: header.title,
        description: header.description,
        variant: 'portfolio',
      },
      blocks,
    })

    teamSection.remove()
  }

  const servicesSection = $('section#services').first()
  if (servicesSection.length) {
    const header = collectSectionHeader($, servicesSection)
    const blocks = servicesSection
      .find('.box')
      .toArray()
      .map((element, index) => {
        const node = $(element)
        const title = normalizeWhitespace(node.find('.title').first().text())
        const bodyHtml = htmlWithin($, element, '.description') || htmlWithin($, element, 'ul')
        const href = (node.find('.title a').first().attr('href') ?? '').trim()
        return {
          type: CmsPageBlockType.CARD,
          key: `service-${index + 1}`,
          name: title || null,
          content: {
            title,
            body: stripTags(bodyHtml),
            richText: bodyHtml ? htmlFragmentToCmsRichTextNodes(bodyHtml) : [],
            href,
            linkLabel: normalizeWhitespace(node.find('.title a').first().text()),
            iconClass: node.find('.icon i').attr('class') ?? '',
          },
        }
      })
      .filter((item) => item.content.title || item.content.body || item.content.href || item.content.iconClass)

    sections.push({
      order: domOrderOf(orderMap, servicesSection.get(0)),
      type: CmsPageSectionType.FEATURE_GRID,
      key: 'services-grid',
      name: header.title || null,
      settings: {
        title: header.title,
        description: header.description,
        variant: 'services',
      },
      blocks,
    })

    servicesSection.remove()
  }

  const contactInfoSection = $('section.contact')
    .filter((_, element) => $(element).find('.contact-item').length > 0)
    .first()

  if (contactInfoSection.length) {
    const header = collectSectionHeader($, contactInfoSection)
    const blocks = contactInfoSection
      .find('.contact-item')
      .toArray()
      .map((element, index) => {
        const node = $(element)
        const title = normalizeWhitespace(node.find('.contact-text h3').first().text())
        const bodyHtml = htmlWithin($, element, '.contact-text')
        return {
          type: CmsPageBlockType.CARD,
          key: `contact-${index + 1}`,
          name: title || null,
          content: {
            title,
            body: stripTags(bodyHtml),
            richText: bodyHtml ? htmlFragmentToCmsRichTextNodes(bodyHtml) : [],
            iconClass: node.find('.contact-icon i').attr('class') ?? '',
          },
        }
      })
      .filter((item) => item.content.title || item.content.body || item.content.iconClass)

    sections.push({
      order: domOrderOf(orderMap, contactInfoSection.get(0)),
      type: CmsPageSectionType.FEATURE_GRID,
      key: 'contact-grid',
      name: header.title || null,
      settings: {
        title: header.title,
        description: header.description,
        variant: 'contact',
      },
      blocks,
    })

    contactInfoSection.remove()
  }

  return sections
}

const extractContentSplitSections = (
  $: ReturnType<typeof load>,
  orderMap: Map<any, number>,
): OrderedImportedSection[] => {
  const sections: OrderedImportedSection[] = []

  $('section')
    .toArray()
    .forEach((element, index) => {
      const node = $(element)
      if (node.attr('id') === 'intro') {
        return
      }

      const row = node.find('> .container > .row').first()
      if (!row.length) {
        return
      }

      const carousel = row.find('.carousel.slide').first()
      const image = row.find('.about-img img').first()
      const contentColumns = row
        .children()
        .toArray()
        .filter((column) => $(column).hasClass('content'))

      if (!contentColumns.length || (!carousel.length && !image.length)) {
        return
      }

      const richText = contentColumns.flatMap((column) =>
        htmlFragmentToCmsRichTextNodes($(column).html() ?? ''),
      )

      const gallery = carousel.length
        ? carousel
            .find('.carousel-item')
            .toArray()
            .map((slideElement) => {
              const slide = $(slideElement)
              const slideImage = slide.find('img').first()
              const slideLink = slide.find('a[href]').first()
              return {
                imageUrl: (slideImage.attr('src') ?? '').trim(),
                imageAlt: (slideImage.attr('alt') ?? '').trim(),
                href: (slideLink.attr('href') ?? '').trim(),
                linkLabel: normalizeWhitespace(slideLink.text()),
              }
            })
            .filter(
              (item) => item.imageUrl || item.imageAlt || item.href || item.linkLabel,
            )
        : []

      const sectionSettings: Record<string, unknown> = {
        title: '',
        description: '',
        variant: carousel.length ? 'media-gallery-content' : 'image-content',
        mediaPosition: 'start',
        imageUrl: image.length ? (image.attr('src') ?? '').trim() : '',
        imageAlt: image.length ? (image.attr('alt') ?? '').trim() : '',
        gallery,
      }

      sections.push({
        order: domOrderOf(orderMap, element),
        type: CmsPageSectionType.CONTENT_SPLIT,
        key: `content-split-${index + 1}`,
        name: null,
        settings: sectionSettings,
        blocks: richText.length
          ? [
              {
                type: CmsPageBlockType.RICH_TEXT,
                key: `content-split-body-${index + 1}`,
                name: null,
                content: {
                  richText,
                },
              },
            ]
          : [],
      })

      node.remove()
    })

  return sections
}

const extractCtaSections = (
  $: ReturnType<typeof load>,
  orderMap: Map<any, number>,
): OrderedImportedSection[] => {
  const sections: OrderedImportedSection[] = []

  $('section#call-to-action, section#contact')
    .toArray()
    .forEach((element, index) => {
      const node = $(element)
      if (node.find('.contact-item').length > 0) {
        return
      }

      const title =
        normalizeWhitespace(node.find('.cta-title').first().text()) ||
        normalizeWhitespace(node.find('.section-header h2').first().text())
      const description =
        normalizeWhitespace(node.find('.cta-text').first().text()) ||
        normalizeWhitespace(node.find('.section-header p').first().text())
      const actions = extractActions($, element)

      if (!title && !description && !actions.length) {
        return
      }

      sections.push({
        order: domOrderOf(orderMap, element),
        type: CmsPageSectionType.CTA_BANNER,
        key: `cta-${index + 1}`,
        name: title || null,
        settings: {
          title,
          description,
          actions,
          variant: actions.every((action) => action.iconClass) ? 'social' : 'default',
        },
        blocks: [],
      })

      node.remove()
    })

  return sections
}

const extractFaqSection = (
  $: ReturnType<typeof load>,
  orderMap: Map<any, number>,
): OrderedImportedSection | null => {
  const faqSection = $('section#faqs').first()
  if (!faqSection.length) return null

  const header = collectSectionHeader($, faqSection)
  const blocks = faqSection
    .find('.card')
    .toArray()
      .map((element, index) => {
        const node = $(element)
        const question = normalizeWhitespace(node.find('.card-header').first().text())
        const answer = (node.find('.card-body').first().html() ?? '').trim()
        if (!question || !answer) return null
      return {
        type: CmsPageBlockType.FAQ_ITEM,
        key: `faq-${index + 1}`,
        name: question,
        content: {
          question,
          answerRichText: htmlFragmentToCmsRichTextNodes(answer),
        },
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const section: OrderedImportedSection = {
    order: domOrderOf(orderMap, faqSection.get(0)),
    type: CmsPageSectionType.FAQ,
    key: 'faq',
    name: header.title || null,
    settings: {
      title: header.title,
      description: header.description,
    },
    blocks,
  }

  faqSection.remove()
  return section
}

const extractMediaCarouselSections = (
  $: ReturnType<typeof load>,
  orderMap: Map<any, number>,
): OrderedImportedSection[] => {
  const sections: OrderedImportedSection[] = []

  $('.carousel.slide')
    .toArray()
    .forEach((element, index) => {
      const node = $(element)
      if (node.parents('#intro').length > 0) return

      const enclosingSection = node.closest('section')
      const sectionHeader = collectSectionHeader($, enclosingSection)
      const title =
        sectionHeader.title ||
        normalizeWhitespace(enclosingSection.find('h1, h2, h3').first().text())

      const blocks = node
        .find('.carousel-inner .carousel-item')
        .toArray()
        .map((slideElement, slideIndex) => {
          const slide = $(slideElement)
          const image = slide.find('img').first()
          const link = slide.find('a[href]').first()
          const slideTitle =
            normalizeWhitespace(slide.find('h1, h2, h3').first().text()) ||
            (image.attr('alt') ?? '').trim()
          return {
            type: CmsPageBlockType.CARD,
            key: `carousel-${index + 1}-${slideIndex + 1}`,
            name: slideTitle,
            mediaUrl: (image.attr('src') ?? '').trim() || null,
            mediaAlt: (image.attr('alt') ?? '').trim() || slideTitle,
            content: {
              title: slideTitle,
              description: normalizeWhitespace(slide.find('p').first().text()),
              href: (link.attr('href') ?? '').trim(),
              linkLabel: normalizeWhitespace(link.text()),
            },
          }
        })
        .filter((item) => item.mediaUrl || item.content?.title)

      if (!blocks.length) return

      sections.push({
        order: domOrderOf(orderMap, element),
        type: CmsPageSectionType.MEDIA_CAROUSEL,
        key: `media-carousel-${index + 1}`,
        name: title || null,
        settings: {
          title,
          description: sectionHeader.description,
          variant: 'gallery',
        },
        blocks,
      })

      removeContainerAround($, element)
    })

  $('.owl-carousel')
    .toArray()
    .forEach((element, index) => {
      const node = $(element)
      const enclosingSection = node.closest('section')
      const sectionHeader = collectSectionHeader($, enclosingSection)
      const isClients = node.hasClass('clients-carousel')
      const blocks = isClients
        ? node
            .find('img')
            .toArray()
            .map((imageElement, imageIndex) => {
              const image = $(imageElement)
              const title = (image.attr('alt') ?? '').trim()
              return {
                type: CmsPageBlockType.CARD,
                key: `logo-${index + 1}-${imageIndex + 1}`,
                name: title,
                mediaUrl: (image.attr('src') ?? '').trim() || null,
                mediaAlt: title,
                content: {
                  title,
                },
              }
            })
        : node
            .find('.testimonial-item')
            .toArray()
            .map((cardElement, cardIndex) => {
              const card = $(cardElement)
              const image = card.find('img').first()
              const link = card.find('a[href]').first()
              const title = normalizeWhitespace(card.find('h1, h2, h3').first().text())
              return {
                type: CmsPageBlockType.CARD,
                key: `card-${index + 1}-${cardIndex + 1}`,
                name: title,
                mediaUrl: (image.attr('src') ?? '').trim() || null,
                mediaAlt: (image.attr('alt') ?? '').trim() || title,
                content: {
                  title,
                  description: normalizeWhitespace(card.find('p').first().text()),
                  href: (link.attr('href') ?? '').trim(),
                  linkLabel: normalizeWhitespace(link.text()),
                },
              }
            })

      if (!blocks.length) return

      sections.push({
        order: domOrderOf(orderMap, element),
        type: CmsPageSectionType.MEDIA_CAROUSEL,
        key: `owl-carousel-${index + 1}`,
        name: sectionHeader.title || null,
        settings: {
          title: sectionHeader.title,
          description: sectionHeader.description,
          variant: isClients ? 'logos' : 'cards',
        },
        blocks,
      })

      enclosingSection.remove()
    })

  return sections
}

const buildRichTextSection = (
  $: ReturnType<typeof load>,
  orderMap: Map<any, number>,
): OrderedImportedSection | null => {
  $('script, style, noscript, a.back-to-top').remove()

  const main = $('main').first()
  const target = main.length ? main : $('body')
  const html = (target.html() ?? '').trim()
  if (!isMeaningfulHtml(html)) return null

  return {
    order: domOrderOf(orderMap, main.get(0) ?? $('body').get(0)),
    type: CmsPageSectionType.RICH_TEXT,
    key: 'content',
    name: null,
    settings: {
      title: '',
      description: '',
    },
    blocks: [
      {
        type: CmsPageBlockType.RICH_TEXT,
        key: 'main-html',
        name: null,
        content: {
          richText: htmlFragmentToCmsRichTextNodes(html),
        },
      },
    ],
  }
}

const buildPageSections = async (
  sourceFile: string,
  fullHtml: string,
): Promise<ImportedSection[]> => {
  const $ = load(fullHtml)
  await rewriteDocumentUrls(sourceFile, $)
  const orderMap = buildDomOrderMap($)
  const sections: OrderedImportedSection[] = []

  const headerSection = extractHeaderSection($, orderMap)
  if (headerSection) sections.push(headerSection)

  const heroSection = await extractHeroSection($, orderMap, sourceFile)
  if (heroSection) sections.push(heroSection)

  sections.push(...extractCtaSections($, orderMap))
  sections.push(...extractContentSplitSections($, orderMap))
  sections.push(...extractFeatureGridSections($, orderMap))
  sections.push(...extractMediaCarouselSections($, orderMap))

  const faqSection = extractFaqSection($, orderMap)
  if (faqSection) sections.push(faqSection)

  const richTextSection = buildRichTextSection($, orderMap)
  if (richTextSection) sections.push(richTextSection)

  const footerSection = extractFooterSection($, orderMap)
  if (footerSection) sections.push(footerSection)

  return sections
    .sort((left, right) => left.order - right.order)
    .map(({ order, ...section }) => section)
}

const listHtmlFiles = async (root: string): Promise<string[]> => {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(root, entry.name)
      if (entry.isDirectory()) {
        return listHtmlFiles(fullPath)
      }
      if (entry.isFile() && ['.html', '.htm'].includes(extname(entry.name).toLowerCase())) {
        return [fullPath]
      }
      return []
    }),
  )
  return nested.flat()
}

const findOrCreateMedia = async (url: string, alt?: string | null, title?: string | null) => {
  const existing = await prisma.cmsMedia.findFirst({
    where: { url },
    select: { id: true },
  })
  if (existing) {
    return existing.id
  }
  const media = await prisma.cmsMedia.create({
    data: {
      url,
      type: CmsMediaType.IMAGE,
      alt: alt?.trim() || null,
      title: title?.trim() || null,
      source: 'legacy_html_import',
      isActive: true,
    },
    select: { id: true },
  })
  return media.id
}

const upsertImportedPage = async (page: ImportedPage) => {
  const existing = await prisma.cmsPage.findFirst({
    where: { path: page.path },
    select: { id: true },
  })

  const pageRecord = existing
    ? await prisma.cmsPage.update({
        where: { id: existing.id },
        data: {
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
          legacySource: page.legacySource,
        },
        select: { id: true },
      })
    : await prisma.cmsPage.create({
        data: {
          path: page.path,
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
          legacySource: page.legacySource,
        },
        select: { id: true },
      })

  await prisma.cmsPageAlias.deleteMany({ where: { pageId: pageRecord.id } })
  if (page.aliases?.length) {
    await prisma.cmsPageAlias.createMany({
      data: page.aliases.map((path) => ({
        pageId: pageRecord.id,
        path,
      })),
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
        settings:
          section.settings === undefined || section.settings === null
            ? Prisma.JsonNull
            : (section.settings as Prisma.InputJsonValue),
      },
      select: { id: true },
    })

    for (let blockIndex = 0; blockIndex < (section.blocks ?? []).length; blockIndex += 1) {
      const block = section.blocks?.[blockIndex]
      if (!block) continue
      const mediaId = block.mediaUrl
        ? await findOrCreateMedia(block.mediaUrl, block.mediaAlt, block.mediaTitle)
        : null
      await prisma.cmsPageBlock.create({
        data: {
          sectionId: createdSection.id,
          type: block.type,
          key: block.key ?? null,
          name: block.name ?? null,
          sortOrder: blockIndex,
          visible: true,
          content:
            block.content === undefined || block.content === null
              ? Prisma.JsonNull
              : (block.content as Prisma.InputJsonValue),
          mediaId,
        },
      })
    }
  }
}

const main = async () => {
  await ensureDir(uploadsRoot)

  const htmlFiles = await listHtmlFiles(siteRoot)
  console.log(`[cms-import] HTML files found: ${htmlFiles.length}`)

  for (const htmlFile of htmlFiles) {
    const html = await readFileIfExists(htmlFile)
    if (!html) continue

    const $ = load(html)
    const relativeHtmlPath = relative(siteRoot, htmlFile).replace(/\\/g, '/')
    const publicPath = normalizePublicPath(relativeHtmlPath)
    const title = findTitle($) || basename(htmlFile, extname(htmlFile))
    const description = findMetaContent($, 'description')

    const page: ImportedPage = {
      path: publicPath,
      aliases: buildImportedAliases(relativeHtmlPath),
      title,
      summary: description || null,
      seoTitle: findMetaContent($, 'og:title') || title,
      seoDescription: findMetaContent($, 'og:description') || description || null,
      seoImageUrl: findMetaContent($, 'og:image') || null,
      legacySource: htmlFile,
      sections: await buildPageSections(htmlFile, html),
    }

    await upsertImportedPage(page)
    console.log(`[cms-import] imported ${publicPath || '/'}`)
  }
}

main()
  .catch((error) => {
    console.error('[cms-import] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
