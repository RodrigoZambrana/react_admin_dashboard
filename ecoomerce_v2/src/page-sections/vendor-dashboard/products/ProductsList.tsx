"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { IconArrowRight } from "@tabler/icons-react";

import Avatar from "@component/avatar";
import Hidden from "@component/hidden";
import FlexBox from "@component/FlexBox";
import TableRow from "@component/TableRow";
import Pagination from "@component/pagination";
import { IconButton } from "@component/buttons";
import Typography, { H5, Paragraph } from "@component/Typography";

import { calculateDiscount, currency } from "@utils/utils";
import Product from "@models/product.model";
import { Meta } from "interfaces";

// ==============================================================
interface Props {
  meta: Meta;
  products: Product[];
}
// ==============================================================

export default function ProductsList({ meta, products }: Props) {
  const { push } = useRouter();
  const [page, setPage] = useState<number | null>(null);

  useEffect(() => {
    if (page) {
      push(`/vendor/products?page=${page}`);
      setPage(null);
    }
  }, [page]);

  return (
    <Fragment>
      {products.map((item) => (
        <Link href={`/vendor/products/${item.slug}`} key={item.id}>
          <TableRow
            my="1rem"
            padding="6px 18px"
            boxShadow="none"
            border="1px solid"
            borderColor="gray.200">
            <FlexBox alignItems="center" m="6px" flex="2 2 220px !important">
              <Avatar src={item.thumbnail} size={36} borderRadius={8} />
              <Paragraph textAlign="left" ml="20px" fontWeight={500}>
                {item.title}
              </Paragraph>
            </FlexBox>

            <Paragraph color="primary.main" m="6px" textAlign="left" fontWeight="500">
              {currency(item.price)}
            </Paragraph>

            <Paragraph m="6px" textAlign="left" fontWeight="500">
              {calculateDiscount(item.price, item.discount)}
            </Paragraph>

            <Hidden flex="0 0 0 !important" down={769}>
              <Typography textAlign="center" color="text.muted">
                <IconButton>
                  <IconArrowRight size={18} />
                </IconButton>
              </Typography>
            </Hidden>
          </TableRow>
        </Link>
      ))}

      <FlexBox justifyContent="center" mt="2.5rem">
        <Pagination pageCount={meta?.totalPage || 1} onChange={(data) => setPage(data + 1)} />
      </FlexBox>
    </Fragment>
  );
}
