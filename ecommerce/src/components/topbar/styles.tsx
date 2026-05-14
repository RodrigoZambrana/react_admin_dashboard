import styled from "styled-components";

export const StyledTopbar = styled.div`
  background: ${({ theme }) => theme.colors.secondary.main};
  color: white;
  height: 40px;
  font-size: 12px;
  .container {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .phone,
  .email,
  .topbar-left,
  .topbar-right {
    display: flex;
    align-items: center;
  }
  .phone,
  .email {
    color: inherit;
    text-decoration: none;
  }
  .topbar-left {
    .email {
      margin-inline-start: 20px;
    }
    .logo {
      display: none;
      img {
        display: block;
        height: 36px;
      }
    }
    span {
      margin-left: 10px;
    }
    @media only screen and (max-width: 900px) {
      .logo {
        display: block;
        margin: 0.25rem 0;
      }
      .phone,
      .email {
        display: none;
      }
    }
  }

  .topbar-right {
    gap: 0.5rem;

    .link {
      padding-right: 30px;
      color: white;
    }

    .dropdown-handler {
      display: flex;
      align-items: center;
      height: 40px;
      cursor: pointer;
      position: relative;
      z-index: 1201;
      img {
        height: 14px;
        border-radius: 4px;
      }
      span {
        margin-right: 0.25rem;
        margin-left: 0.5rem;
      }
    }

    .currency-selector {
      min-width: 104px;
      max-width: 104px;
      flex: 0 0 104px;
    }

    @media only screen and (max-width: 900px) {
      gap: 0.35rem;

      .link {
        display: none;
      }

      .currency-selector {
        min-width: 92px;
        max-width: 92px;
        flex-basis: 92px;
      }
    }
  }
`;
