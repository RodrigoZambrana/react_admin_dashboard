import styled from "styled-components";
import { variant } from "styled-system";
import { isValidProp } from "@utils/utils";

export const StyledMenu = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<{ direction: string }>(
  ({ theme }) => ({
    position: "relative",
    ".menu-item-holder": {
      zIndex: 100,
      minWidth: "200px",
      borderRadius: "6px",
      paddingTop: "0.5rem",
      position: "absolute",
      paddingBottom: "0.5rem",
      top: "calc(100% + 0.5rem)",
      backgroundColor: theme.colors.body.paper,
      boxShadow: theme.shadows[3]
    }
  }),
  variant({
    prop: "direction",
    variants: {
      left: {
        ".menu-item-holder": {
          left: 0,
          right: "auto"
        }
      },
      right: {
        ".menu-item-holder": {
          left: "auto",
          right: 0
        }
      }
    }
  })
);
