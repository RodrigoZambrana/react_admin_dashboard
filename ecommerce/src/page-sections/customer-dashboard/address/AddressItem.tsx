"use client";

import Link from "next/link";
import { IconEdit, IconTrash } from "@tabler/icons-react";

import TableRow from "@component/TableRow";
import Typography from "@component/Typography";
import { IconButton } from "@component/buttons";
import Address from "@models/address.model";

export default function AddressItem({ item }: { item: Address }) {
  const title = item.label || (item.isPrimary ? "Primary Address" : "Address");
  const streetLine =
    item.street || item.number
      ? [item.street, item.number].filter((part) => part && part.trim().length > 0).join(" ")
      : item.line1;
  const extraLine =
    item.apartment || item.corner || item.comments
      ? [item.apartment, item.corner, item.comments]
          .filter((part) => part && part.trim().length > 0)
          .join(", ")
      : item.line2;
  const locationParts = [item.city, item.neighborhood, item.department || item.state, item.zip, item.country]
    .filter((part) => part && part.trim().length > 0)
    .join(", ");
  const displayAddress = [streetLine, extraLine, locationParts]
    .filter((part) => part && part.trim().length > 0)
    .join(" • ");

  return (
    <TableRow
      my="1rem"
      padding="9px 18px"
      borderRadius={12}
      boxShadow="none"
      border="1px solid"
      borderColor="gray.200">
      <Typography fontWeight={500} className="pre" m="6px" textAlign="left">
        {title}
      </Typography>

      <Typography flex="1 1 260px !important" m="6px" textAlign="left">
        {displayAddress}
      </Typography>

      <Typography className="pre" m="6px" textAlign="left">
        {item.isPrimary ? "Primary" : "Secondary"}
      </Typography>

      <Typography className="pre" textAlign="center" color="text.muted">
        <Link href={`/account/address/${item.id}`}>
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
