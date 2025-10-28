"use client";

import { useCallback, useMemo, useState } from "react";
import styled from "styled-components";
import { IconEye, IconShoppingCart } from "@tabler/icons-react";

import { IconButton } from "@component/buttons";
import ProductQuickView from "@component/products/ProductQuickView";
import ProductWishlistButton from "./ProductWishlistButton";

type FlexDirection = "row" | "column";

const ActionsRoot = styled.div<{ $direction: FlexDirection }>(({ $direction }) => ({
  display: "flex",
  flexDirection: $direction,
  gap: "0.5rem",
  alignItems: $direction === "row" ? "center" : "stretch",
  "&.overlay-actions": {
    opacity: 0,
    pointerEvents: "none",
    transform: "translateY(-4px)",
    transition: "opacity 0.2s ease, transform 0.2s ease"
  },
  "&.overlay-actions.overlay-visible": {
    opacity: 1,
    pointerEvents: "auto",
    transform: "none"
  }
}));

const IconGroup = styled.div(({ theme }) => ({
  display: "flex",
  gap: "0.35rem",
  alignItems: "center",
  "& a, & button": {
    width: 36,
    height: 36,
    padding: "0.5rem",
    borderRadius: "50%",
    backgroundColor: theme.colors.body.paper,
    boxShadow: theme.shadows.small,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.2s ease, color 0.2s ease",
    color: theme.colors.gray[600],
    textDecoration: "none"
  },
  "& a:hover, & button:hover:not(:disabled)": {
    backgroundColor: theme.colors.primary.light,
    color: theme.colors.primary.main
  },
  "& button:disabled": {
    cursor: "not-allowed",
    opacity: 0.6
  }
}));

export interface ProductQuickActionsProps {
  productId?: number | string;
  productSlug?: string;
  productTitle: string;
  productPrice?: number;
  productImages?: string[];
  productImage?: string | null;
  className?: string;
  style?: React.CSSProperties;
  direction?: FlexDirection;
  showQuickViewButton?: boolean;
  compact?: boolean;
  onAddToCart?: () => void;
  cartDisabled?: boolean;
  disableOverlay?: boolean;
}

const sanitizeProductId = (value?: number | string): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildImageList = (images?: string[], fallback?: string | null): string[] => {
  const collected = [
    ...(Array.isArray(images) ? images.filter((item) => typeof item === "string" && item.trim()) : []),
    ...(fallback && typeof fallback === "string" && fallback.trim() ? [fallback] : [])
  ];
  return Array.from(new Set(collected));
};

export default function ProductQuickActions({
  productId,
  productSlug,
  productTitle,
  productPrice,
  productImages,
  productImage,
  className,
  style,
  direction = "column",
  showQuickViewButton = true,
  compact = false,
  onAddToCart,
  cartDisabled = false,
  disableOverlay = false
}: ProductQuickActionsProps) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  const numericProductId = useMemo(() => sanitizeProductId(productId), [productId]);
  const quickViewImages = useMemo(
    () => buildImageList(productImages, productImage ?? null),
    [productImages, productImage]
  );
  const canOpenQuickView = quickViewImages.length > 0;
  const quickViewProductId = numericProductId ?? productId ?? productSlug ?? productTitle;

  const handleOpenQuickView = useCallback(() => {
    if (!canOpenQuickView) return;
    setQuickViewOpen(true);
  }, [canOpenQuickView]);

  const handleCloseQuickView = useCallback(() => setQuickViewOpen(false), []);

  const buttonSize = compact ? 32 : 36;
  const iconSize = compact ? 16 : 18;
  const shouldRenderQuickViewIcon = showQuickViewButton;
  const cartEnabled = typeof onAddToCart === "function" && !cartDisabled;
  const rootClassName = useMemo(() => {
    const tokens = new Set<string>();
    if (className) {
      className
        .split(/\s+/)
        .filter(Boolean)
        .forEach((token) => tokens.add(token));
    }
    if (!disableOverlay) {
      tokens.add("overlay-actions");
    }
    return Array.from(tokens).join(" ").trim() || undefined;
  }, [className, disableOverlay]);

  return (
    <>
      <ActionsRoot className={rootClassName} style={style} $direction={direction}>
        <IconGroup>
          {shouldRenderQuickViewIcon ? (
            <IconButton
              aria-label="Quick view"
              onClick={handleOpenQuickView}
              disabled={!canOpenQuickView}
              size="small"
              variant="text"
              style={{ width: buttonSize, height: buttonSize, padding: "0.45rem" }}>
              <IconEye size={iconSize} />
            </IconButton>
          ) : null}

          <ProductWishlistButton
            size="small"
            productId={numericProductId}
            style={{ width: buttonSize, height: buttonSize, padding: "0.45rem" }}
          />

          <IconButton
            aria-label="Add to cart"
            onClick={cartEnabled ? onAddToCart : undefined}
            disabled={!cartEnabled}
            size="small"
            variant="text"
            style={{ width: buttonSize, height: buttonSize, padding: "0.45rem" }}>
            <IconShoppingCart size={iconSize} />
          </IconButton>
        </IconGroup>
      </ActionsRoot>

      {showQuickViewButton && canOpenQuickView ? (
        <ProductQuickView
          open={quickViewOpen}
          onClose={handleCloseQuickView}
          product={{
            id: quickViewProductId,
            slug: productSlug ?? String(quickViewProductId),
            title: productTitle,
            price: productPrice ?? 0,
            images: quickViewImages
          }}
        />
      ) : null}
    </>
  );
}
