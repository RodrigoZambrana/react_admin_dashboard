import Grid from "@component/grid/Grid";
import Icon from "@component/icon/Icon";
import { H4, Span } from "components/Typography";
// STYLED COMPONENTS
import { Container, IconBox, Item } from "./styles";
// API FUNCTIONS
import api from "@utils/__api__/gift";

export default async function Section2() {
  const services = await api.getServiceList();

  return (
    <Container>
      <Grid container spacing={3}>
        {services.map(({ id, icon, title, description }) => {
          return (
            <Grid item md={4} sm={6} xs={12} key={id}>
              <Item>
                <IconBox>
                  <Icon>{icon}</Icon>
                </IconBox>

                <div>
                  <H4 mb={0.5} fontSize="1rem" fontWeight="600">
                    {title}
                  </H4>

                  <Span color="gray.600" fontSize={14}>
                    {description}
                  </Span>
                </div>
              </Item>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
}
