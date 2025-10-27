"use client";

import styled from "styled-components";
import Box from "@component/Box";

export const TitleBox = styled(Box)`
  text-align: center;
  margin-block: 2rem;
  & h1 {
    font-size: 40px;
    font-weight: 600;
    margin-bottom: 10px;
  }
  & div {
    width: 200px;
    height: 2px;
    margin: auto;
    background-color: ${({ theme }) => theme.colors.primary.main};
  }
`;
