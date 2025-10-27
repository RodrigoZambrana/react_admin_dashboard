import Container from "@component/Container";
import { H4, Span } from "@component/Typography";
// STYLED COMPONENTS
import { Wrapper } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/fashion-3";

export default async function Section7() {
  const services = await api.getServices();

  return (
    <Container mt="4rem">
      <Wrapper>
        {services.map((item) => (
          <div className="item" key={item.id}>
            <H4 lineHeight={1.3}>{item.title}</H4>
            <Span color="grey.600">{item.description}</Span>
          </div>
        ))}
      </Wrapper>
    </Container>
  );
}
