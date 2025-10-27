import Box from "@component/Box";
import Card from "@component/Card";
import Avatar from "@component/avatar";
import Icon from "@component/icon/Icon";
import FlexBox from "@component/FlexBox";
import { Carousel } from "@component/carousel";
import { H5, Span } from "@component/Typography";
// STYLED COMPONENT
import { Wrapper } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/grocery-2";

// ======================================================================
type Testimonial = {
  id: string;
  rating: number;
  comment: string;
  user: { name: string; avatar: string };
};

// ======================================================================

export default async function Section9() {
  const testimonials: Testimonial[] = await api.getTestimonials();

  return (
    <Wrapper>
      <Box m="-0.25rem">
        <Carousel slidesToShow={1} spaceBetween={0}>
          {testimonials.map((item) => (
            <Box p="0.25rem" key={item.id}>
              <Card className="carousel-card">
                <FlexBox className="quote-content" position="relative" flexWrap="wrap">
                  <Icon className="quote quote-open">quote-open</Icon>
                  <Avatar className="avatar" src={item.user.avatar} size={64} />

                  <Box maxWidth="410px">
                    <Span color="gray.700">{item.comment}</Span>

                    <H5 mt="0.5rem" fontWeight="700">
                      {item.user.name}
                    </H5>
                  </Box>

                  <Icon className="quote quote-close">quote-close</Icon>
                </FlexBox>
              </Card>
            </Box>
          ))}
        </Carousel>
      </Box>
    </Wrapper>
  );
}
