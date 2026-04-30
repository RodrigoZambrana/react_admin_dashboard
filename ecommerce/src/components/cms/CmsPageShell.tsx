"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, type CSSProperties, type ReactElement } from "react";
import Container from "@component/Container";
import Card from "@component/Card";
import Grid from "@component/grid/Grid";
import { Carousel } from "@component/carousel";
import NextImage from "@/components/NextImage";
import Topbar from "@component/topbar";
import { Header } from "@component/header";
import Navbar from "@component/navbar/Navbar";
import { Footer1 } from "@component/footer";
import MobileNavigationBar from "@component/mobile-navigation";
import SectionStories from "@sections/market-1/SectionStories";
import SectionCmsHighlights from "@sections/market-1/SectionCmsHighlights";
import BudgetCalculatorPanel from "@/components/budget/BudgetCalculatorPanel";
import { ProductCard1 } from "@component/product-cards";
import type {
  CmsContentSection,
  CmsRenderableMedia,
  CmsRenderablePage,
  CmsRenderableSection,
} from "@/types/storefront";
import { renderCmsRichTextContent } from "./rich-text";
import styles from "./CmsPageShell.module.css";

const StoriesModal = dynamic(() => import("./StoriesModal"), { ssr: false });

type Props = {
  page: CmsRenderablePage;
  homeContentSections?: CmsContentSection[] | null;
};

export type CmsPageBodyProps = {
  page: CmsRenderablePage;
};

type ActionLink = {
  label: string;
  href: string;
  external?: boolean;
};

type HeadingTag = "h1" | "h2" | "h3" | "h4";

const asRecord = (value: Record<string, unknown> | null | undefined) => value ?? {};

const asString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "";

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const resolveHeadingTag = (value: unknown, fallback: HeadingTag): HeadingTag => {
  const normalized = asString(value).toLowerCase();
  return normalized === "h1" || normalized === "h2" || normalized === "h3" || normalized === "h4"
    ? normalized
    : fallback;
};

const deriveBudgetSlugFromPath = (path: string) => {
  const normalized = path.trim().replace(/^\/+|\/+$/g, "");
  if (!normalized) return null;
  const leaf = normalized.split("/").filter(Boolean).pop() ?? "";
  if (!leaf) return null;
  return leaf.replace(/\.html?$/i, "").trim() || null;
};

const PRODUCT_CAROUSEL_RESPONSIVE = [
  { breakpoint: 1279, settings: { slidesToShow: 4 } },
  { breakpoint: 959, settings: { slidesToShow: 3 } },
  { breakpoint: 650, settings: { slidesToShow: 2 } },
  { breakpoint: 500, settings: { slidesToShow: 1 } },
];

const asActions = (value: unknown): ActionLink[] =>
  asArray<Record<string, unknown>>(value)
    .map((item) => ({
      label: asString(item.label),
      href: asString(item.href),
      external: Boolean(item.external),
    }))
    .filter((item) => item.label && item.href);

const pickMediaUrl = (media?: CmsRenderableMedia | null) => media?.url ?? "";

const readActionLink = (value: unknown): ActionLink | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const label = asString(record.label) || asString(record.text);
  const href = asString(record.href) || asString(record.url) || asString(record.link);
  if (!label || !href) return null;
  return {
    label,
    href,
    external: asBoolean(record.external, false),
  };
};

const readMediaType = (value: unknown, fallback: "image" | "video" = "image") => {
  const normalized = asString(value).toLowerCase();
  if (normalized.includes("video")) return "video";
  if (normalized.includes("image")) return "image";
  return fallback;
};

const normalizeDurationMs = (value: unknown, fallback: number) => {
  const raw = asNumber(value, Number.NaN);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return raw > 1000 ? Math.round(raw) : Math.round(raw * 1000);
};

const readMediaDuration = (value: unknown, fallback: number) => {
  return normalizeDurationMs(value, fallback);
};

const normalizeOverlayOpacity = (value: unknown, fallback = 0.55) => {
  const raw = asNumber(value, fallback);
  if (raw > 1) return Math.min(0.95, Math.max(0, raw / 100));
  return Math.min(0.95, Math.max(0, raw));
};

const isExternalUrl = (href: string) => /^(https?:\/\/|mailto:|tel:)/i.test(href);

const renderLink = (
  label: string,
  href: string,
  className: string,
  options?: { external?: boolean; key?: string },
) => {
  if (!label || !href) return null;
  const external = options?.external ?? isExternalUrl(href);

  if (external) {
    return (
      <a className={className} href={href} key={options?.key} rel="noreferrer" target="_blank">
        {label}
      </a>
    );
  }

  return (
    <Link className={className} href={href} key={options?.key}>
      {label}
    </Link>
  );
};

const renderHeading = (section: CmsRenderableSection, fallback: HeadingTag = "h2") => {
  const settings = asRecord(section.settings);
  const title = asString(settings.title) || asString(settings.heading);
  const description = asString(settings.description) || asString(settings.subtitle);
  const headingTag = resolveHeadingTag(settings.headingLevel, fallback);

  if (!title && !description) return null;

  return (
    <div className={styles.sectionHeading}>
      {title ? <>{headingTag === "h1" ? <h1>{title}</h1> : null}</> : null}
      {title ? <>{headingTag === "h2" ? <h2>{title}</h2> : null}</> : null}
      {title ? <>{headingTag === "h3" ? <h3>{title}</h3> : null}</> : null}
      {title ? <>{headingTag === "h4" ? <h4>{title}</h4> : null}</> : null}
      {description ? <p>{description}</p> : null}
    </div>
  );
};

const HeroSection = ({ section }: { section: CmsRenderableSection }) => {
  const settings = asRecord(section.settings);
  const slides = asArray<Record<string, unknown>>(settings.slides);
  const headingTag = resolveHeadingTag(settings.headingLevel, "h1");
  const normalizedSlides = slides.length
    ? slides
    : [
        {
          title: settings.title,
          description: settings.description,
          imageUrl: settings.backgroundImageUrl,
          imageAlt: settings.title,
          href: settings.primaryCtaHref,
          linkLabel: settings.primaryCtaLabel,
        },
      ].filter(
        (item) =>
          asString(item.title) ||
          asString(item.description) ||
          asString(item.imageUrl) ||
          asString(item.href),
      );

  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = normalizedSlides[activeIndex] ?? normalizedSlides[0] ?? {};
  const title = asString(settings.title) || asString(activeSlide.title);
  const description = asString(settings.description) || asString(activeSlide.description);
  const eyebrow = asString(settings.eyebrow) || asString(settings.badge);
  const mediaUrl = asString(activeSlide.imageUrl) || asString(settings.backgroundImageUrl);
  const mediaAlt = asString(activeSlide.imageAlt) || title || "Destacado";
  const primaryLabel = asString(activeSlide.linkLabel) || asString(settings.primaryCtaLabel);
  const primaryHref = asString(activeSlide.href) || asString(settings.primaryCtaHref);
  const secondaryLabel = asString(settings.secondaryCtaLabel);
  const secondaryHref = asString(settings.secondaryCtaHref);
  const tertiaryLabel = asString(settings.tertiaryCtaLabel);
  const tertiaryHref = asString(settings.tertiaryCtaHref);

  const previous = () =>
    setActiveIndex((current) => (current - 1 + normalizedSlides.length) % normalizedSlides.length);
  const next = () => setActiveIndex((current) => (current + 1) % normalizedSlides.length);

  return (
    <Container className={styles.sectionContainer}>
      <section className={styles.heroShell}>
        <div className={styles.heroStage}>
          {mediaUrl ? <img alt={mediaAlt} className={styles.heroStageImage} src={mediaUrl} /> : null}
          <div className={styles.heroOverlay}>
            <div className={styles.heroCopy}>
              {eyebrow ? <span className={styles.heroEyebrow}>{eyebrow}</span> : null}
              {title
                ? headingTag === "h1"
                  ? <h1 className={styles.heroTitle}>{title}</h1>
                  : headingTag === "h2"
                    ? <h2 className={styles.heroTitle}>{title}</h2>
                    : headingTag === "h3"
                      ? <h3 className={styles.heroTitle}>{title}</h3>
                      : <h4 className={styles.heroTitle}>{title}</h4>
                : null}
              {description ? <p className={styles.heroDescription}>{description}</p> : null}
              <div className={styles.heroActions}>
                {renderLink(primaryLabel, primaryHref, styles.primaryAction)}
                {renderLink(secondaryLabel, secondaryHref, styles.secondaryAction)}
                {renderLink(tertiaryLabel, tertiaryHref, styles.tertiaryAction)}
              </div>
            </div>

            {normalizedSlides.length > 1 ? (
              <div className={styles.heroControls}>
                <button className={styles.heroArrow} onClick={previous} type="button">
                  Anterior
                </button>
                <div className={styles.heroDots}>
                  {normalizedSlides.map((slide, index) => {
                    const slideTitle = asString(slide.title) || `Diapositiva ${index + 1}`;
                    return (
                      <button
                        aria-label={slideTitle}
                        className={index === activeIndex ? styles.heroDotActive : styles.heroDot}
                        key={`${slideTitle}-${index}`}
                        onClick={() => setActiveIndex(index)}
                        type="button"
                      />
                    );
                  })}
                </div>
                <button className={styles.heroArrow} onClick={next} type="button">
                  Siguiente
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </Container>
  );
};

type VisualStoryItem = {
  id: string;
  title: string;
  caption?: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  posterUrl?: string | null;
  link?: string | null;
  external?: boolean;
  durationMs: number;
  alt?: string | null;
};

const MediaHeroSection = ({ section }: { section: CmsRenderableSection }) => {
  const settings = asRecord(section.settings);
  const mediaType = readMediaType(settings.mediaType, "image");
  const mediaUrl =
    asString(settings.mediaUrl) ||
    pickMediaUrl(section.blocks[0]?.media) ||
    asString(section.blocks[0]?.content?.mediaUrl) ||
    asString(section.blocks[0]?.content?.imageUrl) ||
    asString(section.blocks[0]?.content?.videoUrl);
  const posterUrl =
    asString(settings.posterUrl) ||
    pickMediaUrl(section.blocks[0]?.media) ||
    asString(section.blocks[0]?.content?.thumbnail);
  const overlay = asBoolean(settings.overlay, true);
  const overlayOpacity = normalizeOverlayOpacity(settings.overlayOpacity, 0.58);
  const title = asString(settings.title) || asString(section.blocks[0]?.content?.title);
  const subtitle = asString(settings.subtitle) || asString(settings.description);
  const eyebrow = asString(settings.eyebrow) || asString(settings.badge);
  const primaryCta = readActionLink(settings.primaryCta) ?? {
    label: asString(settings.primaryCtaLabel),
    href: asString(settings.primaryCtaHref),
  };
  const secondaryCta = readActionLink(settings.secondaryCta) ?? {
    label: asString(settings.secondaryCtaLabel),
    href: asString(settings.secondaryCtaHref),
  };
  const mediaAlt = asString(settings.mediaAlt) || title || "Destacado";

  return (
    <Container className={styles.sectionContainer}>
      <section className={styles.mediaHeroShell}>
        <div className={styles.mediaHeroStage}>
          {mediaUrl ? (
            mediaType === "video" ? (
              <video
                autoPlay
                className={styles.mediaHeroVideo}
                loop
                muted
                playsInline
                poster={posterUrl || undefined}
                preload="metadata">
                <source src={mediaUrl} />
              </video>
            ) : (
              <NextImage
                alt={mediaAlt}
                className={styles.mediaHeroImage}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 1200px"
                src={mediaUrl}
              />
            )
          ) : null}

          <div
            className={styles.mediaHeroOverlay}
            style={
              overlay
                ? ({ ["--hero-overlay-opacity" as string]: overlayOpacity } as CSSProperties)
                : ({ ["--hero-overlay-opacity" as string]: 0.15 } as CSSProperties)
            }
          />

          <div className={styles.mediaHeroCopy}>
            {eyebrow ? <span className={styles.mediaHeroEyebrow}>{eyebrow}</span> : null}
            {title ? <h1 className={styles.mediaHeroTitle}>{title}</h1> : null}
            {subtitle ? <p className={styles.mediaHeroSubtitle}>{subtitle}</p> : null}
            <div className={styles.mediaHeroActions}>
              {primaryCta.label && primaryCta.href
                ? renderLink(primaryCta.label, primaryCta.href, styles.primaryAction)
                : null}
              {secondaryCta.label && secondaryCta.href
                ? renderLink(secondaryCta.label, secondaryCta.href, styles.secondaryAction)
                : null}
            </div>
          </div>
        </div>
      </section>
    </Container>
  );
};

const buildVisualStory = (
  block: CmsRenderableSection["blocks"][number],
  fallbackDurationMs: number,
): VisualStoryItem | null => {
  const content = asRecord(block.content);
  const title = asString(content.title) || block.name || "";
  const caption = asString(content.caption) || asString(content.description);
  const mediaUrl =
    asString(content.mediaUrl) ||
    asString(content.videoUrl) ||
    asString(content.imageUrl) ||
    pickMediaUrl(block.media);
  if (!title && !mediaUrl) return null;

  const mediaType =
    readMediaType(content.mediaType, readMediaType(block.media?.type, mediaUrl.endsWith(".mp4") ? "video" : "image")) ||
    "image";

  return {
    id: String(block.id),
    title: title || "Story",
    caption,
    mediaUrl,
    mediaType,
    posterUrl: asString(content.thumbnail) || block.media?.url || null,
    link: asString(content.link) || asString(content.href),
    external: asBoolean(content.external, false),
    durationMs: readMediaDuration(content.duration ?? content.durationSec, fallbackDurationMs),
    alt: asString(content.alt) || block.media?.alt || title || "Story",
  };
};

const StoriesCarouselSection = ({ section }: { section: CmsRenderableSection }) => {
  const settings = asRecord(section.settings);
  const autoplay = asBoolean(settings.autoplay, true);
  const showProgressBar = asBoolean(settings.showProgressBar, true);
  const interval = Math.max(1000, normalizeDurationMs(settings.interval, 5000));
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const stories = section.blocks
    .map((block) => buildVisualStory(block, interval))
    .filter((story): story is VisualStoryItem => Boolean(story));

  if (!stories.length) return null;

  return (
    <Container className={styles.sectionContainer}>
      {renderHeading(section)}
      <section className={styles.storiesShell}>
        <div className={styles.storiesRail}>
          {stories.map((story, index) => (
            <article className={styles.storyCard} key={story.id}>
              <button
                className={styles.storyTrigger}
                aria-label={story.title}
                onClick={() => setActiveIndex(index)}
                type="button">
                <span className={styles.storyRing}>
                  <span className={styles.storyThumb}>
                    {story.mediaUrl ? (
                      <NextImage
                        alt={story.alt ?? story.title}
                        className={styles.storyThumbImage}
                        fill
                        sizes="96px"
                        src={story.mediaUrl}
                      />
                    ) : null}
                  </span>
                </span>
                <span className={styles.storyTitle}>{story.title}</span>
                {story.caption ? <span className={styles.storyCaption}>{story.caption}</span> : null}
                {showProgressBar ? (
                  <span className={styles.storyProgress}>
                    <span
                      className={styles.storyProgressFill}
                      style={{ width: `${Math.min(100, Math.max(24, (story.durationMs / interval) * 100))}%` }}
                    />
                  </span>
                ) : null}
              </button>
            </article>
          ))}
        </div>
      </section>

      <StoriesModal
        autoplay={autoplay}
        defaultDurationMs={interval}
        initialIndex={activeIndex ?? 0}
        open={activeIndex !== null}
        onClose={() => setActiveIndex(null)}
        showProgressBar={showProgressBar}
        stories={stories}
      />
    </Container>
  );
};

const MediaGridEnhancedSection = ({ section }: { section: CmsRenderableSection }) => {
  const settings = asRecord(section.settings);
  const variant = asString(settings.variant) || "default";

  if (variant === "products") {
    const products = section.blocks.map((block) => {
      const content = asRecord(block.content);
      const title = asString(content.title) || block.name || "";
      const slug = asString(content.slug) || asString(content.href).replace(/^\/product\//, "");
      const href = asString(content.href) || (slug ? `/product/${slug}` : "");
      const price = asNumber(content.price, NaN);
      const basePrice = asNumber(content.basePrice, NaN);
      const off = asNumber(content.off, 0);
      const rating = asNumber(content.rating, 4);
      const currencyCode = asString(content.currencyCode) || asString(content.currency);
      const mediaUrl = asString(content.imgUrl) || asString(content.imageUrl) || pickMediaUrl(block.media);
      const images = asArray<string>(content.images).filter((item) => asString(item));

      return title && slug
        ? {
            id: asString(content.productId) || block.id,
            slug,
            title,
            price: Number.isFinite(price) ? price : Math.max(0, basePrice || 0),
            basePrice: Number.isFinite(basePrice) ? basePrice : undefined,
            currencyCode: currencyCode || undefined,
            off: Number.isFinite(off) ? off : 0,
            rating: Number.isFinite(rating) ? rating : 4,
            imgUrl: mediaUrl || null,
            images,
            href,
          }
        : null;
    }).filter((item): item is {
      id: string | number;
      slug: string;
      title: string;
      price: number;
      basePrice?: number;
      currencyCode?: string;
      off: number;
      rating: number;
      imgUrl: string | null;
      images: string[];
      href: string;
    } => Boolean(item));

    if (!products.length) return null;

    return (
      <Container className={styles.sectionContainer}>
        {renderHeading(section)}
        <Card borderRadius={8} p="1rem">
          <Carousel slidesToShow={4} responsive={PRODUCT_CAROUSEL_RESPONSIVE}>
            {products.map((item) => (
              <div key={item.id} style={{ padding: "0.25rem" }}>
                <ProductCard1
                  hoverEffect
                  id={item.id}
                  slug={item.slug}
                  title={item.title}
                  price={item.price}
                  basePrice={item.basePrice}
                  currencyCode={item.currencyCode}
                  off={item.off}
                  rating={item.rating}
                  images={item.images}
                  imgUrl={item.imgUrl}
                />
              </div>
            ))}
          </Carousel>
        </Card>
      </Container>
    );
  }

  const columns = Math.min(5, Math.max(1, Math.round(asNumber(settings.columns, 3))));
  const gap = Math.max(0.5, asNumber(settings.gap, 1));
  const aspectRatio = asString(settings.aspectRatio) || "4 / 5";

  return (
    <Container className={styles.sectionContainer}>
      {renderHeading(section)}
      <section
        className={styles.mediaGridEnhanced}
        style={
          {
            columnCount: columns,
            columnGap: `${gap}rem`,
          } as CSSProperties
        }>
        {section.blocks.map((block) => {
          const content = asRecord(block.content);
          const title = asString(content.title) || block.name || "";
          const description = asString(content.description) || asString(content.caption);
          const href = asString(content.link) || asString(content.href);
          const linkLabel = asString(content.linkLabel) || "Explorar";
          const mediaUrl =
            asString(content.mediaUrl) || asString(content.imageUrl) || pickMediaUrl(block.media);
          const mediaType = readMediaType(content.mediaType, readMediaType(block.media?.type, "image"));
          const badge = asString(content.badge);
          const overlayText = asBoolean(content.overlayText, false);

          return (
            <article className={styles.mediaGridEnhancedCard} key={block.id}>
              <div className={styles.mediaGridEnhancedMedia} style={{ aspectRatio }}>
                {mediaUrl ? (
                  mediaType === "video" ? (
                  <video
                      className={styles.mediaGridEnhancedVideo}
                      controls
                      muted
                      playsInline
                      preload="metadata"
                      poster={block.media?.url || undefined}>
                      <source src={mediaUrl} />
                    </video>
                  ) : (
                    <NextImage
                      alt={block.media?.alt || title || "Imagen"}
                      className={styles.mediaGridEnhancedImage}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      src={mediaUrl}
                    />
                  )
                ) : null}

                {overlayText || badge ? (
                  <div className={styles.mediaGridEnhancedOverlay}>
                    {badge ? <span className={styles.mediaGridEnhancedBadge}>{badge}</span> : null}
                    {title ? <h3>{title}</h3> : null}
                    {description ? <p>{description}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className={styles.mediaGridEnhancedBody}>
                {title ? <h3>{title}</h3> : null}
                {description ? <p>{description}</p> : null}
                {href ? renderLink(linkLabel, href, styles.mediaLink) : null}
              </div>
            </article>
          );
        })}
      </section>
    </Container>
  );
};

const VideoSection = ({ section }: { section: CmsRenderableSection }) => {
  const settings = asRecord(section.settings);
  const layout = asString(settings.layout) === "fullwidth" ? "fullwidth" : "contained";
  const autoplay = asBoolean(settings.autoplay, false);
  const controls = asBoolean(settings.controls, true);
  const blocks = section.blocks.flatMap((block) => {
      const content = asRecord(block.content);
    const title = asString(content.title) || block.name || "";
    const description = asString(content.description) || asString(content.caption);
    const videoUrl = asString(content.videoUrl) || asString(content.mediaUrl) || pickMediaUrl(block.media);
    const thumbnail = asString(content.thumbnail) || block.media?.url || asString(content.posterUrl);
      return videoUrl || title || description
        ? [{ id: block.id, title, description, videoUrl, thumbnail }]
        : [];
    });

  if (!blocks.length) return null;

  const [featured, ...supporting] = blocks;

  return (
    <Container
      className={layout === "fullwidth" ? styles.sectionContainerFluid : styles.sectionContainer}
      fluid={layout === "fullwidth"}>
      {renderHeading(section)}
      <section className={`${styles.videoSection} ${layout === "fullwidth" ? styles.videoSectionFullwidth : ""}`}>
        <div className={styles.videoSectionFeature}>
          {featured.videoUrl ? (
            <video
              autoPlay={autoplay}
              className={styles.videoSectionPlayer}
              controls={controls}
              muted={autoplay}
              playsInline
              poster={featured.thumbnail || undefined}
              preload={autoplay ? "metadata" : "none"}>
              <source src={featured.videoUrl} />
            </video>
          ) : null}
          <div className={styles.videoSectionFeatureBody}>
            {featured.title ? <h3>{featured.title}</h3> : null}
            {featured.description ? <p>{featured.description}</p> : null}
          </div>
        </div>

        {supporting.length ? (
          <div className={styles.videoSectionSidebar}>
            {supporting.map((item) => (
              <article className={styles.videoSectionCard} key={item.id}>
                <div className={styles.videoSectionThumb}>
                  {item.thumbnail ? (
                    <NextImage
                      alt={item.title || "Video"}
                      className={styles.videoSectionThumbImage}
                      fill
                      sizes="(max-width: 768px) 100vw, 320px"
                      src={item.thumbnail}
                    />
                  ) : null}
                </div>
                <div className={styles.videoSectionCardBody}>
                  {item.title ? <h4>{item.title}</h4> : null}
                  {item.description ? <p>{item.description}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </Container>
  );
};

const HighlightCardsSection = ({ section }: { section: CmsRenderableSection }) => (
  <Container className={styles.sectionContainer}>
    {renderHeading(section)}
    <section className={styles.highlightCards}>
      {section.blocks.map((block) => {
        const content = asRecord(block.content);
        const title = asString(content.title) || block.name || "";
        const description = asString(content.description) || asString(content.caption);
        const href = asString(content.link) || asString(content.href);
        const linkLabel = asString(content.linkLabel) || "Ver más";
        const badge = asString(content.badge);
        const mediaUrl = asString(content.image) || asString(content.mediaUrl) || pickMediaUrl(block.media);

        return (
          <article className={styles.highlightCard} key={block.id}>
            <div className={styles.highlightCardMedia}>
              {mediaUrl ? (
                <NextImage
                  alt={block.media?.alt || title || "Imagen"}
                  className={styles.highlightCardImage}
                  fill
                  sizes="(max-width: 768px) 100vw, 25vw"
                  src={mediaUrl}
                />
              ) : null}
              {badge ? <span className={styles.highlightCardBadge}>{badge}</span> : null}
            </div>
            <div className={styles.highlightCardBody}>
              {title ? <h3>{title}</h3> : null}
              {description ? <p>{description}</p> : null}
              {href ? renderLink(linkLabel, href, styles.featureLink) : null}
            </div>
          </article>
        );
      })}
    </section>
  </Container>
);

type CmsRenderOptions = {
  allowHtmlFallback: boolean;
};

const FeatureGridSection = ({
  section,
  allowHtmlFallback,
}: {
  section: CmsRenderableSection;
  allowHtmlFallback: boolean;
}) => {
  const settings = asRecord(section.settings);
  const variant = asString(settings.variant) || "cards";
  const gridVariantClass =
    variant === "portfolio"
      ? styles.featureGridPortfolio
      : variant === "services"
        ? styles.featureGridServices
        : variant === "contact"
          ? styles.featureGridContact
          : "";

  return (
    <Container className={styles.sectionContainer}>
      {renderHeading(section)}
      <section className={`${styles.featureGrid} ${gridVariantClass}`}>
        {section.blocks.map((block) => {
          const content = asRecord(block.content);
          const title = asString(content.title) || block.name || "";
          const description = asString(content.body) || asString(content.description);
          const href = asString(content.href);
          const linkLabel = asString(content.linkLabel);
          const mediaUrl = pickMediaUrl(block.media) || asString(content.imageUrl);
          const mediaAlt = block.media?.alt || title || "Imagen";
          const iconClass = asString(content.iconClass);
          const headingTag = resolveHeadingTag(
            content.headingLevel ?? content.semanticHeadingLevel ?? settings.itemHeadingLevel,
            "h3",
          );
          const bodyContent = renderCmsRichTextContent(content, {
            allowHtmlFallback,
            fallbackClassName: styles.richTextHtml,
          });

          return (
            <article className={styles.featureCard} key={block.id}>
              {mediaUrl ? (
                <div className={styles.featureCardMedia}>
                  <img alt={mediaAlt} src={mediaUrl} />
                </div>
              ) : iconClass ? (
                <div className={styles.featureCardIcon}>
                  <span>{iconClass.split(" ").pop()?.replace("fa-", "").replace("ion-", "")}</span>
                </div>
              ) : null}
              <div className={styles.featureCardBody}>
                {title
                  ? headingTag === "h2"
                    ? <h2>{title}</h2>
                    : headingTag === "h3"
                      ? <h3>{title}</h3>
                      : headingTag === "h4"
                        ? <h4>{title}</h4>
                        : <h3>{title}</h3>
                  : null}
                {bodyContent ? (
                  bodyContent
                ) : description ? (
                  <p>{description}</p>
                ) : null}
                {renderLink(linkLabel, href, styles.featureLink)}
              </div>
            </article>
          );
        })}
      </section>
    </Container>
  );
};

const MediaGridSection = ({ section }: { section: CmsRenderableSection }) => (
  <Container className={styles.sectionContainer}>
    {renderHeading(section)}
    <section className={styles.mediaGrid}>
      {section.blocks.map((block) => {
        const content = asRecord(block.content);
        const title = asString(content.title) || block.name || "";
        const description = asString(content.description) || asString(content.caption);
        const href = asString(content.href);
        const linkLabel = asString(content.linkLabel);
        const mediaUrl = pickMediaUrl(block.media) || asString(content.imageUrl);
        const mediaAlt = block.media?.alt || title || "Imagen";

        return (
          <article className={styles.mediaCard} key={block.id}>
            <div className={styles.mediaThumb}>{mediaUrl ? <img alt={mediaAlt} src={mediaUrl} /> : null}</div>
            <div className={styles.mediaBody}>
              {title ? <h3>{title}</h3> : null}
              {description ? <p>{description}</p> : null}
              {renderLink(linkLabel, href, styles.mediaLink)}
            </div>
          </article>
        );
      })}
    </section>
  </Container>
);

const MediaCarouselSection = ({ section }: { section: CmsRenderableSection }) => {
  const settings = asRecord(section.settings);
  const variant = asString(settings.variant) || "cards";
  const blocks = section.blocks;

  if (!blocks.length) return null;
  const defaultSlidesToShow = variant === "logos" ? 5 : 4;
  const slidesToShow = Math.max(
    1,
    Math.min(blocks.length, Math.round(asNumber(settings.slidesToShow, defaultSlidesToShow))),
  );
  const autoplay = asBoolean(settings.autoplay, variant === "logos");
  const autoplaySpeed = Math.max(1500, normalizeDurationMs(settings.autoplaySpeed, 3200));
  const arrows = asBoolean(settings.arrows, variant !== "logos");
  const responsiveSettings = asArray<Record<string, unknown>>(settings.responsive)
    .map((item) => ({
      breakpoint: Math.max(320, Math.round(asNumber(item.breakpoint, NaN))),
      settings: {
        slidesToShow: Math.max(
          1,
          Math.round(
            asNumber(
              (item.settings && typeof item.settings === "object"
                ? (item.settings as Record<string, unknown>).slidesToShow
                : undefined) ?? item.slidesToShow,
              1,
            ),
          ),
        ),
      },
    }))
    .filter((item) => Number.isFinite(item.breakpoint))
    .sort((left, right) => right.breakpoint - left.breakpoint);

  const defaultResponsive =
    responsiveSettings.length > 0
      ? responsiveSettings
      : [
          {
            breakpoint: 1279,
            settings: { slidesToShow: Math.max(1, slidesToShow - 1) },
          },
          {
            breakpoint: 959,
            settings: { slidesToShow: Math.max(1, slidesToShow - 2) },
          },
          {
            breakpoint: 650,
            settings: { slidesToShow: Math.max(1, slidesToShow - 3) },
          },
          {
            breakpoint: 426,
            settings: { slidesToShow: 1 },
          },
        ];

  return (
    <Container className={styles.sectionContainer}>
      {renderHeading(section)}
      <section className={styles.carouselShell}>
        <Carousel
          arrows={arrows}
          autoplay={autoplay}
          autoplaySpeed={autoplaySpeed}
          dots={false}
          infinite={blocks.length > slidesToShow}
          slidesToShow={slidesToShow}
          responsive={defaultResponsive}
          spaceBetween={16}>
          {blocks.map((block) => {
            const content = asRecord(block.content);
            const mediaUrl = pickMediaUrl(block.media) || asString(content.imageUrl);
            const mediaAlt = block.media?.alt || block.name || "Elemento";
            const title = asString(content.title) || block.name || "";
            const description = asString(content.description) || asString(content.body);
            const href = asString(content.href);
            const linkLabel = asString(content.linkLabel);

            return (
              <article
                className={variant === "logos" ? styles.carouselLogoCard : styles.carouselCard}
                key={block.id}
              >
                {mediaUrl ? (
                  <div className={variant === "logos" ? styles.carouselLogoMedia : styles.carouselCardMedia}>
                    <img alt={mediaAlt} src={mediaUrl} />
                  </div>
                ) : null}
                {variant !== "logos" ? (
                  <div className={styles.carouselCardBody}>
                    {title ? <h3>{title}</h3> : null}
                    {description ? <p>{description}</p> : null}
                    {renderLink(linkLabel, href, styles.mediaLink)}
                  </div>
                ) : null}
              </article>
            );
          })}
        </Carousel>
      </section>
    </Container>
  );
};

const ContentSplitSection = ({
  section,
  allowHtmlFallback,
}: {
  section: CmsRenderableSection;
  allowHtmlFallback: boolean;
}) => {
  const settings = asRecord(section.settings);
  const mediaPosition = asString(settings.mediaPosition) === "end" ? "end" : "start";
  const gallery = asArray<Record<string, unknown>>(settings.gallery).filter(
    (item) => asString(item.imageUrl) || asString(item.imageAlt),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const activeGalleryItem = gallery[activeIndex] ?? gallery[0] ?? {};
  const imageUrl = gallery.length
    ? asString(activeGalleryItem.imageUrl)
    : asString(settings.imageUrl);
  const imageAlt = gallery.length
    ? asString(activeGalleryItem.imageAlt) || "Imagen"
    : asString(settings.imageAlt) || "Imagen";
  const contentContent = renderCmsRichTextContent(section.blocks[0]?.content ?? null, {
    allowHtmlFallback,
    fallbackClassName: styles.richTextHtml,
  });
  const actions = asActions(settings.actions);

  return (
    <Container className={styles.sectionContainer}>
      {renderHeading(section)}
      <section
        className={`${styles.contentSplit} ${
          mediaPosition === "end" ? styles.contentSplitReverse : ""
        }`}
      >
        <div className={styles.contentSplitMedia}>
          {imageUrl ? (
            <div className={styles.contentSplitMediaFrame}>
              <img alt={imageAlt} src={imageUrl} />
            </div>
          ) : null}

          {gallery.length > 1 ? (
            <div className={styles.contentSplitThumbs}>
              {gallery.map((item, index) => {
                const thumbUrl = asString(item.imageUrl);
                const thumbAlt = asString(item.imageAlt) || `Imagen ${index + 1}`;
                return (
                  <button
                    className={index === activeIndex ? styles.contentSplitThumbActive : styles.contentSplitThumb}
                    key={`${thumbAlt}-${index}`}
                    onClick={() => setActiveIndex(index)}
                    type="button"
                  >
                    {thumbUrl ? <img alt={thumbAlt} src={thumbUrl} /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className={styles.contentSplitBody}>
          {contentContent}
          {actions.length ? (
            <div className={styles.heroActions}>
              {actions.map((action, index) =>
                renderLink(action.label, action.href, styles.primaryAction, {
                  external: action.external,
                  key: `${action.label}-${index}`,
                }),
              )}
            </div>
          ) : null}
        </div>
      </section>
    </Container>
  );
};

const RichTextSection = ({
  section,
  allowHtmlFallback,
}: {
  section: CmsRenderableSection;
  allowHtmlFallback: boolean;
}) => (
  <Container className={styles.sectionContainer}>
    {renderHeading(section)}
    <div className={styles.richTextWrap}>
      {section.blocks.map((block) => {
        const content = asRecord(block.content);
        const title = asString(content.title);
        return (
          <section className={styles.richTextCard} key={block.id}>
            {title ? (
              <div className={styles.sectionHeading}>
                <h2>{title}</h2>
              </div>
            ) : null}
            {renderCmsRichTextContent(content, {
              allowHtmlFallback,
              fallbackClassName: styles.richTextHtml,
            })}
          </section>
        );
      })}
    </div>
  </Container>
);

const FaqSection = ({
  section,
  allowHtmlFallback,
}: {
  section: CmsRenderableSection;
  allowHtmlFallback: boolean;
}) => (
  <Container className={styles.sectionContainer}>
    {renderHeading(section)}
    <section className={styles.faqCard}>
      {section.blocks.map((block) => {
        const content = asRecord(block.content);
        const question = asString(content.question) || block.name || "";
        return (
          <details key={block.id}>
            <summary>{question}</summary>
            {renderCmsRichTextContent(content, {
              allowHtmlFallback,
              fallbackClassName: styles.faqAnswer,
            })}
          </details>
        );
      })}
    </section>
  </Container>
);

const CtaBannerSection = ({ section }: { section: CmsRenderableSection }) => {
  const settings = asRecord(section.settings);
  const title = asString(settings.title);
  const description = asString(settings.description) || asString(settings.body);
  const intent = asString(settings.intent) || "transactional";
  const actions =
    asActions(settings.actions).length > 0
      ? asActions(settings.actions)
      : asString(settings.label) && asString(settings.href)
        ? [{ label: asString(settings.label), href: asString(settings.href) }]
        : [];

  return (
    <Container className={styles.sectionContainer}>
      <section className={styles.ctaCard} data-intent={intent}>
        {title ? <h2>{title}</h2> : null}
        {description ? <p>{description}</p> : null}
        <div className={styles.ctaActions}>
          {actions.map((action, index) =>
            renderLink(action.label, action.href, styles.primaryAction, {
              external: action.external,
              key: `${action.label}-${index}`,
            }),
          )}
        </div>
      </section>
    </Container>
  );
};

const BudgetCalculatorSection = ({ section }: { section: CmsRenderableSection }) => {
  const settings = asRecord(section.settings);
  const title = asString(settings.title) || "Calculá tu presupuesto";
  const description =
    asString(settings.description) ||
    "Ingresá las medidas y obtené el precio al instante.";
  const productId = asNumber(settings.productId ?? settings.initialProductId, NaN);
  const productSlug = asString(settings.productSlug) || asString(settings.initialProductSlug) || null;
  const compact = Boolean(settings.compact ?? true);

  return (
    <BudgetCalculatorPanel
      compact={compact}
      title={title}
      description={description}
      initialProductId={Number.isFinite(productId) && productId > 0 ? productId : null}
      initialProductSlug={productSlug}
      initialWidth={Math.max(1, asNumber(settings.initialWidth, 1))}
      initialHeight={Math.max(1, asNumber(settings.initialHeight, 1))}
    />
  );
};

const BudgetCalculatorSectionWithPage = ({
  page,
  section,
}: {
  page: CmsRenderablePage;
  section: CmsRenderableSection;
}) => {
  const settings = asRecord(section.settings);
  const fallbackSlug =
    asString(settings.productSlug) ||
    asString(settings.initialProductSlug) ||
    deriveBudgetSlugFromPath(page.path);

  return (
    <BudgetCalculatorPanel
      compact={Boolean(settings.compact ?? true)}
      title={asString(settings.title) || "Presupuesto m²"}
      description={
        asString(settings.description) ||
        "Ingresá las medidas y obtené el precio al instante."
      }
      initialProductId={
        (() => {
          const parsed = asNumber(settings.productId ?? settings.initialProductId, NaN);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        })()
      }
      initialProductSlug={fallbackSlug}
      initialWidth={Math.max(1, asNumber(settings.initialWidth, 1))}
      initialHeight={Math.max(1, asNumber(settings.initialHeight, 1))}
    />
  );
};

const sectionMap: Record<
  string,
  (section: CmsRenderableSection, options: CmsRenderOptions) => ReactElement | null
> = {
  HERO: (section) => <HeroSection section={section} />,
  MEDIA_HERO: (section) => <MediaHeroSection section={section} />,
  FEATURE_GRID: (section, options) => (
    <FeatureGridSection section={section} allowHtmlFallback={options.allowHtmlFallback} />
  ),
  MEDIA_GRID: (section) => <MediaGridSection section={section} />,
  MEDIA_GRID_ENHANCED: (section) => <MediaGridEnhancedSection section={section} />,
  MEDIA_CAROUSEL: (section) => <MediaCarouselSection section={section} />,
  STORIES_CAROUSEL: (section) => <StoriesCarouselSection section={section} />,
  CONTENT_SPLIT: (section, options) => (
    <ContentSplitSection section={section} allowHtmlFallback={options.allowHtmlFallback} />
  ),
  RICH_TEXT: (section, options) => (
    <RichTextSection section={section} allowHtmlFallback={options.allowHtmlFallback} />
  ),
  FAQ: (section, options) => (
    <FaqSection section={section} allowHtmlFallback={options.allowHtmlFallback} />
  ),
  CTA_BANNER: (section) => <CtaBannerSection section={section} />,
  VIDEO_SECTION: (section) => <VideoSection section={section} />,
  HIGHLIGHT_CARDS: (section) => <HighlightCardsSection section={section} />,
  BUDGET_CALCULATOR: (section) => <BudgetCalculatorSection section={section} />,
};

export default function CmsPageShell({ page, homeContentSections }: Props) {
  const homeStoriesSection =
    page.path === "" && Array.isArray(homeContentSections)
      ? homeContentSections.find((section) => section.key === "HOME_STORIES") ?? null
      : null;
  const homeHighlightsSection =
    page.path === "" && Array.isArray(homeContentSections)
      ? homeContentSections.find((section) => section.key === "HOME_HIGHLIGHTS") ?? null
      : null;
  return (
    <div className={styles.siteShell}>
      <Topbar />
      <Header />
      <Navbar />
      {homeStoriesSection ? <SectionStories stories={homeStoriesSection.entries} /> : null}

      <main className={styles.siteMain}>
        <CmsPageBody page={page} />
      </main>

      {homeHighlightsSection ? <SectionCmsHighlights section={homeHighlightsSection} /> : null}
      <MobileNavigationBar />
      <Footer1 />
    </div>
  );
}

export function CmsPageBody({ page }: CmsPageBodyProps) {
  const bodySections = page.sections.filter(
    (section) => section.type !== "SITE_HEADER" && section.type !== "SITE_FOOTER",
  );
  const allowHtmlFallback = !page.legacySource;

  return (
    <div className={styles.pageStack}>
      {bodySections.map((section) => {
        const renderer =
          section.type === "BUDGET_CALCULATOR"
            ? (currentSection: CmsRenderableSection) => (
                <BudgetCalculatorSectionWithPage page={page} section={currentSection} />
              )
            : sectionMap[section.type];
        if (!renderer) {
          console.warn(`[cms] Unknown section type: ${section.type}`);
          return null;
        }
        return <div key={section.id}>{renderer(section, { allowHtmlFallback })}</div>;
      })}
    </div>
  );
}
