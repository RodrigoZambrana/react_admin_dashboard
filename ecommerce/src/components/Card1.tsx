"use client";

import styled from "styled-components";

import Card from "@component/Card";
import { isValidProp } from "@utils/utils";

export const Card1 = styled(Card).withConfig({
  shouldForwardProp: (prop) => isValidProp(prop)
})`
  padding: 1.5rem;
  position: relative;
  border-radius: 12px;
  @media only screen and (max-width: 678px) {
    padding: 1rem;
  }
`;
