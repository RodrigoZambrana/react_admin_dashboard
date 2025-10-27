"use client";

import styled from "styled-components";
import Container from "@component/Container";

// STYLED COMPONENT
export const Wrapper = styled(Container)`
  .footer-content {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
  }

  .footer-text {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 14px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text.muted};
    .heart-icon {
      color: ${({ theme }) => theme.colors.primary.main};
    }
  }

  .social-icons {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    & a {
      transition: color 0.3s ease-in-out;
      color: ${({ theme }) => theme.colors.text.muted};
      &:hover {
        color: ${({ theme }) => theme.colors.primary.main};
      }
    }
  }
`;
