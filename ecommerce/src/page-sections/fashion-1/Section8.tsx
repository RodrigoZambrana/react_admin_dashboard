import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import { H3, SemiSpan } from "@component/Typography";
// API FUNCTIONS
import api from "@utils/__api__/fashion-1";

export default async function Section8() {
  const serviceList = await api.getServiceList();

  return (
    <FlexBox
      p="1rem"
      mb="3.75rem"
      flexWrap="wrap"
      borderRadius={8}
      border="1px solid"
      borderColor="gray.400">
      {serviceList.map((item) => (
        <FlexBox alignItems="center" p="1rem" mx="auto" key={item.title}>
          <Icon size="42px" mr="0.87rem">
            {item.icon}
          </Icon>

          <div>
            <H3 lineHeight="1.3">{item.title}</H3>
            <SemiSpan color="text.muted">{item.description}</SemiSpan>
          </div>
        </FlexBox>
      ))}
    </FlexBox>
  );
}
