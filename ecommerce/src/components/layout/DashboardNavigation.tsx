"use client";

import { Fragment, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  IconPin,
  IconUser,
  IconHeart,
  IconShoppingBagCheck
} from "@tabler/icons-react";

import FlexBox from "@component/FlexBox";
import Typography from "@component/Typography";
// STYLED COMPONENTS
import { DashboardNavigationWrapper, StyledDashboardNav } from "./styles";

import { useAccountOrders } from "@/hooks/useAccountOrders";
import { useAccountProfile } from "@/hooks/useAccountProfile";
import { useTranslation } from "@/state/i18n-context";

export default function DashboardNavigation() {
  const pathname = usePathname();
  const { orders } = useAccountOrders();
  const { profile } = useAccountProfile();
  const t = useTranslation();

  const dynamicNavigation = useMemo(() => {
    const totalOrders = orders.length;
    const addressCount = profile?.addresses?.length ?? 0;
    const basePath = "/account";
    const resolveHref = (target: string) => {
      const normalized = target.startsWith("/") ? target : `/${target}`;
      return `${basePath}${normalized}`;
    };

    return [
      {
        title: "ACCOUNT SETTINGS",
        links: [
          {
            href: resolveHref("/profile"),
            title: "Profile Info",
            Icon: IconUser,
            count: undefined
          },
          {
            href: resolveHref("/address"),
            title: "Addresses",
            Icon: IconPin,
            count: addressCount
          }
        ]
      },
      {
        title: "DASHBOARD",
        links: [
          {
            href: resolveHref("/orders"),
            title: "Orders",
            Icon: IconShoppingBagCheck,
            count: totalOrders
          },
          {
            href: resolveHref("/wish-list"),
            title: "Wishlist",
            Icon: IconHeart,
            count: profile?.wishlistCount ?? 0
          }
        ]
      }
    ];
  }, [orders, profile?.addresses, profile?.wishlistCount]);

  return (
    <DashboardNavigationWrapper px="0px" pb="1.5rem" color="gray.900" borderRadius={8}>
      {dynamicNavigation.map((navGroup) => (
        <Fragment key={navGroup.title}>
          <Typography p="26px 30px 1rem" color="text.muted" fontSize="12px">
            {t(navGroup.title)}
          </Typography>

          {navGroup.links.map(({ Icon, count, href, title }) => {
            const currentPath = pathname ?? "";
            const isActive = currentPath === href || currentPath.startsWith(`${href}/`);

            return (
              <StyledDashboardNav href={href} key={title} isActive={isActive}>
                <FlexBox alignItems="center" style={{ gap: 8 }}>
                  <Icon size={20} className="icon" />

                  <span>{t(title)}</span>
                </FlexBox>

                {count !== undefined && <span>{count}</span>}
              </StyledDashboardNav>
            );
          })}
        </Fragment>
      ))}
    </DashboardNavigationWrapper>
  );
}
