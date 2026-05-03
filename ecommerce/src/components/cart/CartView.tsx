"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styled from "styled-components";
import { IconMinus, IconPlus, IconX } from "@tabler/icons-react";
import { SpaceProps, space } from "styled-system";

import Box from "@component/Box";
import Grid from "@component/grid/Grid";
import { Card1 } from "@component/Card1";
import Divider from "@component/Divider";
import FlexBox from "@component/FlexBox";
import TextField from "@component/text-field";
import Select from "@component/Select";
import Typography, { Paragraph } from "@component/Typography";
import { Button, IconButton } from "@component/buttons";
import LazyImage from "@component/LazyImage";
import NoImagePlaceholder from "@component/NoImagePlaceholder";
import countryList from "@data/countryList";
import { isValidProp } from "@utils/utils";
import { isMissingProductImage } from "@/lib/utils/image";

import { type CartLineItem, useStorefrontCart } from "@/state/cart-context";
import {
  buildPublishedParametricDetailHref,
  buildPublishedParametricSummaryEntries
} from "@/lib/storefront/published-parametric";
import { normalizeMoney } from "@/lib/utils/format";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter";
import { useTranslation } from "@/state/i18n-context";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { EVENT_SCHEMA_VERSION } from "@/lib/analytics/eventSchema";
import { env } from "@/lib/env";
import { resolvePageType } from "@/lib/analytics/pageType";
import { useComponentTracking } from "@/lib/analytics/useComponentTracking";
import { buildCanonicalAnalyticsContext } from "@/lib/analytics/product-context";
import CheckoutCostSummary from "./CheckoutCostSummary";

// Feature flag to re-enable voucher and shipping estimators when backend is ready.
const SHOW_VOUCHER_AND_SHIPPING = false;

type CartLineItemCardProps = SpaceProps & {
  item: CartLineItem;
  pageType: string;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
};

const CartLineItemWrapper = styled.div.withConfig({
  shouldForwardProp: (prop) => isValidProp(prop)
})<SpaceProps>`
  display: flex;
  overflow: hidden;
  position: relative;
  border-radius: 12px;
  box-shadow: ${({ theme }) => theme.shadows.small};
  background-color: ${({ theme }) => theme.colors.body.paper};

  .product-details {
    padding: 20px;
  }

  .title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  @media only screen and (max-width: 425px) {
    flex-wrap: wrap;

    img {
      height: auto;
      min-width: 100%;
    }
  }

  ${space}
`;

function CartLineItemCard({ item, pageType, onIncrease, onDecrease, onRemove, ...rest }: CartLineItemCardProps) {
  const unitPrice = normalizeMoney(item.product.salePrice ?? item.product.price);
  const lineTotal = normalizeMoney({
    amount: unitPrice.amount * item.quantity,
    currency: unitPrice.currency
  });
  const { formatMoney } = useMoneyFormatter();
  const t = useTranslation();

      const thumbnailSrc = item.product.thumbnail?.url;
  const hasImage = thumbnailSrc && !isMissingProductImage(thumbnailSrc);
  const displayName = item.product.name;
  const attributeSummary = item.product.attributes
    ?.map((attribute) => attribute.label ?? attribute.value ?? attribute.valueKey)
    .join(" • ");
  const parametricSummary = buildPublishedParametricSummaryEntries(item.product.configuration, t, {
    includeMaterial: false
  })
    .map((entry) => `${entry.attribute}: ${entry.value}`)
    .join(" • ");
  const detailSummary =
    parametricSummary || item.product.selectionSummary || item.product.variantLabel || null;
  const detailHref = buildPublishedParametricDetailHref(
    item.product.slug,
    item.product.configuration,
    item.product.id,
  );
  const handleRemove = () => {
    const canonicalContext = buildCanonicalAnalyticsContext({
      canonicalConfiguration: item.product.canonicalConfiguration ?? null,
      configuration: item.product.configuration ?? null
    });
    void trackEvent({
      event_name: "remove_from_cart",
      event_category: "ecommerce",
      tenant_id: env.clientSlug,
      page_type: pageType,
      component_type: "cart_line_item",
      component_id: `cart_line_item_${String(item.product.id)}`,
      cta_id: "cart.line_item.remove",
      cta_name: "remove_from_cart",
      cta_type: "secondary",
      cta_context: "checkout",
      cta_location: "cart_line_item",
      schema_version: EVENT_SCHEMA_VERSION,
      metadata: {
        product_id: item.product.id,
        product_slug: item.product.slug,
        quantity: item.quantity,
        unit_price: unitPrice.amount,
        line_total: lineTotal.amount,
        currency: unitPrice.currency,
        ...canonicalContext
      },
      data: {
        product_id: item.product.id,
        product_slug: item.product.slug,
        quantity: item.quantity,
        unit_price: unitPrice.amount,
        line_total: lineTotal.amount,
        currency: unitPrice.currency,
        ...canonicalContext
      },
    });
    onRemove();
  };

  return (
    <CartLineItemWrapper
      {...rest}
      data-testid={`cart-line-${String(item.product.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`}
    >
      {hasImage ? (
        <LazyImage alt={item.product.name} width={140} height={140} src={thumbnailSrc!} />
      ) : (
        <NoImagePlaceholder width={140} height={140} />
      )}

      <FlexBox
        width="100%"
        minWidth="0px"
        flexDirection="column"
        className="product-details"
        justifyContent="space-between">
        <Link href={detailHref}>
          <Typography className="title" fontWeight="500" fontSize="18px" mb="0.5rem">
            {displayName}
          </Typography>
        </Link>
        {detailSummary ? (
          <Typography color="text.muted" mb="0.5rem" fontSize="14px">
            {detailSummary}
          </Typography>
        ) : attributeSummary ? (
          <Typography color="text.muted" mb="0.5rem" fontSize="14px">
            {attributeSummary}
          </Typography>
        ) : null}

        <Box position="absolute" right="1rem" top="1rem">
          <IconButton
            color="gray.600"
            padding="4px"
            ml="12px"
            data-testid={`cart-line-remove-${String(item.product.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`}
            onClick={handleRemove}>
            <IconX size={18} />
          </IconButton>
        </Box>

        <FlexBox justifyContent="space-between" alignItems="flex-end">
          <FlexBox flexWrap="wrap" alignItems="center">
            <Typography color="gray.600" mr="0.5rem">
              {formatMoney(unitPrice)} x {item.quantity}
            </Typography>

            <Typography fontWeight={600} color="primary.main" mr="1rem">
              = {formatMoney(lineTotal)}
            </Typography>
          </FlexBox>

          <FlexBox alignItems="center" style={{ gap: "0.5rem" }}>
            <Button
              size="none"
              padding="3px"
              color="primary"
              variant="outlined"
              disabled={item.quantity === 1}
              borderColor="primary.light"
              data-testid={`cart-line-decrease-${String(item.product.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`}
              onClick={onDecrease}>
              <IconMinus size={16} />
            </Button>

            <Typography
              data-testid={`cart-line-quantity-${String(item.product.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`}
              mx="0.5rem"
              fontWeight="600"
              fontSize="15px"
            >
              {item.quantity}
            </Typography>

            <Button
              size="none"
              padding="3px"
              color="primary"
              variant="outlined"
              borderColor="primary.light"
              data-testid={`cart-line-increase-${String(item.product.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`}
              onClick={onIncrease}>
              <IconPlus size={16} />
            </Button>
          </FlexBox>
        </FlexBox>
      </FlexBox>
    </CartLineItemWrapper>
  );
}

export function CartView() {
  const { state, updateQuantity, removeItem } = useStorefrontCart();
  const t = useTranslation();
  const pathname = usePathname();
  const pageType = resolvePageType(pathname);
  const viewTrackedRef = useRef(false);
  const cartRef = useComponentTracking({
    pageType,
    componentType: "cart_view",
    componentId: "cart_view_root",
    metadata: {
      item_count: state.items.length,
      cart_value: state.items.reduce(
        (sum, item) => sum + normalizeMoney(item.product.salePrice ?? item.product.price).amount * item.quantity,
        0,
      ),
    },
  });

  useEffect(() => {
    if (viewTrackedRef.current) {
      return;
    }

    viewTrackedRef.current = true;
    void trackEvent({
      event_name: "view_cart",
      event_category: "ecommerce",
      tenant_id: env.clientSlug,
      page_type: pageType,
      component_type: "cart_view",
      component_id: "cart_view_root",
      schema_version: EVENT_SCHEMA_VERSION,
      metadata: {
        item_count: state.items.length,
        has_items: state.items.length > 0,
      },
      data: {
        item_count: state.items.length,
        has_items: state.items.length > 0,
      },
    });
  }, [pageType, state.items.length]);

  if (state.items.length === 0) {
    return (
      <div ref={cartRef}>
        <Card1>
        <FlexBox
          alignItems="center"
          flexDirection="column"
          justifyContent="center"
          height="320px">
          <Paragraph mt="1rem" color="text.muted" textAlign="center" maxWidth="260px">
            {t("cart.empty.message", {
              defaultMessage: "Your shopping bag is empty. Start shopping"
            })}
          </Paragraph>
          <Link href="/shop" style={{ textDecoration: "none" }}>
            <Button mt="1.5rem" variant="contained" color="primary">
              {t("cart.empty.cta", { defaultMessage: "Continue Shopping" })}
            </Button>
          </Link>
        </FlexBox>
        </Card1>
      </div>
    );
  }

  return (
    <div ref={cartRef}>
      <Grid container spacing={6}>
        <Grid item lg={8} md={8} xs={12}>
          {state.items.map((item) => (
            <CartLineItemCard
              key={item.product.id}
              item={item}
              pageType={pageType}
              mb="1.5rem"
              onDecrease={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
              onIncrease={() => updateQuantity(item.product.id, item.quantity + 1)}
              onRemove={() => removeItem(item.product.id)}
            />
          ))}
        </Grid>

        <Grid item lg={4} md={4} xs={12}>
          <CheckoutCostSummary pageType={pageType} />

          {SHOW_VOUCHER_AND_SHIPPING && (
            <Card1 mt="1.5rem">
              <TextField placeholder="Voucher" fullWidth />

              <Button variant="outlined" color="primary" mt="1rem" mb="30px" fullWidth>
                Apply Voucher
              </Button>

              <Divider mb="1.5rem" />

              <Typography fontWeight="600" mb="1rem">
                Shipping Estimates
              </Typography>

              <Select
                mb="1rem"
                label="Country"
                options={countryList}
                placeholder="Select Country"
                onChange={(e) => console.log(e)}
              />

              <Select
                label="State"
                options={stateList}
                placeholder="Select State"
                onChange={(e) => console.log(e)}
              />

              <Box mt="1rem">
                <TextField label="Zip Code" placeholder="3100" fullWidth />
              </Box>

              <Button variant="outlined" color="primary" my="1rem" fullWidth>
                Calculate Shipping
              </Button>
            </Card1>
          )}
        </Grid>
      </Grid>
    </div>
  );
}

const stateList = [
  { value: "New York", label: "New York" },
  { value: "Chicago", label: "Chicago" }
];
