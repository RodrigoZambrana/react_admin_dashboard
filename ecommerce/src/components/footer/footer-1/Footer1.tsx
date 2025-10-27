"use client";

import Link from "next/link";

import Box from "@component/Box";
import Image from "@component/Image";
import Grid from "@component/grid/Grid";
import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import AppStore from "@component/AppStore";
import Container from "@component/Container";
import Typography, { Paragraph } from "@component/Typography";
// STYLED COMPONENTS
// CUSTOM DATA
import { iconList } from "./data";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";

export default function Footer1() {
  const storefrontConfig = useStorefrontConfig();
  const companyProfile = storefrontConfig.companyProfile;
  const logoSrc = companyProfile?.logo ?? "/assets/images/logo.svg";
  const brandName =
    companyProfile?.tradeName ??
    companyProfile?.legalName ??
    (typeof storefrontConfig.seo?.siteName === "string"
      ? storefrontConfig.seo.siteName
      : "Storefront");
  const email = companyProfile?.email ?? "uilib.help@gmail.com";
  const phone = companyProfile?.phone ?? "+1 1123 456 780";
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
                  <Image alt={brandName} mb="1rem" src={logoSrc} height="44px" />
                </Link>

                <Paragraph mb="1.25rem" color="gray.500" maxWidth="320px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Auctor libero id et, in
                  gravida. Sit diam duis mauris nulla cursus. Erat et lectus vel ut sollicitudin
                  elit at amet.
                </Paragraph>

                <AppStore />
              </Grid>

              <Grid item lg={6} md={6} sm={6} xs={12}>
                <Typography mb="1.25rem" lineHeight="1" fontSize={20} fontWeight="600">
                  Contact Us
                </Typography>

                {addressLines.length > 0 &&
                  addressLines.map((line, index) => (
                    <Typography key={`address-line-${index}`} py="0.3rem" color="gray.500">
                      {line}
                    </Typography>
                  ))}

                {email && (
                  <Typography py="0.3rem" color="gray.500">
                    Email: {email}
                  </Typography>
                )}

                {phone && (
                  <Typography py="0.3rem" mb="1rem" color="gray.500">
                    Phone: {phone}
                  </Typography>
                )}

                <FlexBox className="flex" mx="-5px">
                  {iconList.map((item) => (
                    <a
                      href={item.url}
                      target="_blank"
                      key={item.iconName}
                      rel="noreferrer noopenner">
                      <Box m="5px" p="10px" size="small" borderRadius="50%" bg="rgba(0,0,0,0.2)">
                        <Icon size="12px" defaultColor="auto">
                          {item.iconName}
                        </Icon>
                      </Box>
                    </a>
                  ))}
                </FlexBox>
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>
    </footer>
  );
}
