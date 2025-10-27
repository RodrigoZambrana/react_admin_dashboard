import Link from "next/link";
import { Fragment } from "react";
import { format } from "date-fns/format";
import { IconHelp } from "@tabler/icons-react";
// API FUNCTIONS
import api from "@utils/__api__/ticket";
// GLOBAL CUSTOM COMPONENTS
import Box from "@component/Box";
import Avatar from "@component/avatar";
import Divider from "@component/Divider";
import FlexBox from "@component/FlexBox";
import { Button } from "@component/buttons";
import { H5, SemiSpan } from "@component/Typography";
import DashboardPageHeader from "@component/DashboardPageHeader";
// PAGE SECTION COMPONENTS
import { MessageSubmit } from "@sections/customer-dashboard/support-ticket";
// CUSTOM DATA MODEL
import { SlugParams } from "interfaces";

const HEADER_LINK = (
  <Link href="/support-tickets">
    <Button color="primary">Back</Button>
  </Link>
);

export default async function TicketDetails({ params }: SlugParams) {
  const { slug } = await params;
  const ticket = await api.getTicket(slug);

  return (
    <Fragment>
      <DashboardPageHeader
        button={HEADER_LINK}
        title="Support Ticket"
        Icon={<IconHelp size={27} />}
      />

      {ticket.conversation.map((item: any, ind: number) => (
        <FlexBox mb="30px" key={ind}>
          <Avatar src={item.imgUrl} mr="1rem" borderRadius={8} />

          <div>
            <H5 fontWeight="600" mt="0px" mb="0px">
              {item.name}
            </H5>

            <SemiSpan>{format(new Date(item.date), "hh:mm:a | dd MMM yyyy")}</SemiSpan>

            <Box borderRadius="10px" bg="gray.300" p="1rem" mt="1rem">
              {item.text}
            </Box>
          </div>
        </FlexBox>
      ))}

      <Divider mb="2rem" bg="gray.300" />

      <MessageSubmit />
    </Fragment>
  );
}
