import { CustomArrowProps } from "react-slick";
import { CSSProperties } from "styled-components";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { ArrowButton } from "./styles";

// ==============================================================
interface ArrowProps extends CustomArrowProps {
  style?: CSSProperties;
}
// ==============================================================

function NextArrow({ onClick, style, className }: ArrowProps) {
  const updatedClassName = className
    .split(" ")
    .filter((item) => item !== "slick-next")
    .join(" ");

  return (
    <ArrowButton onClick={onClick} className={`next ${updatedClassName}`} style={style}>
      <IconChevronRight size={20} className="forward-icon" />
    </ArrowButton>
  );
}

function PrevArrow({ onClick, style, className }: ArrowProps) {
  const updatedClassName = className
    .split(" ")
    .filter((item) => item !== "slick-prev")
    .join(" ");

  return (
    <ArrowButton onClick={onClick} className={`prev ${updatedClassName}`} style={style}>
      <IconChevronLeft size={20} className="back-icon" />
    </ArrowButton>
  );
}

export default function CarouselArrows({ style }: { style?: CSSProperties }) {
  return {
    nextArrow: <NextArrow style={style} />,
    prevArrow: <PrevArrow style={style} />
  };
}
