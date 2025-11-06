"use client";

import { IconHeartFilled } from "@tabler/icons-react";

import Box from "@component/Box";
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";

import { WishlistContent } from "@/app/(storefront)/account/wish-list/wishlist-page";
import { useTranslation } from "@/state/i18n-context";

export default function AccountWishListPage() {
  const t = useTranslation();

  return (
    <Box display="flex" flexDirection="column" style={{ gap: "1.5rem" }}>
      <DashboardPageHeader
        title={t("My Wish List")}
        Icon={<IconHeartFilled size={27} />}
        button={<Button color="primary">{t("Add All to Cart")}</Button>}
      />
      <WishlistContent />
    </Box>
  );
}
