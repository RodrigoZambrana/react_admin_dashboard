import Link from "next/link";

import Card from "@component/Card";
import Grid from "@component/grid/Grid";
import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import Container from "@component/Container";
import { H4, SemiSpan } from "@component/Typography";
import { defaultMarket1ServiceList } from "@/data/market1Defaults";
import { useTranslation } from "@/state/i18n-context";

export default function Section12() {
  const serviceList = defaultMarket1ServiceList;
  const t = useTranslation();

  return (
    <Container mb="70px">
      <Grid container spacing={6}>
        {serviceList.map((item) => {
          const content = (
            <FlexBox
              p="3rem"
              as={Card}
              hoverEffect
              height="100%"
              borderRadius={8}
              boxShadow="border"
              alignItems="center"
              flexDirection="column">
              <FlexBox
                size="64px"
                bg="gray.200"
                alignItems="center"
                borderRadius="300px"
                justifyContent="center">
                <Icon color="secondary" size="1.75rem">
                  {item.icon}
                </Icon>
              </FlexBox>

              <H4 mt="20px" mb="10px" textAlign="center">
                {t(item.title)}
              </H4>

              {item.description ? (
                <SemiSpan textAlign="center">{t(item.description)}</SemiSpan>
              ) : null}
            </FlexBox>
          );

          return (
            <Grid item lg={3} md={6} xs={12} key={item.id}>
              {item.href ? (
                <Link href={item.href} style={{ display: "block", height: "100%" }}>
                  {content}
                </Link>
              ) : (
                content
              )}
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
}
