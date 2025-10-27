"use client";

import { PropsWithChildren } from "react";
import SlickCarousel, { Settings } from "react-slick";
import { CSSObject } from "styled-components";
// LOCAL CUSTOM COMPONENTS
import CarouselDots from "./CarouselDots";
import CarouselArrows from "./CarouselArrows";
// STYLED COMPONENT
import { RootStyle } from "./styles";

// ==============================================================
interface Props extends PropsWithChildren, Settings {
  dotColor?: string;
  spaceBetween?: number;
  dotStyles?: CSSObject;
  arrowStyles?: CSSObject;
  ref?: React.Ref<SlickCarousel>;
}
// ==============================================================

export default function Carousel({
  ref,
  dotColor,
  children,
  arrowStyles,
  dots = false,
  arrows = true,
  slidesToShow = 4,
  spaceBetween = 10,
  dotStyles = { marginTop: "2rem" },
  ...others
}: Props) {
  const settings: Settings = {
    dots,
    arrows,
    slidesToShow,
    ...CarouselArrows({ style: arrowStyles }),
    ...CarouselDots({ dotColor, style: dotStyles }),
    ...others
  };

  return (
    <RootStyle space={spaceBetween}>
      <SlickCarousel ref={ref} {...settings}>
        {children}
      </SlickCarousel>
    </RootStyle>
  );
}
