"use client";

import { IconHeartFilled } from "@tabler/icons-react";

import Box from "@component/Box";
import { Button } from "@component/buttons";
import DashboardPageHeader from "@component/DashboardPageHeader";

import { WishlistContent } from "@/app/(storefront)/account/wish-list/wishlist-page";

export default function AccountWishListPage() {
  return (
    <Box display="flex" flexDirection="column" gap="1.5rem">
      <DashboardPageHeader
        title="My Wish List"
        Icon={<IconHeartFilled size={27} />}
        button={<Button color="primary">Add All to Cart</Button>}
      />
      <WishlistContent />
    </Box>
  );
}
