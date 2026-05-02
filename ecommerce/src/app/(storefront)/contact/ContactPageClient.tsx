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
import { useI18n, useTranslation } from "@/state/i18n-context";
import { resolveLocalizedSiteRoute } from "@/lib/site-routes";

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

const formatWhatsAppHref = (value: string) => {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
};

type SummaryItem = {
  key: string;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
};

const isSummaryItem = (item: SummaryItem | null): item is SummaryItem => Boolean(item);

export default function ContactPageClient() {
  const config = useStorefrontConfig();
  const t = useTranslation();
  const { locale } = useI18n();
  const shopHref = resolveLocalizedSiteRoute("shop", locale);

  const companyProfile = config.companyProfile;
  const tradeName =
    companyProfile?.tradeName ??
    companyProfile?.legalName ??
    config.seo.siteName ??
    t("contact.page.fallback.siteName", { defaultMessage: "Urucortinas" });

  const email = companyProfile?.email?.trim() || null;
  const phone = companyProfile?.phone?.trim() || null;
  const whatsappHref = phone ? formatWhatsAppHref(phone) : null;
  const address =
    [companyProfile?.addressLine1, companyProfile?.addressLine2].filter(Boolean).join(", ").trim() ||
    null;
  const website = companyProfile?.website?.trim() || null;

  const summaryItems = useMemo<SummaryItem[]>(
    () =>
      ([
        whatsappHref
          ? {
              key: "whatsapp",
              label: t("contact.page.labels.whatsapp", { defaultMessage: "WhatsApp" }),
              value: phone ?? t("contact.page.fallback.whatsapp", { defaultMessage: "Escribinos por WhatsApp" }),
              href: whatsappHref,
              external: true,
            }
          : null,
        email
          ? {
              key: "email",
              label: t("contact.page.labels.email", { defaultMessage: "Correo" }),
              value: email,
              href: formatContactHref(email, "email"),
            }
          : null,
        phone
          ? {
              key: "phone",
              label: t("contact.page.labels.phone", { defaultMessage: "Teléfono" }),
              value: phone,
              href: formatContactHref(phone, "phone"),
            }
          : null,
        address
          ? {
              key: "address",
              label: t("contact.page.labels.address", { defaultMessage: "Dirección" }),
              value: address,
            }
          : null,
        website
          ? {
              key: "website",
              label: t("contact.page.labels.website", { defaultMessage: "Sitio web" }),
              value: website,
              href: website,
              external: true,
            }
          : null,
      ] as Array<SummaryItem | null>).filter(isSummaryItem),
    [address, email, phone, t, website, whatsappHref],
  ) as SummaryItem[];

  const channelCards = useMemo(
    () => [
      {
        key: "whatsapp",
        title: t("contact.page.channel.whatsapp.title", { defaultMessage: "WhatsApp para presupuestos" }),
        body: t("contact.page.channel.whatsapp.body", {
          defaultMessage:
            "Escribinos por WhatsApp para responder más rápido, compartir medidas y resolver dudas de producto, instalación o entrega."
        }),
        ctaLabel: t("contact.page.channel.whatsapp.cta", { defaultMessage: "Escribir por WhatsApp" }),
        href: whatsappHref ?? (email ? formatContactHref(email, "email") : shopHref),
        external: Boolean(whatsappHref || email),
      },
      {
        key: "sales",
        title: t("contact.page.channel.sales.title", { defaultMessage: "Ventas y presupuestos" }),
        body: t("contact.page.channel.sales.body", {
          defaultMessage:
            "Si ya estás comparando opciones, entrá al catálogo para revisar productos, materiales y variantes antes de escribirnos."
        }),
        ctaLabel: t("contact.page.channel.sales.cta", { defaultMessage: "Ver productos" }),
        href: shopHref,
        external: false,
      },
      {
        key: "support",
        title: t("contact.page.channel.support.title", { defaultMessage: "Instalación y soporte" }),
        body: t("contact.page.channel.support.body", {
          defaultMessage:
            "Consultanos por instalación, mantenimiento, reparaciones o seguimiento de pedidos en Uruguay."
        }),
        ctaLabel: t("contact.page.channel.support.cta", { defaultMessage: "Escribir" }),
        href: email ? formatContactHref(email, "email") : undefined,
        external: true,
      },
      {
        key: "hours",
        title: t("contact.page.hours.title", { defaultMessage: "Horarios" }),
        lines: [
          t("contact.page.hours.weekdays", {
            defaultMessage: "Lunes a viernes: 9:00 a 18:00"
          }),
          t("contact.page.hours.saturday", {
            defaultMessage: "Sábado: 9:00 a 13:00"
          }),
          t("contact.page.hours.sunday", { defaultMessage: "Domingo: cerrado" }),
        ],
      },
    ],
    [email, shopHref, t, whatsappHref],
  );

  return (
    <Container mt="3rem" mb="5rem">
      <HeroCard>
        <Grid container spacing={6}>
          <Grid item md={7} xs={12}>
            <SemiSpan color="primary.main" display="block" mb="0.75rem" fontWeight={700}>
              {t("contact.page.eyebrow", { defaultMessage: "Contacto" })}
            </SemiSpan>
            <H1 mb="1rem">
              {t("contact.page.title", {
                defaultMessage: "Planifiquemos tu próximo proyecto con {storeName}.",
                values: { storeName: tradeName }
              })}
            </H1>
            <Paragraph color="text.muted" maxWidth="640px" mb="1.5rem">
              {t("contact.page.subtitle", {
                defaultMessage:
                  "Escribinos por WhatsApp para cotizar más rápido, coordinar una visita o resolver dudas de instalación y mantenimiento."
              })}
            </Paragraph>

            <FlexBox flexWrap="wrap" style={{ gap: "0.75rem" }}>
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <Button color="primary" variant="contained">
                    {t("contact.page.actions.whatsapp", { defaultMessage: "WhatsApp" })}
                  </Button>
                </a>
              ) : null}
              {email ? (
                <a href={formatContactHref(email, "email")} style={{ textDecoration: "none" }}>
                  <Button color="primary" variant="contained">
                    {t("contact.page.actions.email", { defaultMessage: "Enviar correo electrónico" })}
                  </Button>
                </a>
              ) : null}
              {phone ? (
                <a href={formatContactHref(phone, "phone")} style={{ textDecoration: "none" }}>
                  <Button color="primary" variant="outlined">
                    {t("contact.page.actions.call", { defaultMessage: "Llamar ahora" })}
                  </Button>
                </a>
              ) : null}
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
                {t("contact.page.summary.title", { defaultMessage: "Datos de contacto" })}
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
