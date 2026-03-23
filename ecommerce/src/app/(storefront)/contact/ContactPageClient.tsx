"use client";

import Link from "next/link";
import { useMemo } from "react";
import styled from "styled-components";

import Box from "@component/Box";
import Card from "@component/Card";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Container from "@component/Container";
import { H1, H3, Paragraph, SemiSpan } from "@component/Typography";
import { Button } from "@component/buttons";
import { useStorefrontConfig } from "../storefront-context";
import { useTranslation } from "@/state/i18n-context";

const HeroCard = styled(Card)(({ theme }) => ({
  borderRadius: 24,
  border: `1px solid ${theme.colors.gray[300]}`,
  padding: "2rem",
  background:
    "linear-gradient(135deg, rgba(13, 148, 136, 0.12) 0%, rgba(255, 255, 255, 0.96) 60%)"
}));

const InfoCard = styled(Card)(({ theme }) => ({
  height: "100%",
  borderRadius: 18,
  border: `1px solid ${theme.colors.gray[300]}`,
  padding: "1.5rem"
}));

const formatContactHref = (value: string, type: "email" | "phone") => {
  if (type === "email") return `mailto:${value}`;
  return `tel:${value.replace(/[^\d+]/g, "")}`;
};

export default function ContactPageClient() {
  const config = useStorefrontConfig();
  const t = useTranslation();

  const companyProfile = config.companyProfile;
  const tradeName =
    companyProfile?.tradeName ??
    companyProfile?.legalName ??
    config.seo.siteName ??
    t("contact.page.fallback.siteName", { defaultMessage: "Our store" });

  const email = companyProfile?.email ?? "ventas@example.com";
  const phone = companyProfile?.phone ?? "+598 99 000 000";
  const address =
    [companyProfile?.addressLine1, companyProfile?.addressLine2].filter(Boolean).join(", ") ||
    t("contact.page.fallback.address", { defaultMessage: "Montevideo, Uruguay" });
  const website = companyProfile?.website ?? "https://example.com";

  const summaryItems = useMemo(
    () => [
      {
        key: "email",
        label: t("contact.page.labels.email", { defaultMessage: "Email" }),
        value: email,
        href: formatContactHref(email, "email"),
      },
      {
        key: "phone",
        label: t("contact.page.labels.phone", { defaultMessage: "Phone" }),
        value: phone,
        href: formatContactHref(phone, "phone"),
      },
      {
        key: "address",
        label: t("contact.page.labels.address", { defaultMessage: "Address" }),
        value: address,
      },
      {
        key: "website",
        label: t("contact.page.labels.website", { defaultMessage: "Website" }),
        value: website,
        href: website,
        external: true,
      },
    ],
    [address, email, phone, t, website],
  );

  const channelCards = useMemo(
    () => [
      {
        key: "sales",
        title: t("contact.page.channel.sales.title", { defaultMessage: "Sales and quotes" }),
        body: t("contact.page.channel.sales.body", {
          defaultMessage:
            "Use this channel to request estimates, measurements, and product recommendations."
        }),
        ctaLabel: t("contact.page.channel.sales.cta", { defaultMessage: "Browse products" }),
        href: "/shop",
        external: false,
      },
      {
        key: "support",
        title: t("contact.page.channel.support.title", { defaultMessage: "Customer support" }),
        body: t("contact.page.channel.support.body", {
          defaultMessage:
            "Share questions about deliveries, installations, or existing orders through the official support channel."
        }),
        ctaLabel: t("contact.page.channel.support.cta", { defaultMessage: "Contact support" }),
        href: formatContactHref(email, "email"),
        external: true,
      },
      {
        key: "hours",
        title: t("contact.page.hours.title", { defaultMessage: "Hours" }),
        lines: [
          t("contact.page.hours.weekdays", {
            defaultMessage: "Monday to Friday: 9:00 to 18:00"
          }),
          t("contact.page.hours.saturday", {
            defaultMessage: "Saturday: 9:00 to 13:00"
          }),
          t("contact.page.hours.sunday", { defaultMessage: "Sunday: closed" }),
        ],
      },
    ],
    [email, t],
  );

  return (
    <Container mt="3rem" mb="5rem">
      <HeroCard>
        <Grid container spacing={6}>
          <Grid item md={7} xs={12}>
            <SemiSpan color="primary.main" display="block" mb="0.75rem" fontWeight={700}>
              {t("contact.page.eyebrow", { defaultMessage: "Contact" })}
            </SemiSpan>
            <H1 mb="1rem">
              {t("contact.page.title", {
                defaultMessage: "Let's plan your next project with {storeName}.",
                values: { storeName: tradeName }
              })}
            </H1>
            <Paragraph color="text.muted" maxWidth="640px" mb="1.5rem">
              {t("contact.page.subtitle", {
                defaultMessage:
                  "Choose the channel that best fits your question and our team will get back to you as soon as possible."
              })}
            </Paragraph>

            <FlexBox flexWrap="wrap" style={{ gap: "0.75rem" }}>
              <a href={formatContactHref(email, "email")} style={{ textDecoration: "none" }}>
                <Button color="primary" variant="contained">
                  {t("contact.page.actions.email", { defaultMessage: "Write to us" })}
                </Button>
              </a>
              <a href={formatContactHref(phone, "phone")} style={{ textDecoration: "none" }}>
                <Button color="primary" variant="outlined">
                  {t("contact.page.actions.call", { defaultMessage: "Call now" })}
                </Button>
              </a>
            </FlexBox>
          </Grid>

          <Grid item md={5} xs={12}>
            <Box
              borderRadius={18}
              bg="white"
              p="1.5rem"
              border="1px solid"
              borderColor="gray.300"
              height="100%">
              <H3 mb="1rem">
                {t("contact.page.summary.title", { defaultMessage: "Contact details" })}
              </H3>
              <FlexBox flexDirection="column" style={{ gap: "1rem" }}>
                {summaryItems.map((item) => (
                  <Box key={item.key}>
                    <SemiSpan display="block" mb="0.25rem" fontWeight={700} color="text.muted">
                      {item.label}
                    </SemiSpan>
                    {item.href ? (
                      <a
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        rel={item.external ? "noreferrer" : undefined}
                        style={{ color: "inherit", textDecoration: "none" }}>
                        <Paragraph>{item.value}</Paragraph>
                      </a>
                    ) : (
                      <Paragraph>{item.value}</Paragraph>
                    )}
                  </Box>
                ))}
              </FlexBox>
            </Box>
          </Grid>
        </Grid>
      </HeroCard>

      <Grid container spacing={6} mt="1.5rem">
        {channelCards.map((card) => (
          <Grid item md={4} xs={12} key={card.key}>
            <InfoCard>
              <H3 mb="0.75rem">{card.title}</H3>
              {"body" in card && card.body ? (
                <Paragraph color="text.muted" mb="1rem">
                  {card.body}
                </Paragraph>
              ) : null}
              {"lines" in card && card.lines ? (
                <FlexBox flexDirection="column" style={{ gap: "0.5rem" }}>
                  {card.lines.map((line) => (
                    <Paragraph color="text.muted" key={line}>
                      {line}
                    </Paragraph>
                  ))}
                </FlexBox>
              ) : null}
              {"href" in card && card.href ? (
                card.external ? (
                  <a href={card.href} style={{ textDecoration: "none" }}>
                    <Button variant="text" color="primary">
                      {card.ctaLabel}
                    </Button>
                  </a>
                ) : (
                  <Link href={card.href}>
                    <Button variant="text" color="primary">
                      {card.ctaLabel}
                    </Button>
                  </Link>
                )
              ) : null}
            </InfoCard>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
