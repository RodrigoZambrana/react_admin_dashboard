import styled from "styled-components";

const StyledSearchBox = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  .search-icon {
    position: absolute;
    color: ${({ theme }) => theme.colors.text.hint};
    left: 1rem;
    z-index: 1;
  }

  .search-field {
    flex: 1 1 0;
    padding-left: 3rem;
    padding-right: 11.5rem;
    height: 44px;
    border-radius: 8px;
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
    position: absolute;
    right: 0px;
    color: ${({ theme }) => theme.colors.text.hint};
  }
  .dropdown-handler {
    height: 40px;
    cursor: pointer;
    min-width: 90px;
    padding-left: 1.25rem;
    padding-right: 1rem;
    border-left: 1px solid ${({ theme }) => theme.colors.text.disabled};
    span {
      margin-right: 0.75rem;
    }
  }
  .menu-button {
    display: none;
  }
  @media only screen and (max-width: 900px) {
    .search-icon {
      left: 1rem;
    }
    .search-field {
      height: 40px;
      border-radius: 300px;
      padding-left: 2.75rem;
      padding-right: 8rem;
    }
    .search-button {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }
    .menu-button {
      display: unset;
    }
    .category-dropdown {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
    }
    .dropdown-handler {
      border-left: none;
      background-color: ${({ theme }) => theme.colors.body.paper};
      border: 1px solid ${({ theme }) => theme.colors.text.disabled};
      border-radius: 999px;
      min-width: 0;
      padding: 0.25rem 0.75rem;
      span {
        margin-right: 0.5rem;
        font-size: 12px;
      }
    }
  }
`;

export default StyledSearchBox;
