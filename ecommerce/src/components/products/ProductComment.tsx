import Box from "@component/Box";
import Avatar from "@component/avatar";
import Rating from "@component/rating";
import FlexBox from "@component/FlexBox";
import { H5, H6, Paragraph, SemiSpan } from "@component/Typography";
import { getDateDifference } from "@utils/utils";

// =========================================
interface Props {
  name: string;
  date: string;
  imgUrl?: string;
  rating: number;
  comment: string;
  title?: string | null;
  verifiedPurchase?: boolean;
}
// =========================================

export default function ProductComment({
  name,
  date,
  imgUrl,
  rating,
  comment,
  title,
  verifiedPurchase
}: Props) {
  return (
    <Box mb="32px" maxWidth="600px">
      <FlexBox alignItems="center" mb="1rem">
        <Avatar src={imgUrl} />

        <Box ml="1rem">
          <H5 mb="4px">{name}</H5>

          <FlexBox alignItems="center">
            <Rating value={rating} color="warn" readOnly />
            <H6 mx="10px">{rating}</H6>
            <SemiSpan>{getDateDifference(date)}</SemiSpan>
          </FlexBox>
        </Box>
      </FlexBox>

      {title ? (
        <H6 mb="8px" mt="0px">
          {title}
          {verifiedPurchase ? <SemiSpan> · Verified purchase</SemiSpan> : null}
        </H6>
      ) : verifiedPurchase ? (
        <H6 mb="8px" mt="0px">
          <SemiSpan>Verified purchase</SemiSpan>
        </H6>
      ) : null}

      <Paragraph color="gray.700">{comment}</Paragraph>
    </Box>
  );
}
