import styled from "styled-components";
import { layoutConstant } from "utils/constants";

const StyledHeader = styled.header`
  z-index: 111;
  position: relative;
  height: ${layoutConstant.headerHeight};
  background: ${({ theme }) => theme.colors.body.paper};

  .container {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .search-wrapper {
    flex: 1 1 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .mobile-actions {
    display: none;
    align-items: center;
    gap: 0.5rem;
  }

  .desktop-only {
    display: flex;
  }

  .mobile-only {
    display: none;
  }

  .logo {
    img {
      display: block;
    }
  }

  .category-holder {
    margin-left: 1rem;
    flex-shrink: 0;
  }

  .icon-holder {
    span {
      font-size: 12px;
      line-height: 1;
      margin-bottom: 4px;
    }
    h4 {
      margin: 0px;
      font-size: 14px;
      line-height: 1;
      font-weight: 600;
    }
    div {
      margin-left: 6px;
    }
  }

  .user {
    cursor: pointer;
  }

  .notification-handler {
    position: relative;

    .badge {
      position: absolute;
      top: 2px;
      right: 2px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 999px;
      background-color: ${({ theme }) => theme.colors.primary.main};
      color: ${({ theme }) => theme.colors.primary.text};
      font-size: 10px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
  }

  @media only screen and (max-width: 900px) {
    height: ${layoutConstant.mobileHeaderHeight};

    .container {
      gap: 0.5rem;
    }

    .logo,
    .icon-holder,
    .category-holder {
      display: none;
    }
    .header-right {
      display: none !important;
    }

    .desktop-only {
      display: none !important;
    }

    .mobile-only {
      display: flex !important;
    }
  }
`;

export default StyledHeader;
