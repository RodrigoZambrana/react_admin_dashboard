"use client";

import Link from "next/link";
import styled from "styled-components";

import Card from "@component/Card";
import Grid from "@component/grid/Grid";

export const StyledGrid = styled(Grid)`
  @media only screen and (max-width: 1024px) {
    display: none;
  }
`;

export const DashboardNavigationWrapper = styled(Card)`
  @media only screen and (max-width: 768px) {
    height: calc(100vh - 64px);
    box-shadow: none;
    overflow-y: auto;
  }
`;

export const StyledDashboardNav = styled(Link).withConfig({
  shouldForwardProp: (prop) => prop !== "isActive"
})<{ isActive?: boolean }>`
  padding-inline: 1.5rem;
  margin-bottom: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left: 4px solid;
  transition: all 0.3s ease-in-out;
  color: ${({ isActive }) => (isActive ? ({ theme }) => theme.colors.primary.main : "inherit")};
  border-left-color: ${({ isActive }) =>
    isActive ? ({ theme }) => theme.colors.primary.main : "transparent"};

  &:last-child {
    margin-bottom: 0;
  }

  .icon {
    color: ${({ isActive }) =>
      isActive ? ({ theme }) => theme.colors.primary.main : ({ theme }) => theme.colors.gray[600]};
  }
  &:hover {
    color: ${({ theme }) => theme.colors.primary.main};
    border-left-color: ${({ theme }) => theme.colors.primary.main};
    .icon {
      color: ${({ theme }) => theme.colors.primary.main};
    }
  }
`;
