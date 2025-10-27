import Box from "@component/Box";
import Divider from "@component/Divider";
import FlexBox from "@component/FlexBox";
import { Span } from "@component/Typography";

export default function Divide() {
  return (
    <Box mb="1rem">
      <Divider />

      <FlexBox justifyContent="center" mt="-14px">
        <Span color="text.muted" bg="body.paper" px="1rem">
          on
        </Span>
      </FlexBox>
    </Box>
  );
}
