"use client";

import Link from "next/link";
import Box from "@component/Box";
import HoverBox from "@component/HoverBox";
import { H4 } from "@component/Typography";
import NextImage from "@component/NextImage";
import { currency } from "@utils/utils";
import ProductWishlistButton from "./ProductWishlistButton";

// ========================================================
interface ProductCard2Props {
  slug: string;
  title: string;
  price: number;
  imgUrl: string;
}
// ========================================================

export default function ProductCard2({ imgUrl, title, price, slug }: ProductCard2Props) {
  return (
    <Box>
      <Box position="relative" mb="0.5rem">
        <Link href={`/product/${slug}`}>
          <HoverBox borderRadius={8} display="flex">
            <NextImage src={imgUrl} width={181} height={181} alt={title} />
          </HoverBox>
        </Link>

        <ProductWishlistButton style={{ position: "absolute", top: 12, right: 12 }} />
      </Box>

      <Link href={`/product/${slug}`}>
        <H4 fontWeight="600" fontSize="14px" mb="0.25rem">
          {title}
        </H4>
      </Link>

      <H4 fontWeight="600" fontSize="14px" color="primary.main">
        {currency(price)}
      </H4>
    </Box>
  );
}
