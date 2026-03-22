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

export const CategoryDropdownRow = styled.div.withConfig({
  shouldForwardProp: isValidProp
})<{ $active?: boolean; $minWidth?: string }>`
  min-height: 40px;
  display: flex;
  cursor: pointer;
  align-items: center;
  padding: 0px 1rem;
  min-width: ${({ $minWidth }) => $minWidth ?? "278px"};
  transition: all 250ms ease-in-out;
  color: ${({ theme, $active }) => ($active ? theme.colors.primary.main : "inherit")};
  background: ${({ theme, $active }) => ($active ? theme.colors.primary.light : "transparent")};

  .row-content {
    flex: 1 1 auto;
    min-width: 0;
    padding-left: 0.75rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    row-gap: 0.1rem;
  }

  .row-eyebrow {
    color: ${({ theme, $active }) => ($active ? theme.colors.primary.main : theme.colors.text.muted)};
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .row-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.92rem;
    font-weight: 600;
  }

  .row-description {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: 0.78rem;
  }

  .row-aside {
    margin-left: 0.75rem;
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: 0.78rem;
    font-weight: 600;
  }

  .row-chevron {
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

    .row-eyebrow,
    .row-description,
    .row-aside {
      color: ${({ theme }) => theme.colors.primary.main};
    }
  }
`;

export const StyledCategoryMenuItem = styled.div`
  position: relative;

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
    background: transparent;
    border: 0;
    text-align: left;
    cursor: pointer;
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

  .sub-category-link.active,
  .sub-category-static.active {
    color: ${({ theme }) => theme.colors.primary.main};
    font-weight: 600;
  }

  .sub-category-chevron {
    flex-shrink: 0;
  }

  &:hover {
    & > ${CategoryDropdownRow} {
      color: ${({ theme }) => theme.colors.primary.main};
      background: ${({ theme }) => theme.colors.primary.light};
    }

    & > .mega-menu {
      display: block;
    }
  }
`;
