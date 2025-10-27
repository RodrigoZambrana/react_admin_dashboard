import Link from "next/link";
import { Fragment } from "react";
import { format } from "date-fns/format";
import { IconArrowRight, IconHelp } from "@tabler/icons-react";
// API FUNCTIONS
import api from "@utils/__api__/ticket";
// GLOBAL CUSTOM COMPONENTS
import Chip from "@component/Chip";
import Hidden from "@component/hidden";
import FlexBox from "@component/FlexBox";
import TableRow from "@component/TableRow";
import { IconButton } from "@component/buttons";
import Typography, { Paragraph, SemiSpan, Small } from "@component/Typography";
import DashboardPageHeader from "@component/DashboardPageHeader";
// PAGE SECTION COMPONENTS
import { SupportPagination } from "@sections/customer-dashboard/support-ticket";

export default async function TicketList() {
  const ticketList = await api.getTicketList();

  return (
    <Fragment>
      <DashboardPageHeader title="Support Ticket" Icon={<IconHelp size={27} />} />

      {ticketList.map((item) => (
        <Link href={`/support-tickets/${item.slug}`} key={item.id}>
          <TableRow
            my="1rem"
            padding="15px 24px"
            borderRadius={12}
            boxShadow="none"
            border="1px solid"
            borderColor="gray.200">
            <div>
              <Paragraph fontSize="16px" fontWeight={500}>
                {item.title}
              </Paragraph>

              <FlexBox alignItems="center" flexWrap="wrap" pt="0.75rem" m="-6px">
                <Chip p="0.25rem 1rem" bg="primary.light" m="6px">
                  <Small color="primary.main">{item.type}</Small>
                </Chip>

                <Chip p="0.25rem 1rem" bg="success.light" m="6px">
                  <Small color="success.main">{item.status}</Small>
                </Chip>

                <SemiSpan className="pre" m="6px">
                  {format(new Date(item.date), "MMM dd, yyyy")}
                </SemiSpan>

                <SemiSpan m="6px">{item.category}</SemiSpan>
              </FlexBox>
            </div>

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

      <SupportPagination ticketList={ticketList} />
    </Fragment>
  );
}
