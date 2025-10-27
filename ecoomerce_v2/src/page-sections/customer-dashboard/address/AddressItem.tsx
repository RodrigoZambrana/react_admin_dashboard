"use client";

import Link from "next/link";
import { IconEdit, IconTrash } from "@tabler/icons-react";

import TableRow from "@component/TableRow";
import Typography from "@component/Typography";
import { IconButton } from "@component/buttons";
import Address from "@models/address.model";

export default function AddressItem({ item }: { item: Address }) {
  return (
    <TableRow
      my="1rem"
      padding="9px 18px"
      key={item.id}
      borderRadius={12}
      boxShadow="none"
      border="1px solid"
      borderColor="gray.200">
      <Typography fontWeight={500} className="pre" m="6px" textAlign="left">
        {item.title}
      </Typography>

      <Typography flex="1 1 260px !important" m="6px" textAlign="left">
        {`${item.street}, ${item.city}, ${item.country}`}
      </Typography>

      <Typography className="pre" m="6px" textAlign="left">
        {item.phone}
      </Typography>

      <Typography className="pre" textAlign="center" color="text.muted">
        <Link href={`/address/${item.id}`}>
          <IconButton color="gray.600">
            <IconEdit size={18} />
          </IconButton>
        </Link>

        <IconButton color="error.main" onClick={(e) => e.stopPropagation()}>
          <IconTrash size={18} />
        </IconButton>
      </Typography>
    </TableRow>
  );
}
