import styled from "styled-components";
import { isValidProp } from "@utils/utils";

// ==============================================================
type StyledCategoryProps = { open: boolean };

type CategoryDropdownProps = {
  open: boolean;
  position?: "absolute" | "relative";
};
// ==============================================================

export const StyledCategory = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<StyledCategoryProps>`
  position: relative;
  .cursor-pointer {
    cursor: pointer;
  }
  .dropdown-icon {
    margin-left: 0.25rem;
    transition: all 250ms ease-in-out;
    /* transform: rotate(${(props) => (props.open ? "180deg" : "0deg")}); */
  }
`;

export const StyledCategoryDropdown = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<CategoryDropdownProps>`
  left: 0;
  right: auto;
  border-radius: 8px;
  padding: 0.5rem 0px;
  transform-origin: top;
  position: ${({ position }) => position};
  transform: ${({ open }) => (open ? "scaleY(1)" : "scaleY(0)")};
  top: ${({ position }) => (position === "absolute" ? "calc(100% + 0.7rem)" : "0.5rem")};
  background-color: ${({ theme }) => theme.colors.body.paper};
  box-shadow: ${({ theme }) => theme.shadows.regular};
  transition: all 250ms ease-in-out;
  z-index: 98;
`;

export const StyledCategoryMenuItem = styled.div`
  .category-dropdown-link {
    height: 40px;
    display: flex;
    cursor: pointer;
    min-width: 278px;
    white-space: pre;
    padding: 0px 1rem;
    align-items: center;
    transition: all 250ms ease-in-out;

    .title {
      padding-left: 0.75rem;
      flex-grow: 1;
    }

    .chevron-icon {
      margin-left: 0.75rem;
      flex-shrink: 0;
      transition: transform 250ms ease-in-out;
    }

    .has-children {
      transform: rotate(0deg);
    }

    &:hover {
      color: ${({ theme }) => theme.colors.primary.main};
      background: ${({ theme }) => theme.colors.primary.light};
    }
  }

  .sub-category-link,
  .sub-category-static {
    display: flex;
    align-items: center;
    justify-content: space-between;
    column-gap: 0.75rem;
    width: 100%;
    color: ${({ theme }) => theme.colors.text.muted};
    text-decoration: none;
  }

  .sub-category-link {
    padding: 0.25rem 0;
    transition: color 200ms ease-in-out;
  }

  .sub-category-static {
    padding: 0.25rem 0;
  }

  .sub-category-title {
    flex: 1 1 auto;
  }

  .sub-category-link:hover {
    color: ${({ theme }) => theme.colors.primary.main};
  }

  .sub-category-chevron {
    flex-shrink: 0;
  }

  &:hover {
    & > .category-dropdown-link {
      color: ${({ theme }) => theme.colors.primary.main};
      background: ${({ theme }) => theme.colors.primary.light};
    }

    & > .mega-menu {
      display: block;
    }
  }
`;
