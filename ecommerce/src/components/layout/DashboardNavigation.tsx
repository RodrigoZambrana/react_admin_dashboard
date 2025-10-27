"use client";

import { Fragment, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  IconPin,
  IconUser,
  IconHeart,
  // IconHelpCircle,
  // IconCreditCard,
  IconShoppingBagCheck
} from "@tabler/icons-react";

import FlexBox from "@component/FlexBox";
import Typography from "@component/Typography";
// STYLED COMPONENTS
import { DashboardNavigationWrapper, StyledDashboardNav } from "./styles";

import { useAccountOrders } from "@/hooks/useAccountOrders";
import { useAccountProfile } from "@/hooks/useAccountProfile";

export default function DashboardNavigation() {
  const pathname = usePathname();
  const { orders } = useAccountOrders();
  const { profile } = useAccountProfile();

  const dynamicNavigation = useMemo(() => {
    const totalOrders = orders.length;
    const addressCount = profile?.addresses?.length ?? 0;

    return [
      {
        title: "DASHBOARD",
        links: [
          {
            href: "/orders",
            title: "Orders",
            Icon: IconShoppingBagCheck,
            count: totalOrders
          },
          {
            href: "/wish-list",
            title: "Wishlist",
            Icon: IconHeart,
            count: 0
          }
          // {
          //   href: "/support-tickets",
          //   title: "Support Tickets",
          //   Icon: IconHelpCircle,
          //   count: 0
          // }
        ]
      },
      {
        title: "ACCOUNT SETTINGS",
        links: [
          {
            href: "/profile",
            title: "Profile Info",
            Icon: IconUser,
            count: undefined
          },
          {
            href: "/address",
            title: "Addresses",
            Icon: IconPin,
            count: addressCount
          }
          // {
          //   href: "/payment-methods",
          //   title: "Payment Methods",
          //   Icon: IconCreditCard,
          //   count: 0
          // }
        ]
      }
    ];
  }, [orders, profile?.addresses]);

  return (
    <DashboardNavigationWrapper px="0px" pb="1.5rem" color="gray.900" borderRadius={8}>
      {dynamicNavigation.map((navGroup) => (
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

              {count !== undefined && <span>{count}</span>}
            </StyledDashboardNav>
          ))}
        </Fragment>
      ))}
    </DashboardNavigationWrapper>
  );
}
