import { ReactNode } from "react";
import { CSSProperties } from "styled-components";
// STYLED COMPONENTS
import { Dot, DotList } from "./styles";

// ==============================================================
interface Props {
  dotColor?: string;
  style?: CSSProperties;
}
// ==============================================================

export default function CarouselDots({ dotColor, style }: Props) {
  return {
    customPaging: () => <Dot dotColor={dotColor} />,
    appendDots: (dots: ReactNode) => <DotList style={style}>{dots}</DotList>
  };
}
