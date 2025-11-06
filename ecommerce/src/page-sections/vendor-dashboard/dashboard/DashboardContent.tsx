"use client";

import { Fragment } from "react";

import Card from "@component/Card";
import Avatar from "@component/avatar";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Typography, { H1, H5, Paragraph } from "@component/Typography";
import AnalyticsChart from "./AnalyticsChart";

import { currency } from "@utils/utils";

// ==============================================================
interface Props {
  sales: {
    labels: string[];
    data: number[];
  };
  summeryCards: Array<{
    amount: string;
    title: string;
    subtitle: string;
  }>;
  countrySales: Array<{
    amount: number;
    name: string;
    flagUrl?: string;
  }>;
}
// ==============================================================

export default function DashboardContent({ sales, summeryCards, countrySales }: Props) {
  const hasSummaryCards = summeryCards.length > 0;
  const hasSalesData = Array.isArray(sales?.data) && sales.data.length > 0;
  const hasCountrySales = countrySales.length > 0;

  return (
    <Fragment>
      <Grid container spacing={6}>
        {hasSummaryCards ? (
          summeryCards.map((item, ind) => (
            <Grid item lg={4} md={4} sm={6} xs={12} key={ind}>
              <Card py="1.5rem" height="100%" borderRadius={12} textAlign="center">
                <H5 color="text.muted" mb="8px">
                  {item.title}
                </H5>

                <H1 color="gray.700" mb="4px" lineHeight="1.3">
                  {item.amount}
                </H1>

                <Paragraph color="text.muted">{item.subtitle}</Paragraph>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Card py="1.5rem" px="1.5rem" height="100%" borderRadius={12} textAlign="center">
              <H5 mb="0.5rem">Summary data unavailable</H5>
              <Paragraph color="text.muted">
                We could not load the latest summary metrics. Please try refreshing later.
              </Paragraph>
            </Card>
          </Grid>
        )}

        <Grid item lg={8} xs={12}>
          <Card p="20px 30px" borderRadius={12}>
            <H5 mb="1.5rem">Sales</H5>
            {hasSalesData ? (
              <AnalyticsChart sales={sales} />
            ) : (
              <Paragraph color="text.muted">
                Sales trends are currently unavailable. We&rsquo;ll display them as soon as data is
                restored.
              </Paragraph>
            )}
          </Card>
        </Grid>

        <Grid item lg={4} xs={12}>
          <Card p="20px 30px" borderRadius={12}>
            <H5>Top Countries</H5>

            {hasCountrySales ? (
              countrySales.map((item, ind) => (
                <FlexBox alignItems="center" justifyContent="space-between" my="1rem" key={ind}>
                  <FlexBox alignItems="center">
                    <Avatar src={item.flagUrl} size={30} mr="8px" />
                    <span>{item.name}</span>
                  </FlexBox>

                  <H5>{currency(item.amount)}</H5>
                </FlexBox>
              ))
            ) : (
              <Paragraph color="text.muted">
                Country level sales breakdown is unavailable right now.
              </Paragraph>
            )}
          </Card>
        </Grid>
      </Grid>
    </Fragment>
  );
}
