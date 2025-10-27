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
      }
      *:not(.logo) {
        display: none;
      }
    }
  }

  .topbar-right {
    .link {
      padding-right: 30px;
      color: white;
    }
    .dropdown-handler {
      display: flex;
      align-items: center;
      height: 40px;
      cursor: pointer;
      img {
        height: 14px;
        border-radius: 4px;
      }
      span {
        margin-right: 0.25rem;
        margin-left: 0.5rem;
      }
    }
    @media only screen and (max-width: 900px) {
      .link {
        display: none;
      }
    }
  }
`;
