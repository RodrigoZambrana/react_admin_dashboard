"use client";

import Box from "@component/Box";
import Card from "@component/Card";
import Container from "@component/Container";
import { Carousel } from "@component/carousel";
import CarouselCard1 from "@component/carousel-cards/CarouselCard1";
import { Paragraph, SemiSpan } from "@component/Typography";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { defaultMarket1HeroSlides } from "@/data/market1Defaults";
import { useComponentTracking } from "@/lib/analytics/useComponentTracking";
import { useTranslation } from "@/state/i18n-context";

export default function Section1() {
  const config = useStorefrontConfig();
  const t = useTranslation();
  const heroRef = useComponentTracking({
    pageType: "home",
    componentType: "hero",
    componentId: "home_hero_section_1",
    metadata: {
      source: "market_1",
      slide_count: defaultMarket1HeroSlides.length,
    },
  });

  const companyProfile = config.companyProfile;
  const brandName =
    companyProfile?.tradeName ??
    companyProfile?.legalName ??
    config.seo.siteName ??
    t("contact.page.fallback.siteName", { defaultMessage: "Nuestra tienda" });

  const announcementMessage =
    config.announcement?.active && typeof config.announcement.message === "string"
      ? config.announcement.message
      : null;

  const carouselEyebrow =
    announcementMessage ??
    t("home.hero.eyebrow", {
      defaultMessage: "Storefront conectado al catálogo real",
    });

  return (
    <div ref={heroRef}>
      <Box bg="gray.white" mb="3.75rem">
        <Container pb="3rem">
          <Card
          borderRadius={24}
          p="2rem"
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 118, 110, 0.12) 0%, rgba(255, 255, 255, 0.98) 58%)",
            border: "1px solid rgba(15, 118, 110, 0.15)",
            }}>
          <SemiSpan color="primary.main" display="block" mb="0.5rem" fontWeight="700">
            {carouselEyebrow}
          </SemiSpan>

          <Paragraph color="text.muted" maxWidth="680px" mb="1rem">
            {t("home.hero.body", {
              defaultMessage:
                "Descubre productos publicados, categorías reales y la información comercial vigente sin depender de contenido demo del template.",
            })}
          </Paragraph>

          <Carousel dots autoplay arrows={false} slidesToShow={1}>
            {defaultMarket1HeroSlides.map((slide) => (
              <CarouselCard1
                key={slide.id}
                title={slide.title}
                description={slide.description}
                buttonText={slide.buttonText}
                href={slide.href}
                image={companyProfile?.logo ?? null}
                imageLabel={brandName}
                titleValues={{ storeName: brandName }}
              />
            ))}
          </Carousel>
          </Card>
        </Container>
      </Box>
    </div>
  );
}
