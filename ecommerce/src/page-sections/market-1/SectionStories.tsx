"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import SlickCarousel, { CustomArrowProps, Settings } from "react-slick";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";

import Box from "@component/Box";
import Container from "@component/Container";
import NextImage from "@component/NextImage";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import { H3, Paragraph, Small, Span } from "@component/Typography";
import { ArrowButton } from "@component/carousel/styles";
import { useTranslation } from "@/state/i18n-context";
import type { CmsContentAsset, CmsContentEntry } from "@/types/storefront";

const StoriesCarouselRoot = styled.div`
  position: relative;
  padding-inline: 2.9rem;

  .slick-slider,
  .slick-list,
  .slick-track {
    height: 100%;
  }

  .slick-list {
    margin-inline: -0.45rem;
  }

  .slick-track {
    display: flex;
    align-items: flex-start;
  }

  .slick-slide {
    height: auto;
    padding-inline: 0.45rem;
  }

  .slick-slide > div {
    height: 100%;
  }

  @media (max-width: 767px) {
    padding-inline: 3rem;
  }
`;

const StorySlide = styled.div`
  display: flex;
  justify-content: center;
`;

const StoryRailArrowButton = styled(ArrowButton)`
  opacity: 1;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #0f1413;
  border: 1px solid rgba(15, 20, 19, 0.12);
  box-shadow: 0 12px 24px rgba(15, 20, 19, 0.16);

  &.prev {
    left: 0;
  }

  &.next {
    right: 0;
  }

  &.slick-disabled {
    opacity: 0.45;
    visibility: visible;
    cursor: default;
  }

  @media (max-width: 767px) {
    width: 36px;
    height: 36px;

    &.prev {
      left: -0.35rem;
    }

    &.next {
      right: -0.35rem;
    }
  }
`;

const StoryTrigger = styled.button`
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  text-align: center;
  width: 100%;
`;

const StoryRing = styled.div`
  width: 92px;
  height: 92px;
  margin: 0 auto 0.65rem;
  padding: 3px;
  border-radius: 999px;
  background:
    linear-gradient(135deg, #1f6f5f, #d9a441 58%, #f4e8c8);

  @media (max-width: 767px) {
    width: 82px;
    height: 82px;
  }
`;

const StoryThumb = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 999px;
  overflow: hidden;
  background: #f4f0e7;
  border: 2px solid #fff;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1500;
  background: rgba(15, 18, 17, 0.88);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
`;

const ViewerSideButton = styled(Button)`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  min-width: 48px;
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #0f1413;
  border: 1px solid rgba(15, 20, 19, 0.12);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);

  @media (max-width: 900px) {
    width: 42px;
    height: 42px;

    &.home-story-nav-prev {
      left: 0.45rem;
    }

    &.home-story-nav-next {
      right: 0.45rem;
    }
  }
`;

const ViewerTopButton = styled(Button)`
  min-width: 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #0f1413;
  border: 1px solid rgba(15, 20, 19, 0.12);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
`;

const ViewerCard = styled.div`
  width: min(1080px, 100%);
  max-height: min(92vh, 900px);
  background: #111514;
  color: #f7f2e8;
  border-radius: 28px;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(300px, 360px);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    max-height: none;
  }
`;

const MediaPane = styled.div`
  position: relative;
  min-height: 440px;
  background:
    radial-gradient(circle at top, rgba(217, 164, 65, 0.18), transparent 36%),
    linear-gradient(180deg, #0f1413 0%, #1a2422 100%);
`;

const SidePane = styled.div`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-left: 1px solid rgba(255, 255, 255, 0.08);

  @media (max-width: 900px) {
    border-left: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
`;

const AssetDots = styled(FlexBox)`
  position: absolute;
  left: 50%;
  bottom: 1.25rem;
  transform: translateX(-50%);
  z-index: 2;
  gap: 0.45rem;
  padding: 0.4rem 0.7rem;
  border-radius: 999px;
  background: rgba(15, 20, 19, 0.56);
  backdrop-filter: blur(8px);
`;

const AssetDot = styled.button<{ $active: boolean }>`
  width: 9px;
  height: 9px;
  border-radius: 999px;
  border: 0;
  padding: 0;
  cursor: pointer;
  background: ${({ $active }) => ($active ? "#f7f2e8" : "rgba(247,242,232,0.42)")};
`;

type Props = {
  stories: CmsContentEntry[];
};

const getPrimaryAsset = (story?: CmsContentEntry | null): CmsContentAsset | null => story?.assets?.[0] ?? null;

function StoryRailNextArrow({ onClick }: CustomArrowProps) {
  return (
    <StoryRailArrowButton onClick={onClick} className="next" data-testid="home-stories-rail-next">
      <IconChevronRight size={20} className="forward-icon" />
    </StoryRailArrowButton>
  );
}

function StoryRailPrevArrow({ onClick }: CustomArrowProps) {
  return (
    <StoryRailArrowButton onClick={onClick} className="prev" data-testid="home-stories-rail-prev">
      <IconChevronLeft size={20} className="back-icon" />
    </StoryRailArrowButton>
  );
}

export default function SectionStories({ stories }: Props) {
  const t = useTranslation();
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeAssetIndex, setActiveAssetIndex] = useState(0);

  const activeStory = activeStoryIndex === null ? null : stories[activeStoryIndex] ?? null;
  const activeAssets = activeStory?.assets ?? [];
  const activeAsset = activeAssets[activeAssetIndex] ?? getPrimaryAsset(activeStory);

  const openStory = (storyIndex: number) => {
    setActiveStoryIndex(storyIndex);
    setActiveAssetIndex(0);
  };

  const goToStory = (storyIndex: number) => {
    if (!stories.length) return;
    const normalizedIndex = ((storyIndex % stories.length) + stories.length) % stories.length;
    setActiveStoryIndex(normalizedIndex);
    setActiveAssetIndex(0);
  };

  const getAssetCountForStory = (storyIndex: number) => stories[storyIndex]?.assets?.length ?? 0;

  const goToPreviousViewerItem = () => {
    if (activeStoryIndex === null || !stories.length) return;

    if (activeAssetIndex > 0) {
      setActiveAssetIndex(activeAssetIndex - 1);
      return;
    }

    const previousStoryIndex = ((activeStoryIndex - 1) % stories.length + stories.length) % stories.length;
    const previousStoryAssetCount = getAssetCountForStory(previousStoryIndex);
    setActiveStoryIndex(previousStoryIndex);
    setActiveAssetIndex(Math.max(0, previousStoryAssetCount - 1));
  };

  const goToNextViewerItem = () => {
    if (activeStoryIndex === null || !stories.length) return;

    if (activeAssetIndex < activeAssets.length - 1) {
      setActiveAssetIndex(activeAssetIndex + 1);
      return;
    }

    const nextStoryIndex = (activeStoryIndex + 1) % stories.length;
    setActiveStoryIndex(nextStoryIndex);
    setActiveAssetIndex(0);
  };

  const closeStory = () => {
    setActiveStoryIndex(null);
    setActiveAssetIndex(0);
  };

  const carouselSettings = useMemo<Settings>(
    () => ({
      dots: false,
      arrows: stories.length > 1,
      infinite: stories.length > 1,
      speed: 450,
      swipeToSlide: true,
      slidesToScroll: 1,
      slidesToShow: Math.min(6, stories.length || 1),
      nextArrow: <StoryRailNextArrow />,
      prevArrow: <StoryRailPrevArrow />,
      responsive: [
        { breakpoint: 1280, settings: { slidesToShow: Math.min(5, stories.length || 1) } },
        { breakpoint: 1024, settings: { slidesToShow: Math.min(4, stories.length || 1) } },
        { breakpoint: 768, settings: { slidesToShow: Math.min(3, stories.length || 1) } },
        { breakpoint: 560, settings: { slidesToShow: Math.min(2, stories.length || 1) } }
      ]
    }),
    [stories.length]
  );

  const media = useMemo(() => {
    if (!activeAsset) return null;

    if (activeAsset.mediaType === "VIDEO") {
      return (
        <video
          controls
          autoPlay
          playsInline
          poster={activeAsset.posterUrl ?? undefined}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}>
          <source src={activeAsset.mediaUrl} />
        </video>
      );
    }

    if (activeAsset.mediaType === "EMBED") {
      return (
        <iframe
          src={activeAsset.mediaUrl}
          title={activeAsset.title ?? activeStory?.title ?? "Story"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      );
    }

    return (
      <NextImage
        src={activeAsset.mediaUrl}
        alt={activeAsset.title ?? activeStory?.title ?? "Story"}
        fill
        style={{ objectFit: "cover" }}
      />
    );
  }, [activeAsset, activeStory?.title]);

  if (!stories.length) {
    return null;
  }

  return (
    <>
      <Box pt="2.75rem" pb="5.5rem" mb="1.5rem" style={{ backgroundColor: "#fbf7ef" }}>
        <Container>
          <StoriesCarouselRoot>
            <SlickCarousel {...carouselSettings}>
              {stories.map((story, index) => {
                const cover = story.thumbnail?.url ?? getPrimaryAsset(story)?.posterUrl ?? getPrimaryAsset(story)?.mediaUrl;
                return (
                  <StorySlide key={`cms-story-${story.id}`}>
                    <StoryTrigger type="button" onClick={() => openStory(index)} data-testid={`home-story-${story.id}`}>
                      <StoryRing>
                        <StoryThumb>
                          {cover ? (
                            <NextImage
                              src={cover}
                              alt={story.title}
                              width={84}
                              height={84}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <Box width="100%" height="100%" style={{ backgroundColor: "#e5e7eb" }} />
                          )}
                        </StoryThumb>
                      </StoryRing>
                      <Span fontSize="12px" fontWeight={600} color="text.primary" display="block">
                        {story.title}
                      </Span>
                    </StoryTrigger>
                  </StorySlide>
                );
              })}
            </SlickCarousel>
          </StoriesCarouselRoot>
        </Container>
      </Box>

      {activeStory && activeAsset ? (
        <Overlay onClick={closeStory}>
          <ViewerCard onClick={(event) => event.stopPropagation()} data-testid="home-story-viewer">
            <MediaPane>
              {media}

              {stories.length > 1 || activeAssets.length > 1 ? (
                <>
                  <ViewerSideButton
                    variant="outlined"
                    type="button"
                    className="home-story-nav-prev"
                    onClick={goToPreviousViewerItem}
                    data-testid="home-story-story-prev"
                    style={{
                      left: "1rem"
                    }}
                  >
                    <IconChevronLeft size={20} />
                  </ViewerSideButton>
                  <ViewerSideButton
                    variant="outlined"
                    type="button"
                    className="home-story-nav-next"
                    onClick={goToNextViewerItem}
                    data-testid="home-story-story-next"
                    style={{
                      right: "1rem"
                    }}
                  >
                    <IconChevronRight size={20} />
                  </ViewerSideButton>
                </>
              ) : null}

              <FlexBox
                position="absolute"
                top="1rem"
                right="1rem"
                zIndex={2}
                style={{ gap: "0.5rem" }}>
                <ViewerTopButton
                  variant="outlined"
                  type="button"
                  onClick={closeStory}
                  aria-label={t("common.close", { defaultMessage: "Cerrar" })}
                  data-testid="home-story-close"
                >
                  <IconX size={18} />
                </ViewerTopButton>
              </FlexBox>

              {activeAssets.length > 1 ? (
                <>
                  <AssetDots justifyContent="center" alignItems="center">
                    {activeAssets.map((asset, index) => (
                      <AssetDot
                        key={`${asset.id}-dot-${index}`}
                        type="button"
                        $active={index === activeAssetIndex}
                        onClick={() => setActiveAssetIndex(index)}
                        aria-label={t("home.stories.assetProgress", {
                          defaultMessage: "Pieza {current} de {total}",
                          values: { current: index + 1, total: activeAssets.length }
                        })}
                      />
                    ))}
                  </AssetDots>
                </>
              ) : null}
            </MediaPane>

            <SidePane>
              <Box>
                <Small color="#d9a441" style={{ textTransform: "uppercase", letterSpacing: "0.14em" }}>
                  {t("home.stories.storyLabel", { defaultMessage: "Story" })}
                </Small>
                <H3 mt="0.45rem" mb="0.5rem" color="#f7f2e8">
                  {activeAsset.title || activeStory.title}
                </H3>
                <Paragraph color="rgba(247,242,232,0.78)" mb={0}>
                  {activeAsset.caption ||
                    activeStory.description ||
                    t("home.stories.captionFallback", {
                      defaultMessage: "Contenido destacado del sitio."
                    })}
                </Paragraph>
              </Box>

              <Box>
                <Small color="rgba(247,242,232,0.55)" display="block" mb="0.5rem">
                  {t("home.stories.progress", {
                    defaultMessage: "Historia {current} de {total}",
                    values: { current: (activeStoryIndex ?? 0) + 1, total: stories.length }
                  })}
                </Small>
                <Small color="rgba(247,242,232,0.55)" display="block" mb="0.85rem">
                  {t("home.stories.assetProgress", {
                    defaultMessage: "Pieza {current} de {total}",
                    values: { current: activeAssetIndex + 1, total: activeAssets.length }
                  })}
                </Small>
                <FlexBox flexDirection="column" style={{ gap: "0.5rem" }}>
                  {activeAssets.map((asset, index) => (
                    <button
                      key={`${asset.id}-${index}`}
                      type="button"
                      onClick={() => setActiveAssetIndex(index)}
                      style={{
                        textAlign: "left",
                        border: 0,
                        borderRadius: 14,
                        padding: "0.8rem 0.95rem",
                        background:
                          index === activeAssetIndex ? "rgba(217,164,65,0.18)" : "rgba(255,255,255,0.04)",
                        color: "#f7f2e8",
                        cursor: "pointer"
                      }}>
                      <Span display="block" fontWeight={700}>
                        {asset.title ||
                          t("home.stories.assetLabel", {
                            defaultMessage: "Asset {index}",
                            values: { index: index + 1 }
                          })}
                      </Span>
                      <Small color="rgba(247,242,232,0.62)">
                        {asset.mediaType}
                      </Small>
                    </button>
                  ))}
                </FlexBox>
              </Box>

              <FlexBox mt="auto" flexWrap="wrap" style={{ gap: "0.75rem" }}>
                <Link href={activeAsset.externalUrl || activeStory.cta?.href || "#"}>
                  <Button variant="contained" color="primary">
                    {activeStory.cta?.label || t("home.stories.viewProduct", { defaultMessage: "Ver más" })}
                  </Button>
                </Link>
              </FlexBox>
            </SidePane>
          </ViewerCard>
        </Overlay>
      ) : null}
    </>
  );
}
