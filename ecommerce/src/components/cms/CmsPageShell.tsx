"use client";

import { useRef, useState, type ReactElement } from "react";
import Link from "next/link";
import Container from "@component/Container";
import Topbar from "@component/topbar";
import { Header } from "@component/header";
import Navbar from "@component/navbar/Navbar";
import { Footer1 } from "@component/footer";
import MobileNavigationBar from "@component/mobile-navigation";
import type {
  CmsRenderableBlock,
  CmsRenderableMedia,
  CmsRenderablePage,
  CmsRenderableSection,
} from "@/types/storefront";
import styles from "./CmsPageShell.module.css";

type Props = {
  page: CmsRenderablePage;
};

type ActionLink = {
  label: string;
  href: string;
  external?: boolean;
};

const asRecord = (value: Record<string, unknown> | null | undefined) => value ?? {};

const asString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "";

const asHtml = (value: unknown) => asString(value);

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asActions = (value: unknown): ActionLink[] =>
  asArray<Record<string, unknown>>(value)
    .map((item) => ({
      label: asString(item.label),
      href: asString(item.href),
      external: Boolean(item.external),
    }))
    .filter((item) => item.label && item.href);

const pickMediaUrl = (media?: CmsRenderableMedia | null) => media?.url ?? "";

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

const renderHeading = (section: CmsRenderableSection) => {
  const settings = asRecord(section.settings);
  const title = asString(settings.title) || asString(settings.heading);
  const description = asString(settings.description) || asString(settings.subtitle);

  if (!title && !description) return null;

  return (
    <div className={styles.sectionHeading}>
      {title ? <h2>{title}</h2> : null}
      {description ? <p>{description}</p> : null}
    </div>
  );
};

const renderRichTextBlocks = (blocks: CmsRenderableBlock[]) =>
  blocks
    .map((block) => {
      const content = asRecord(block.content);
      return (
        asHtml(content.html) ||
        asHtml(content.bodyHtml) ||
        asHtml(content.body) ||
        asHtml(content.description)
      );
    })
    .filter(Boolean)
    .join("\n");

const HeroSection = ({ section }: { section: CmsRenderableSection }) => {
  const settings = asRecord(section.settings);
  const slides = asArray<Record<string, unknown>>(settings.slides);
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
  const title = asString(activeSlide.title) || asString(settings.title);
  const description = asString(activeSlide.description) || asString(settings.description);
  const eyebrow = asString(settings.eyebrow) || asString(settings.badge);
  const mediaUrl = asString(activeSlide.imageUrl) || asString(settings.backgroundImageUrl);
  const mediaAlt = asString(activeSlide.imageAlt) || title || "Destacado";
  const primaryLabel = asString(activeSlide.linkLabel) || asString(settings.primaryCtaLabel);
  const primaryHref = asString(activeSlide.href) || asString(settings.primaryCtaHref);
  const secondaryLabel = asString(settings.secondaryCtaLabel);
  const secondaryHref = asString(settings.secondaryCtaHref);

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
              {title ? <h1 className={styles.heroTitle}>{title}</h1> : null}
              {description ? <p className={styles.heroDescription}>{description}</p> : null}
              <div className={styles.heroActions}>
                {renderLink(primaryLabel, primaryHref, styles.primaryAction)}
                {renderLink(secondaryLabel, secondaryHref, styles.secondaryAction)}
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

const FeatureGridSection = ({ section }: { section: CmsRenderableSection }) => {
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
          const bodyHtml = asHtml(content.bodyHtml);
          const href = asString(content.href);
          const linkLabel = asString(content.linkLabel);
          const mediaUrl = pickMediaUrl(block.media) || asString(content.imageUrl);
          const mediaAlt = block.media?.alt || title || "Imagen";
          const iconClass = asString(content.iconClass);

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
                {title ? <h3>{title}</h3> : null}
                {bodyHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
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
  const [activeIndex, setActiveIndex] = useState(0);
  const railRef = useRef<HTMLDivElement | null>(null);

  const activeBlock = blocks[activeIndex] ?? blocks[0];
  const scrollByAmount = variant === "logos" ? 220 : 360;

  const scrollRail = (direction: "prev" | "next") => {
    railRef.current?.scrollBy({
      left: direction === "prev" ? -scrollByAmount : scrollByAmount,
      behavior: "smooth",
    });
  };

  if (!blocks.length) return null;

  if (variant === "gallery") {
    const content = asRecord(activeBlock.content);
    const mediaUrl = pickMediaUrl(activeBlock.media) || asString(content.imageUrl);
    const mediaAlt = activeBlock.media?.alt || activeBlock.name || "Galería";
    const title = asString(content.title) || activeBlock.name || "";
    const description = asString(content.description) || asString(content.body);
    const href = asString(content.href);
    const linkLabel = asString(content.linkLabel);

    return (
      <Container className={styles.sectionContainer}>
        {renderHeading(section)}
        <section className={styles.galleryShell}>
          <div className={styles.galleryStage}>
            {mediaUrl ? <img alt={mediaAlt} className={styles.galleryStageImage} src={mediaUrl} /> : null}
            <div className={styles.galleryStageBody}>
              {title ? <h3>{title}</h3> : null}
              {description ? <p>{description}</p> : null}
              {renderLink(linkLabel, href, styles.primaryAction)}
            </div>
          </div>
          <div className={styles.galleryThumbs}>
            {blocks.map((block, index) => {
              const blockContent = asRecord(block.content);
              const thumbUrl = pickMediaUrl(block.media) || asString(blockContent.imageUrl);
              const thumbAlt = block.media?.alt || block.name || `Imagen ${index + 1}`;
              return (
                <button
                  className={index === activeIndex ? styles.galleryThumbActive : styles.galleryThumb}
                  key={block.id}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                >
                  {thumbUrl ? <img alt={thumbAlt} src={thumbUrl} /> : null}
                </button>
              );
            })}
          </div>
        </section>
      </Container>
    );
  }

  return (
    <Container className={styles.sectionContainer}>
      {renderHeading(section)}
      <section className={styles.carouselShell}>
        <div className={styles.carouselActions}>
          <button className={styles.carouselArrow} onClick={() => scrollRail("prev")} type="button">
            Anterior
          </button>
          <button className={styles.carouselArrow} onClick={() => scrollRail("next")} type="button">
            Siguiente
          </button>
        </div>

        <div className={styles.carouselRail} ref={railRef}>
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
        </div>
      </section>
    </Container>
  );
};

const ContentSplitSection = ({ section }: { section: CmsRenderableSection }) => {
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
  const contentHtml = renderRichTextBlocks(section.blocks);

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
          {contentHtml ? (
            <div className={styles.richTextHtml} dangerouslySetInnerHTML={{ __html: contentHtml }} />
          ) : null}
        </div>
      </section>
    </Container>
  );
};

const RichTextSection = ({ section }: { section: CmsRenderableSection }) => (
  <Container className={styles.sectionContainer}>
    {renderHeading(section)}
    <div className={styles.richTextWrap}>
      {section.blocks.map((block) => {
        const content = asRecord(block.content);
        const html =
          asHtml(content.html) ||
          asHtml(content.bodyHtml) ||
          asHtml(content.body) ||
          asHtml(content.description);
        const title = asString(content.title);
        return (
          <section className={styles.richTextCard} key={block.id}>
            {title ? (
              <div className={styles.sectionHeading}>
                <h2>{title}</h2>
              </div>
            ) : null}
            {html ? <div className={styles.richTextHtml} dangerouslySetInnerHTML={{ __html: html }} /> : null}
          </section>
        );
      })}
    </div>
  </Container>
);

const FaqSection = ({ section }: { section: CmsRenderableSection }) => (
  <Container className={styles.sectionContainer}>
    {renderHeading(section)}
    <section className={styles.faqCard}>
      {section.blocks.map((block) => {
        const content = asRecord(block.content);
        const question = asString(content.question) || block.name || "";
        const answer = asHtml(content.answer) || asHtml(content.body);
        return (
          <details key={block.id}>
            <summary>{question}</summary>
            {answer ? <p dangerouslySetInnerHTML={{ __html: answer }} /> : null}
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
  const actions =
    asActions(settings.actions).length > 0
      ? asActions(settings.actions)
      : asString(settings.label) && asString(settings.href)
        ? [{ label: asString(settings.label), href: asString(settings.href) }]
        : [];

  return (
    <Container className={styles.sectionContainer}>
      <section className={styles.ctaCard}>
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

const sectionMap: Record<string, (section: CmsRenderableSection) => ReactElement | null> = {
  HERO: (section) => <HeroSection section={section} />,
  FEATURE_GRID: (section) => <FeatureGridSection section={section} />,
  MEDIA_GRID: (section) => <MediaGridSection section={section} />,
  MEDIA_CAROUSEL: (section) => <MediaCarouselSection section={section} />,
  CONTENT_SPLIT: (section) => <ContentSplitSection section={section} />,
  RICH_TEXT: (section) => <RichTextSection section={section} />,
  FAQ: (section) => <FaqSection section={section} />,
  CTA_BANNER: (section) => <CtaBannerSection section={section} />,
};

export default function CmsPageShell({ page }: Props) {
  const bodySections = page.sections.filter(
    (section) => section.type !== "SITE_HEADER" && section.type !== "SITE_FOOTER",
  );

  return (
    <div className={styles.siteShell}>
      <Topbar />
      <Header />
      <Navbar />

      <main className={styles.siteMain}>
        <div className={styles.pageStack}>
          {bodySections.map((section) => {
            const renderer = sectionMap[section.type];
            if (!renderer) {
              console.warn(`[cms] Unknown section type: ${section.type}`);
              return null;
            }
            return <div key={section.id}>{renderer(section)}</div>;
          })}
        </div>
      </main>

      <MobileNavigationBar />
      <Footer1 />
    </div>
  );
}
