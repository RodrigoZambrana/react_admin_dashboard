"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { IconEdit, IconTrash } from "@tabler/icons-react";

import Card from "@component/Card";
import FlexBox from "@component/FlexBox";
import TableRow from "@component/TableRow";
import Pagination from "@component/pagination";
import { IconButton } from "@component/buttons";
import Typography, { H5 } from "@component/Typography";

// ==============================================================
interface Props {
  methodList: {
    exp: string;
    orderNo: string;
    card_no: string;
    payment_method: string;
  }[];
}
// ==============================================================

export default function PaymentMethodList({ methodList }: Props) {
  const router = useRouter();

  return (
    <Fragment>
      {methodList.map((item, ind) => (
        <TableRow
          key={ind}
          my="1rem"
          borderRadius={12}
          padding="9px 18px"
          boxShadow="none"
          borderBottom="1px solid"
          borderColor="gray.200">
          <FlexBox alignItems="center" m="6px">
            <Card width="42px" height="28px" mr="10px" elevation={4}>
              <img
                width="100%"
                alt={item.payment_method}
                src={`/assets/images/payment-methods/${item.payment_method}.svg`}
              />
            </Card>

            <H5 className="pre" m="6px">
              Ralf Edward
            </H5>
          </FlexBox>

          <Typography className="pre" m="6px">
            {item.card_no}
          </Typography>

          <Typography className="pre" m="6px">
            {item.exp}
          </Typography>

          <Typography className="pre" textAlign="center" color="text.muted">
            <IconButton onClick={() => router.push("/payment-methods/xkssThds6h37sd")}>
              <IconEdit size={18} />
            </IconButton>

            <IconButton color="error.main" onClick={(e) => e.stopPropagation()}>
              <IconTrash size={18} />
            </IconButton>
          </Typography>
        </TableRow>
      ))}

      <FlexBox justifyContent="center" mt="2.5rem">
        <Pagination pageCount={5} onChange={(data) => console.log(data)} />
      </FlexBox>
    </Fragment>
  );
}
