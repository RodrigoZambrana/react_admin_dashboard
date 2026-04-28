"use client";

import { useState } from "react";

import Box from "@component/Box";
import Avatar from "@component/avatar";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import Modal from "@component/modal";
import Rating from "@component/rating";
import Typography, { H6 } from "@component/Typography";
import TextArea from "@component/textarea";
import NoImagePlaceholder from "@component/NoImagePlaceholder";
import { isMissingProductImage } from "@/lib/utils/image";
import { StorefrontApi } from "@/lib/api/storefront";
import { useToast } from "@/contexts/ToastContext";
import { useTranslation } from "@/state/i18n-context";

import type { CheckoutLineItem } from "@/types/storefront";
import { formatOrderMoney } from "@common/currency/orderMoney";

type Props = {
  item: CheckoutLineItem;
  orderIdentifier: string;
};

export default function WriteReview({ item, orderIdentifier }: Props) {
  const t = useTranslation();
  const toast = useToast();
  const price = formatOrderMoney(item.price.amount, item.price.currency);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async () => {
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      toast.push({
        title: t("product.reviews.validation.commentRequired", {
          defaultMessage: "Comment is required"
        }),
        type: "error"
      });
      return;
    }

    setSubmitting(true);
    try {
      await StorefrontApi.createOrderReview(orderIdentifier, {
        productId: item.productId,
        variantId: item.variantId ?? null,
        rating,
        title: title.trim() || undefined,
        comment: trimmedComment
      });
      toast.push({
        title: t("product.reviews.toast.success.title", {
          defaultMessage: "Review saved"
        }),
        description: t("product.reviews.toast.success.description", {
          defaultMessage: "Your review was saved successfully."
        }),
        type: "success"
      });
      setOpen(false);
      setComment("");
      setTitle("");
      setRating(5);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("product.reviews.toast.error", {
          defaultMessage: "We couldn't save your review."
        });
      toast.push({
        title: t("product.reviews.toast.errorTitle", {
          defaultMessage: "Review not saved"
        }),
        description: message,
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

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

      <FlexBox flex="1 1 260px" m="6px" alignItems="center" />

      <FlexBox flex="160px" m="6px" alignItems="center">
        <Button
          variant="text"
          color="primary"
          onClick={() => setOpen(true)}
          data-testid={`write-review-button-${item.productId}`}>
          <Typography fontSize="14px">{t("Write a Review")}</Typography>
        </Button>
      </FlexBox>

      <Modal open={open} onClose={() => setOpen(false)}>
        <Box p="24px" maxWidth="540px">
          <H6 mt="0px" mb="12px">
            {t("product.reviews.modal.title", {
              defaultMessage: "Write a review"
            })}
          </H6>

          <Box mb="16px">
            <Typography fontSize="14px" mb="8px">
              {t("product.reviews.modal.rating", {
                defaultMessage: "Your rating"
              })}
            </Typography>
            <Rating value={rating} outof={5} color="warn" onChange={(value) => setRating(value)} />
          </Box>

          <Box mb="16px">
            <Typography fontSize="14px" mb="8px">
              {t("product.reviews.modal.titleField", {
                defaultMessage: "Title"
              })}
            </Typography>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              data-testid="product-review-title"
              style={{
                width: "100%",
                minHeight: 44,
                borderRadius: 8,
                border: "1px solid #d9d9d9",
                padding: "0 12px"
              }}
            />
          </Box>

          <Box mb="16px">
            <Typography fontSize="14px" mb="8px">
              {t("product.reviews.modal.comment", {
                defaultMessage: "Comment"
              })}
            </Typography>
            <TextArea
              fullWidth
              rows={6}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              data-testid="product-review-comment"
              placeholder={t("product.reviews.modal.placeholder", {
                defaultMessage: "Write your review here..."
              })}
            />
          </Box>

          <FlexBox justifyContent="flex-end" gridGap="12px">
            <Button variant="outlined" onClick={() => setOpen(false)} disabled={submitting}>
              {t("Cancel")}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              data-testid="product-review-submit">
              {submitting
                ? t("product.reviews.modal.saving", { defaultMessage: "Saving..." })
                : t("product.reviews.modal.save", { defaultMessage: "Save review" })}
            </Button>
          </FlexBox>
        </Box>
      </Modal>
    </FlexBox>
  );
}
