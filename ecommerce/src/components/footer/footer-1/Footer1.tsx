"use client";

import Link from "next/link";

import Box from "@component/Box";
import Image from "@component/Image";
import Grid from "@component/grid/Grid";
import Container from "@component/Container";
import Typography, { Paragraph } from "@component/Typography";
// STYLED COMPONENTS
// CUSTOM DATA
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { useTranslation } from "@/state/i18n-context";

export default function Footer1() {
  const storefrontConfig = useStorefrontConfig();
  const t = useTranslation();
  const companyProfile = storefrontConfig.companyProfile;
  const logoSrc = companyProfile?.logo ?? null;
  const brandName =
    companyProfile?.tradeName ??
    companyProfile?.legalName ??
    (typeof storefrontConfig.seo?.siteName === "string"
      ? storefrontConfig.seo.siteName
      : "Storefront");
  const email = companyProfile?.email ?? null;
  const phone = companyProfile?.phone ?? null;
  const addressLines = [companyProfile?.addressLine1, companyProfile?.addressLine2].filter(
    (line): line is string => Boolean(line)
  );

  return (
    <footer>
      <Box bg="#0F3460">
        <Container p="1rem" color="white">
          <Box py="5rem" overflow="hidden">
            <Grid container spacing={6}>
              <Grid item lg={6} md={6} sm={6} xs={12}>
                <Link href="/">
                  {logoSrc ? (
                    <Image alt={brandName} mb="1rem" src={logoSrc} height="44px" />
                  ) : (
                    <Typography mb="1rem" fontSize={28} fontWeight="700" color="white">
                      {brandName}
                    </Typography>
                  )}
                </Link>

                <Paragraph mb="1.25rem" color="gray.500" maxWidth="320px">
                  {t("footer.description.default", {
                    defaultMessage:
                      "Soluciones en cortinas roller, toldos, persianas y aberturas en aluminio con fabricación a medida en Uruguay."
                  })}
                </Paragraph>

                {/* <AppStore /> */}
              </Grid>

              <Grid item lg={6} md={6} sm={6} xs={12}>
                <Typography mb="1.25rem" lineHeight="1" fontSize={20} fontWeight="600">
                  {t("Contact Us")}
                </Typography>

                {addressLines.length > 0 &&
                  addressLines.map((line, index) => (
                    <Typography key={`address-line-${index}`} py="0.3rem" color="gray.500">
                      {line}
                    </Typography>
                  ))}

                {email && (
                  <Typography py="0.3rem" color="gray.500">
                    {t("contact.page.labels.email", { defaultMessage: "Email" })}: {email}
                  </Typography>
                )}

                {phone && (
                  <Typography py="0.3rem" mb="1rem" color="gray.500">
                    {t("contact.page.labels.phone", { defaultMessage: "Phone" })}: {phone}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>
    </footer>
  );
}
