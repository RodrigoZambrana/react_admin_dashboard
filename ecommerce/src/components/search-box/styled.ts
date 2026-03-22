import styled from "styled-components";

const StyledSearchBox = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.text.disabled};
  border-radius: 999px;
  background-color: ${({ theme }) => theme.colors.body.paper};
  overflow: visible;

  .search-icon {
    color: ${({ theme }) => theme.colors.text.hint};
  }

  .search-trigger {
    position: absolute;
    left: 0.75rem;
    z-index: 1;
    border: 0;
    padding: 0.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    cursor: pointer;
  }

  .search-field {
    flex: 1 1 0;
    min-width: 0;
    padding-left: 3rem;
    padding-right: 1rem;
    height: 44px;
    border: 0;
    border-radius: 999px;
    background-color: transparent;
    box-shadow: none;

    &:hover,
    &:focus {
      border-color: transparent;
      outline: none;
      box-shadow: none;
    }
  }
  .search-button {
    position: absolute;
    height: 100%;
    right: 0px;
    border-radius: 0 8px 8px 0;
    padding-left: 55px;
    padding-right: 55px;
  }
  .category-dropdown {
    flex: 0 0 auto;
    position: relative;
    z-index: 3;
    color: ${({ theme }) => theme.colors.text.hint};
    background-color: ${({ theme }) => theme.colors.gray[100]};
    border-left: 1px solid ${({ theme }) => theme.colors.text.disabled};
    border-radius: 0 999px 999px 0;

    .menu-item-holder {
      max-height: min(22rem, calc(100vh - 8rem));
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }
  }
  .dropdown-handler {
    height: 44px;
    cursor: pointer;
    min-width: 128px;
    padding-left: 1rem;
    padding-right: 0.9rem;
    border: 0;
    outline: 0;
    appearance: none;
    border-left: 0;
    background-color: transparent;
    border-radius: 0 999px 999px 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    span {
      margin-right: 0.5rem;
      font-size: 13px;
      max-width: 130px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }
  .menu-button {
    display: none;
  }
  @media only screen and (max-width: 900px) {
    .search-icon {
      left: 0;
    }
    .search-field {
      height: 44px;
      padding-left: 2.75rem;
      padding-right: 0.75rem;
    }
    .search-button {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }
    .menu-button {
      display: unset;
    }
    .category-dropdown {
      display: flex;
      align-items: stretch;
      border-radius: 0 999px 999px 0;
    }
    .dropdown-handler {
      height: 100%;
      min-width: 104px;
      padding: 0 0.85rem 0 0.85rem;
      border-radius: 0 999px 999px 0;
      span {
        margin-right: 0.5rem;
        font-size: 12px;
        max-width: 68px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }
  }
`;

export default StyledSearchBox;
