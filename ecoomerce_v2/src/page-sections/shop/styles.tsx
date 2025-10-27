import styled from "styled-components";

import Card from "@component/Card";
import { colors } from "@utils/themeColors";
import { convertHexToRGB } from "@utils/utils";

export const ShopIntroWrapper = styled(Card)`
  border-radius: 12px;
  .shop-intro-content {
    display: flex;
    flex-wrap: wrap;
    padding-inline: 30px;
    margin-top: -64px;
    flex-direction: row;
  }
  .cover-image {
    height: 202px;
    background-image: url(/assets/images/banners/shop-cover.png);
    background-size: cover;
    background-position: center;
  }
  .description-holder {
    flex: 1 1 0;
    min-width: 250px;

    @media only screen and (max-width: 500px) {
      margin-left: 0px;
    }
  }
`;

type ShopWrapperProps = { coverImgUrl: string };

export const ShopCard1Wrapper = styled(Card)<ShopWrapperProps>`
  border-radius: 12px;
  .black-box {
    background-image: linear-gradient(
        to bottom,
        rgba(${convertHexToRGB(colors.gray[900])}, 0.8),
        rgba(${convertHexToRGB(colors.gray[900])}, 0.8)
      ),
      url(${(props) => props.coverImgUrl || "/assets/images/banners/cycle.png"});
    background-size: cover;
    background-position: center;
    color: white;
    padding: 17px 30px 56px;
  }
`;

export const StyledLink = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: #fff;
  border-radius: 0.5rem;
  background-color: ${({ theme }) => theme.colors.primary.main};
`;
