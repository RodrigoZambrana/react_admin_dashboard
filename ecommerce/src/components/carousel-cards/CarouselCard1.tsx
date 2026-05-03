"use client";

import Link from "next/link";
import Image from "next/image";
import styled from "styled-components";
import { usePathname } from "next/navigation";
// GLOBAL CUSTOM COMPONENTS
import { Button } from "@component/buttons";
import Typography from "@component/Typography";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";
import { useTranslation } from "@/state/i18n-context";

// STYLED COMPONENT
const StyledCarouselCard1 = styled.div`
  display: flex;
  text-align: left;
  align-items: center;
  gap: 2rem;
  min-height: 360px;
  padding: 1rem 2rem;
  justify-content: space-between;

  .content {
    max-width: 500px;

    .eyebrow {
      display: inline-block;
      margin-bottom: 0.75rem;
      letter-spacing: 0.02em;
    }

    .title {
      font-size: 46px;
      margin-top: 0px;
      line-height: 1.2;
      margin-bottom: 1.35rem;
    }
  }

  .image-holder {
    position: relative;
    width: min(320px, 40vw);
    min-height: 260px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 24px;
    background: linear-gradient(160deg, rgba(15, 118, 110, 0.1), rgba(255, 255, 255, 0.96));
    border: 1px solid rgba(15, 118, 110, 0.18);

    img {
      width: 100%;
    }
  }

  .image-fallback {
    padding: 1.5rem;
    text-align: center;
  }

  @media only screen and (max-width: 900px) {
    margin-left: 0px;
    min-height: auto;
    padding-inline: 0;
    flex-direction: column;
    align-items: flex-start;

    .title {
      font-size: 32px;
    }

    .image-holder {
      width: 100%;
    }
  }

  @media only screen and (max-width: 425px) {
    gap: 1rem;

    .title {
      font-size: 26px;
    }
    .title + * {
      font-size: 13px;
    }
    .button-link {
      font-size: 13px;
      padding: 0.66rem 0.95rem;
    }
  }
`;

// ===============================================
interface Props {
  title: string;
  image?: string | null;
  imageLabel?: string;
  eyebrow?: string;
  buttonText: string;
  description: string;
  href?: string;
  titleValues?: Record<string, string | number>;
  descriptionValues?: Record<string, string | number>;
}
// ===============================================

export default function CarouselCard1({
  title,
  image,
  imageLabel,
  eyebrow,
  buttonText,
  description,
  href,
  titleValues,
  descriptionValues
}: Props) {
  const t = useTranslation();
  const pathname = usePathname();
  const pageType = resolvePageType(pathname);
  const handleCtaClick = () => {
    if (!href) {
      return;
    }

    void trackEvent({
      event_name: "cta_click",
      event_category: "engagement",
      tenant_id: env.clientSlug,
      page_type: pageType,
      component_type: "hero",
      component_id: "home_hero_carousel_card",
      cta_id: "home.hero.shop_now",
      cta_name: "open_listing",
      cta_type: "primary",
      cta_context: "navigation",
      cta_location: "hero",
      schema_version: EVENT_SCHEMA_VERSION,
      metadata: {
        href,
        title,
      },
      data: {
        href,
        title,
      },
    });
  };
  const content = (
    <div className="content">
      {eyebrow ? (
        <Typography className="eyebrow" color="primary.main" fontWeight="700">
          {eyebrow}
        </Typography>
      ) : null}

      <h1 className="title">
        {t(title, { defaultMessage: title, values: titleValues })}
      </h1>
        <Typography color="secondary.main" mb="1.35rem">
        {t(description, { defaultMessage: description, values: descriptionValues })}
        </Typography>

      {href ? (
        <Link href={href} onClick={handleCtaClick}>
          <Button className="button-link" variant="contained" color="primary" p="1rem 1.5rem">
            {t(buttonText, { defaultMessage: buttonText })}
          </Button>
        </Link>
      ) : (
        <Button className="button-link" variant="contained" color="primary" p="1rem 1.5rem">
          {t(buttonText, { defaultMessage: buttonText })}
        </Button>
      )}
    </div>
  );

  return (
    <StyledCarouselCard1>
      {content}
      <div className="image-holder">
        {image ? (
          <Image
            src={image}
            alt={imageLabel ?? t("home.hero.imageAlt", { defaultMessage: "Featured product" })}
            width={300}
            height={300}
            style={{ width: "100%", height: "auto", objectFit: "contain" }}
          />
        ) : (
          <Typography
            className="image-fallback"
            fontSize={36}
            fontWeight="700"
            color="primary.main"
            lineHeight={1.1}>
            {imageLabel ?? t("contact.page.fallback.siteName", { defaultMessage: "Nuestra tienda" })}
          </Typography>
        )}
      </div>
    </StyledCarouselCard1>
  );
}
