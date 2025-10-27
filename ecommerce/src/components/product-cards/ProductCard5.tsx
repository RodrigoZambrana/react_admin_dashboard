"use client";

import Box from "@component/Box";
import HoverBox from "@component/HoverBox";
import { H4 } from "@component/Typography";
import NextImage from "@component/NextImage";
import ProductWishlistButton from "./ProductWishlistButton";

// ====================================================================
type ProductCard5Props = { imgUrl: string; title: string };
// ====================================================================

export default function ProductCard5({ imgUrl, title }: ProductCard5Props) {
  return (
    <div>
      <Box position="relative" mb="0.5rem">
        <HoverBox borderRadius={5} display="flex">
          <NextImage alt={title} src={imgUrl} width={260} height={175} />
        </HoverBox>

        <ProductWishlistButton style={{ position: "absolute", top: 12, right: 12 }} />
      </Box>

      <H4 fontSize="14px" fontWeight="600">
        {title}
      </H4>
    </div>
  );
}
