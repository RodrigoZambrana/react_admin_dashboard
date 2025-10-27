"use client";

import { usePathname } from "next/navigation";
import { PropsWithChildren } from "react";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
// STYLED COMPONENTS
import { StyledGrid } from "../styles";
import { DashboardNavigationWrapper, StyledDashboardNav } from "../styles";

import { NAVIGATION_LINKS } from "./navigation";

export default function VendorDashboardLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return (
    <Grid container spacing={6}>
      <StyledGrid item lg={3} xs={12}>
        <DashboardNavigationWrapper px="0px" py="1.5rem" color="gray.900" borderRadius={12}>
          {NAVIGATION_LINKS.map(({ href, title, Icon, count }) => (
            <StyledDashboardNav href={href} key={title} isActive={pathname.includes(href)}>
              <FlexBox alignItems="center" style={{ gap: 8 }}>
                <Icon size={18} className="icon" />
                <span>{title}</span>
              </FlexBox>

              <span>{count}</span>
            </StyledDashboardNav>
          ))}
        </DashboardNavigationWrapper>
      </StyledGrid>

      <Grid item lg={9} xs={12}>
        {children}
      </Grid>
    </Grid>
  );
}
