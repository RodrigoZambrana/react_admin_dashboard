"use client";

import styled from "styled-components";

import FlexBox from "@component/FlexBox";
import { deviceSize } from "@utils/constants";

export const Wrapper = styled.div`
  margin-bottom: 3rem;
  border-radius: 8px;
  overflow: hidden;

  .slick-dots {
    justify-content: flex-start;
    padding-left: 72px;
    .slick-active {
      span {
        background-color: ${(props) => props.theme.colors.secondary.main};
      }
    }
  }

  @media only screen and (max-width: ${deviceSize.sm}px) {
    .slick-dots {
      justify-content: center;
      padding-left: 0;
    }
  }
`;

export const ContentWrapper = styled(FlexBox)`
  align-items: center;

  .card__inner-box {
    padding: 40px 0px 97px 72px;
  }

  @media only screen and (max-width: ${deviceSize.sm}px) {
    flex-direction: column-reverse;

    .card__inner-box {
      padding: 2rem 2rem;
      padding-bottom: 4rem;
    }

    .card__img {
      margin-top: 1rem;
    }
  }
`;
