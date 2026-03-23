"use client";

import Box from "@component/Box";
import Avatar from "@component/avatar";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import Typography, { H6 } from "@component/Typography";
import NoImagePlaceholder from "@component/NoImagePlaceholder";
import { isMissingProductImage } from "@/lib/utils/image";
import { useTranslation } from "@/state/i18n-context";

import type { CheckoutLineItem } from "@/types/storefront";
import { formatOrderMoney } from "@common/currency/orderMoney";

export default function WriteReview({ item }: { item: CheckoutLineItem }) {
  const t = useTranslation();
  const price = formatOrderMoney(item.price.amount, item.price.currency);

  const productSpecs = Array.isArray(item.specifications)
    ? item.specifications
        .map((spec) => {
          if (!spec) return "";
          const label = (spec.label ?? "").toString().trim();
          if (label.toLowerCase() === "material") return "";
          const value = (spec.value ?? "").toString().trim();
          if (label && value) return `${label}: ${value}`;
          if (value) return value;
          return label;
        })
        .filter(Boolean)
    : [];
  const propertiesText = productSpecs.length > 0 ? productSpecs.join(" • ") : null;
  const hasImage = item.image && !isMissingProductImage(item.image);

  return (
    <FlexBox px="1rem" py="0.5rem" flexWrap="wrap" alignItems="center" key={`${item.productId}-${item.name}`}>
      <FlexBox flex="2 2 260px" m="6px" alignItems="center">
        {hasImage ? (
          <Avatar src={item.image!} size={64} />
        ) : (
          <NoImagePlaceholder
            width={64}
            height={64}
            borderRadius="50%"
            text={t("No image available")}
          />
        )}

        <Box ml="20px">
          <H6 my="0px">
            {item.name ?? t("Item {id}", { values: { id: item.productId } })}
          </H6>
          <Typography fontSize="14px" color="text.muted">
            {price} × {item.quantity}
          </Typography>
          {propertiesText ? (
            <Typography fontSize="14px" color="text.muted">
              {t("product.selection.label", { defaultMessage: "Selection:" })} {propertiesText}
            </Typography>
          ) : null}
        </Box>
      </FlexBox>

      <FlexBox flex="1 1 260px" m="6px" alignItems="center">
        {/* Placeholder for additional order metadata such as shipping info */}
      </FlexBox>

      <FlexBox flex="160px" m="6px" alignItems="center">
        <Button variant="text" color="primary">
          <Typography fontSize="14px">{t("Write a Review")}</Typography>
        </Button>
      </FlexBox>
    </FlexBox>
  );
}
