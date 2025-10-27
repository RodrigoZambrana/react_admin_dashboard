import Icon from "@component/icon/Icon";
import Container from "@component/Container";
import { H4, Span } from "@component/Typography";
// STYLED COMPONENTS
import { ServiceItem, Wrapper } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/fashion-2";

export default async function Section2() {
  const serviceList = await api.getServices();

  return (
    <Container mt="4rem">
      <Wrapper>
        {serviceList.map((item) => {
          return (
            <ServiceItem key={item.id}>
              <Icon size="40px">{item.icon}</Icon>

              <div>
                <H4 lineHeight={1.3}>{item.title}</H4>
                <Span color="gray.600" fontSize={14}>
                  {item.description}
                </Span>
              </div>
            </ServiceItem>
          );
        })}
      </Wrapper>
    </Container>
  );
}
