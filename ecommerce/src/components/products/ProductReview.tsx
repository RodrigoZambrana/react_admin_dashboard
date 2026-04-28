"use client";

import Box from "@component/Box";
import FlexBox from "@component/FlexBox";
import Rating from "@component/rating";
import { H2, H5, Paragraph, SemiSpan } from "@component/Typography";
import ProductComment from "./ProductComment";
import type Review from "@models/Review.model";
import { useTranslation } from "@/state/i18n-context";

interface Props {
  reviews?: Review[];
  reviewCount?: number;
  averageRating?: number | null;
}

const buildFallbackAvatar = (name: string) =>
  `/assets/images/faces/${Math.max(1, Math.min(8, (name.length % 8) + 1))}.png`;

export default function ProductReview({ reviews = [], reviewCount, averageRating }: Props) {
  const t = useTranslation();
  const totalReviews = reviewCount ?? reviews.length;

  return (
    <Box>
      <H2 fontWeight="600" mt="0px" mb="16px">
        {t("product.tabs.reviews", { defaultMessage: "Reviews" })}
      </H2>

      <FlexBox alignItems="center" mb="24px" gridGap="0.75rem" flexWrap="wrap">
        <Rating value={averageRating ?? 0} outof={5} color="warn" readOnly />
        <H5 my="0px">{averageRating ? averageRating.toFixed(1) : "0.0"}</H5>
        <SemiSpan>
          {t("product.reviews.count", {
            defaultMessage: "{{count}} reviews",
            values: { count: totalReviews }
          })}
        </SemiSpan>
      </FlexBox>

      {reviews.length > 0 ? (
        reviews.map((review) => (
          <ProductComment
            key={review.id}
            name={review.customer.name}
            date={review.date}
            imgUrl={review.customer.imgUrl ?? buildFallbackAvatar(review.customer.name)}
            rating={review.rating}
            comment={review.comment}
            title={review.title ?? undefined}
            verifiedPurchase={review.verifiedPurchase}
          />
        ))
      ) : (
        <Paragraph color="gray.700">
          {t("product.reviews.empty", {
            defaultMessage: "No reviews have been published yet."
          })}
        </Paragraph>
      )}
    </Box>
  );
}
