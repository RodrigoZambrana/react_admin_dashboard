import styled, { css, keyframes } from "styled-components";
import { isValidProp } from "@utils/utils";

const HEADER_HEIGHT = 72;
const MOBILE_BREAKPOINT = "700px";
const ANIMATION_DURATION = "250ms";

const slideFromTop = keyframes`
  from {
    top: -${HEADER_HEIGHT}px;
  }
  to {
    top: 0;
  }
`;

const fixedHeaderStyles = css`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: white;
  height: ${HEADER_HEIGHT}px;
  z-index: 99;
  animation: ${slideFromTop} ${ANIMATION_DURATION} ease-in-out;
  .link {
    color: inherit;
  }
  & + div {
    padding-top: ${HEADER_HEIGHT}px;
  }
`;

export const HeaderWrapper = styled.div.withConfig({
  shouldForwardProp: (prop) => isValidProp(prop)
})<{ fixed?: boolean }>`
  ${({ fixed }) => fixed && fixedHeaderStyles}
  box-shadow: ${({ fixed, theme }) => fixed && theme.shadows.regular};

  & .link {
    cursor: pointer;
    padding: 0.25rem 1.25rem;
    color: ${({ theme }) => theme.colors.text.muted};
    transition: color ${ANIMATION_DURATION} ease-in-out;
    &:hover {
      color: ${({ theme }) => theme.colors.primary.main};
    }
  }

  .menu {
    display: none;
  }

  @media only screen and (max-width: ${MOBILE_BREAKPOINT}) {
    .right-links {
      display: none;
    }
    .menu {
      display: unset;
    }
  }
`;

export const SideNavWrapper = styled.div`
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .link {
    margin: 0;
    font-weight: 500;
    cursor: pointer;
    transition: color ${ANIMATION_DURATION} ease-in-out;
    &:hover {
      color: ${({ theme }) => theme.colors.primary.main};
    }
    span {
      width: 8px;
      height: 8px;
      display: inline-block;
      background-color: ${({ theme }) => theme.colors.primary.main};
      border-radius: 3px;
      margin-right: 0.5rem;
    }
  }

  .purchase-button {
    margin-top: 0.5rem;
  }
`;
