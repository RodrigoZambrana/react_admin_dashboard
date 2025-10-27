"use client";

import { IconTrash } from "@tabler/icons-react";
import { format } from "date-fns/format";

import Box from "@component/Box";
import Card from "@component/Card";
import Select from "@component/Select";
import Avatar from "@component/avatar";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import Divider from "@component/Divider";
import TableRow from "@component/TableRow";
import TextArea from "@component/textarea";
import TextField from "@component/text-field";
import { Button, IconButton } from "@component/buttons";
import Typography, { H5, H6 } from "@component/Typography";
import Hidden from "@component/hidden";

const ORDER_STATUS_LIST = [
  { label: "Processing", value: "Processing" },
  { label: "Pending", value: "Pending" },
  { label: "Delivered", value: "Delivered" },
  { label: "Cancelled", value: "Cancelled" }
];

const ORDER_ITEMS = [
  {
    id: 1,
    name: "Nike React Phantom Run Flyknit 2",
    price: 145,
    quantity: 3,
    image: "/assets/images/products/imagetree.png",
    properties: "Black, L"
  },
  {
    id: 2,
    name: "Adidas Ultraboost 21",
    price: 180,
    quantity: 1,
    image: "/assets/images/products/bgearphone.png",
    properties: "White/Grey, M"
  },
  {
    id: 3,
    name: "Puma RS-X³ Puzzle",
    price: 110,
    quantity: 2,
    image: "/assets/images/products/shoes-2.png",
    properties: "Blue/Orange, XL"
  }
];

export default function OrderDetails() {
  return (
    <>
      <Card p="0px" mb="30px" overflow="hidden" borderRadius={12}>
        <TableRow bg="gray.200" p="12px" boxShadow="none" borderRadius={0}>
          <Hidden down={769}>
            <FlexBox className="pre" flex="0 0 0 !important" m="6px" alignItems="center">
              <Typography fontSize="14px" color="text.muted" mr="4px">
                Order ID:
              </Typography>

              <Typography fontSize="14px">1234567890</Typography>
            </FlexBox>
          </Hidden>

          <FlexBox className="pre" m="6px" alignItems="center">
            <Typography fontSize="14px" color="text.muted" mr="4px">
              Placed on:
            </Typography>

            <Typography fontSize="14px">{format(new Date(), "dd MMM, yyyy")}</Typography>
          </FlexBox>

          <Box maxWidth="160px" flex="1 1 0 !important">
            <Select placeholder="Order Status" options={ORDER_STATUS_LIST} />
          </Box>
        </TableRow>

        <Box py="0.5rem">
          {ORDER_ITEMS.map((item) => (
            <FlexBox px="1rem" py="0.5rem" flexWrap="wrap" alignItems="center" key={item.id}>
              <FlexBox flex="2 2 260px" m="6px" alignItems="center">
                <Avatar src={item.image} size={64} borderRadius={12} />

                <Box ml="20px">
                  <H6 my="0px">{item.name}</H6>
                  <FlexBox alignItems="center">
                    <Typography fontSize="14px" color="text.muted">
                      ${item.price} x
                    </Typography>

                    <Box maxWidth="60px" ml="8px" mt="0.25rem">
                      <TextField defaultValue={item.quantity} type="number" fullWidth />
                    </Box>
                  </FlexBox>
                </Box>
              </FlexBox>

              <FlexBox flex="1 1 260px" m="6px" alignItems="center">
                <Typography fontSize="14px" color="text.muted">
                  Product properties: {item.properties}
                </Typography>
              </FlexBox>

              <FlexBox flex="0 0 0 !important" m="6px" alignItems="center">
                <IconButton>
                  <IconTrash size={16} />
                </IconButton>
              </FlexBox>
            </FlexBox>
          ))}
        </Box>
      </Card>

      <Grid container spacing={6}>
        <Grid item lg={6} md={6} xs={12}>
          <Card p="20px 30px" mb="1.5rem" borderRadius={12}>
            <H5 mt="0px" mb="14px">
              Shipping Address
            </H5>

            <TextArea
              rows={5}
              fullWidth
              borderRadius={10}
              defaultValue="Kelly Williams 777 Brockton Avenue, Abington MA 2351"
            />
          </Card>

          <Card p="20px 30px" borderRadius={12}>
            <H5 mt="0px" mb="14px">
              Customer's Note
            </H5>

            <TextArea defaultValue="Please deliver ASAP." rows={5} borderRadius={10} fullWidth />
          </Card>
        </Grid>

        <Grid item lg={6} md={6} xs={12}>
          <Card p="20px 30px" mb="1.5rem" borderRadius={12}>
            <H5 mt="0px" mb="14px">
              Total Summary
            </H5>

            <FlexBox justifyContent="space-between" alignItems="center" mb="0.5rem">
              <Typography fontSize="14px" color="text.hint">
                Subtotal:
              </Typography>

              <H6 my="0px">$335</H6>
            </FlexBox>

            <FlexBox justifyContent="space-between" alignItems="center" mb="0.5rem">
              <Typography fontSize="14px" color="text.hint">
                Shipping fee:
              </Typography>

              <FlexBox alignItems="center" maxWidth="100px" ml="8px" mt="0.25rem">
                <Typography mr="0.5rem">$</Typography>
                <TextField defaultValue={10} type="number" fullWidth />
              </FlexBox>
            </FlexBox>

            <FlexBox justifyContent="space-between" alignItems="center" mb="0.5rem">
              <Typography fontSize="14px" color="text.hint">
                Discount:
              </Typography>

              <FlexBox alignItems="center" maxWidth="100px" ml="8px" mt="0.25rem">
                <Typography mr="0.5rem">-$</Typography>
                <TextField defaultValue={30} type="number" fullWidth />
              </FlexBox>
            </FlexBox>

            <Divider mb="0.5rem" />

            <FlexBox justifyContent="space-between" alignItems="center" mb="1rem">
              <H6 my="0px">Total</H6>
              <H6 my="0px">$315</H6>
            </FlexBox>

            <Typography fontSize="14px">Paid by Credit/Debit Card</Typography>
          </Card>

          <Button variant="contained" color="primary" ml="auto">
            Save Changes
          </Button>
        </Grid>
      </Grid>
    </>
  );
}
