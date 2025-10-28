import StorefrontGuard from "@/components/storefront/StorefrontGuard";

import WishlistPage from "./wishlist-page";

export const metadata = {
  title: "Wishlist · Storefront"
};

export default function AccountWishlistPage() {
  return (
    <StorefrontGuard>
      <WishlistPage />
    </StorefrontGuard>
  );
}
