"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import {
  IconPin,
  IconUser,
  IconHeart,
  IconHelpCircle,
  IconCreditCard,
  IconShoppingBagCheck
} from "@tabler/icons-react";

import FlexBox from "@component/FlexBox";
import Typography from "@component/Typography";
// STYLED COMPONENTS
import { DashboardNavigationWrapper, StyledDashboardNav } from "./styles";

export default function DashboardNavigation() {
  const pathname = usePathname();

  return (
    <DashboardNavigationWrapper px="0px" pb="1.5rem" color="gray.900" borderRadius={8}>
      {NAVIGATION_LINKS.map((navGroup) => (
        <Fragment key={navGroup.title}>
          <Typography p="26px 30px 1rem" color="text.muted" fontSize="12px">
            {navGroup.title}
          </Typography>

          {navGroup.links.map(({ Icon, count, href, title }) => (
            <StyledDashboardNav href={href} key={title} isActive={pathname.includes(href)}>
              <FlexBox alignItems="center" style={{ gap: 8 }}>
                <Icon size={20} className="icon" />

                <span>{title}</span>
              </FlexBox>

              <span>{count}</span>
            </StyledDashboardNav>
          ))}
        </Fragment>
      ))}
    </DashboardNavigationWrapper>
  );
}

const NAVIGATION_LINKS = [
  {
    title: "DASHBOARD",
    links: [
      {
        href: "/orders",
        title: "Orders",
        Icon: IconShoppingBagCheck,
        count: 5
      },
      {
        href: "/wish-list",
        title: "Wishlist",
        Icon: IconHeart,
        count: 19
      },
      {
        href: "/support-tickets",
        title: "Support Tickets",
        Icon: IconHelpCircle,
        count: 1
      }
    ]
  },
  {
    title: "ACCOUNT SETTINGS",
    links: [
      {
        href: "/profile",
        title: "Profile Info",
        Icon: IconUser,
        count: 3
      },
      {
        href: "/address",
        title: "Addresses",
        Icon: IconPin,
        count: 16
      },
      {
        href: "/payment-methods",
        title: "Payment Methods",
        Icon: IconCreditCard,
        count: 4
      }
    ]
  }
];
