"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styled from "styled-components";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";

import { IconButton, IconButtonProps } from "@component/buttons";
import { useWishlist } from "@/state/wishlist-context";

const WishlistButtonRoot = styled(IconButton)(({ theme }) => ({
  width: 36,
  height: 36,
  padding: "0.5rem",
  borderRadius: "50%",
  backgroundColor: theme.colors.body.paper,
  color: theme.colors.gray[500],
  boxShadow: theme.shadows.small,
  transition: "background-color 0.3s ease, color 0.3s ease",
  "&:hover": {
    backgroundColor: theme.colors.secondary.main,
    color: theme.colors.gray[0]
  },
  "&[data-state='active']": {
    backgroundColor: theme.colors.error.light,
    color: theme.colors.error.main
  },
  "&:disabled": {
    opacity: 0.6,
    pointerEvents: "none"
  }
}));

type ProductWishlistButtonProps = Omit<IconButtonProps, "children"> & {
  productId?: number;
  onRequireAuth?: () => void;
};

export default function ProductWishlistButton({
  productId,
  onRequireAuth,
  ...props
}: ProductWishlistButtonProps) {
  const wishlist = useWishlist();
  const router = useRouter();
  const pathname = usePathname();
  const [localFavorite, setLocalFavorite] = useState(false);

  const isFavorite = useMemo(
    () => (productId ? wishlist.hasItem(productId) : localFavorite),
    [productId, wishlist, localFavorite]
  );
  const isPending = productId ? wishlist.isPending(productId) : false;

  const handleToggle = useCallback(async () => {
    if (!productId) {
      setLocalFavorite((prev) => !prev);
      return;
    }

    if (!Number.isFinite(productId) || productId <= 0) {
      console.warn("[wishlist] Ignoring toggle for invalid product id", productId);
      return;
    }

    if (!wishlist.isAuthenticated) {
      onRequireAuth?.();
      let loginHandled = false;
      if (typeof window !== "undefined") {
        const loginEvent = new CustomEvent("storefront:auth:login", {
          detail: {
            reason: "wishlist",
            redirectTo: pathname ?? null,
            productId
          },
          cancelable: true
        });
        const dispatchResult = window.dispatchEvent(loginEvent);
        loginHandled = loginEvent.cancelable ? !dispatchResult : false;
      }

      if (!loginHandled) {
        const params = new URLSearchParams();
        if (pathname) {
          params.set("redirect", pathname);
        }
        router.push(params.size > 0 ? `/account/login?${params.toString()}` : "/account/login");
      }
      return;
    }

    try {
      await wishlist.toggle(productId);
    } catch {
      // Errors are surfaced through the wishlist context
    }
  }, [productId, wishlist, onRequireAuth, router, pathname]);

  return (
    <WishlistButtonRoot
      size="small"
      aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={isFavorite}
      onClick={handleToggle}
      disabled={isPending}
      data-state={isFavorite ? "active" : "inactive"}
      type="button"
      {...props}>
      {isFavorite ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
    </WishlistButtonRoot>
  );
}
