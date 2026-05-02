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
  shouldForwardProp: isValidProp,
})<StyledCategoryProps>`
  position: relative;
  .cursor-pointer {
    cursor: pointer;
  }
  .dropdown-icon {
    margin-left: 0.25rem;
    transition: all 250ms ease-in-out;
  }
`;

export const StyledCategoryDropdown = styled.div.withConfig({
  shouldForwardProp: isValidProp,
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
  pointer-events: ${({ open }) => (open ? "auto" : "none")};
  opacity: ${({ open }) => (open ? 1 : 0)};
  z-index: 98;
`;

export const CategoryDropdownRow = styled.div.withConfig({
  shouldForwardProp: isValidProp,
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

  .category-dropdown-link {
    height: 40px;
    display: flex;
    cursor: pointer;
    min-width: 278px;
    white-space: pre;
    padding: 0px 1rem;
    align-items: center;
    transition: all 250ms ease-in-out;
    color: ${({ theme }) => theme.colors.text.primary};

    .title {
      padding-left: 0.75rem;
      flex-grow: 1;
    }

    &:hover {
      color: ${({ theme }) => theme.colors.primary.main};
      background: ${({ theme }) => theme.colors.primary.light};
    }
  }

  .mega-menu {
    display: none;
    position: absolute;
    left: 100%;
    right: auto;
    top: 0;
    z-index: 99;
    width: fit-content;
    min-width: 0;

    .title-link,
    .child-link {
      color: inherit;
      font-weight: 600;
      display: block;
      padding: 0.5rem 0px;
      line-height: 1.35;
      text-decoration: none;
      white-space: nowrap;
      overflow-wrap: normal;
      word-break: normal;
      width: fit-content;
    }

    .child-link {
      font-weight: 400;
      font-size: 0.82rem;
      color: ${({ theme }) => theme.colors.text.muted};
      opacity: 0.78;
      letter-spacing: 0.01em;
    }

    .mega-menu-content {
      width: fit-content;
      min-width: 0;
    }

    .mega-menu-list {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.35rem;
      min-width: 0;
      width: fit-content;
    }

    .mega-menu-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: fit-content;
      min-width: 0;
      gap: 0.15rem;
    }

    .mega-menu-subcategories {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: fit-content;
      min-width: 0;
      gap: 0.15rem;
    }
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
