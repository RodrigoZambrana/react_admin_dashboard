import styled from "styled-components";
import { color, ColorProps, space, SpaceProps, compose } from "styled-system";
import { isValidProp } from "@utils/utils";

type MenuItemProps = ColorProps & SpaceProps;

const styles = compose(color, space);

const MenuItem = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<MenuItemProps>`
  display: flex;
  cursor: pointer;
  align-items: center;
  padding: 0.5rem 1rem;
  word-break: break-all;
  color: ${({ theme }) => theme.colors.text.secondary};
  &:hover {
    color: ${({ theme }) => theme.colors.primary.main};
    background-color: ${({ theme }) => theme.colors.gray[100]};
  }
  ${styles}
`;

export default MenuItem;
