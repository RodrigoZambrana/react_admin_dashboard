import styled from "styled-components";
import { color, compose, variant } from "styled-system";
import { RatingProps } from "./index";
import { isValidProp } from "@utils/utils";

const StyledRating = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<RatingProps>(
  ({ readOnly }) => ({
    display: "flex",
    margin: "0px -1px",
    "& svg": {
      margin: "0px 1px",
      cursor: readOnly ? "default" : "pointer"
    }
  }),
  variant({
    prop: "size",
    variants: {
      small: { "& svg": { height: 12, width: 12 } },
      medium: { "& svg": { height: 15, width: 15 } },
      large: { "& svg": { height: 18, width: 18 } }
    }
  }),
  compose(color)
);

export default StyledRating;
