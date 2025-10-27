import { Fragment } from "react";
import { IconPackage } from "@tabler/icons-react";
import axios from "@lib/axios";
// GLOBAL CUSTOM COMPONENTS
import Hidden from "@component/hidden";
import FlexBox from "@component/FlexBox";
import TableRow from "@component/TableRow";
import { H5 } from "@component/Typography";
import DashboardPageHeader from "@component/DashboardPageHeader";
// PAGE SECTION COMPONENTS
import { ProductList } from "@sections/vendor-dashboard/products";

// ==============================================================
type Params = { searchParams: Promise<{ page: string }> };
// ==============================================================

export default async function Products({ searchParams }: Params) {
  const { page } = await searchParams;

  const { data } = await axios.get("/api/products", {
    params: {
      pageSize: 10,
      page: page ? parseInt(page) : 1
    }
  });

  return (
    <Fragment>
      <DashboardPageHeader title="Products" Icon={<IconPackage size={24} />} />

      <Hidden down={769}>
        <TableRow padding="0px 18px" mb="-0.125rem" boxShadow="none" backgroundColor="transparent">
          <FlexBox my="0px" mx="6px" flex="2 2 220px !important">
            <H5 fontWeight={500} ml="56px" color="text.muted" textAlign="left">
              Name
            </H5>
          </FlexBox>

          <H5 fontWeight={500} color="text.muted" my="0px" mx="6px" textAlign="left">
            Regular price
          </H5>

          <H5 fontWeight={500} color="text.muted" my="0px" mx="6px" textAlign="left">
            Sale Price
          </H5>

          <H5 flex="0 0 0 !important" fontWeight={500} color="text.muted" px="22px" my="0px" />
        </TableRow>
      </Hidden>

      <ProductList products={data.result} meta={data.meta} />
    </Fragment>
  );
}
