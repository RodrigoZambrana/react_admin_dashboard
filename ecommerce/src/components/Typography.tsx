"use client";

import { JSX, memo, forwardRef } from "react";
import type { ReactNode } from "react";
import {
  flex,
  space,
  color,
  border,
  layout,
  compose,
  textStyle,
  typography,
  FlexProps,
  SpaceProps,
  ColorProps,
  BorderProps,
  LayoutProps,
  TextStyleProps,
  TypographyProps
} from "styled-system";
import styled, { CSSProperties } from "styled-components";
import { isValidProp } from "@utils/utils";
import { useTranslatedNode } from "@/state/i18n-context";

// ==============================================================
interface Props
  extends TypographyProps,
    SpaceProps,
    ColorProps,
    FlexProps,
    LayoutProps,
    BorderProps,
    TextStyleProps {
  title?: string;
  className?: string;
  ellipsis?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
  as?: keyof JSX.IntrinsicElements;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}
// ==============================================================

const styleProps = compose(flex, space, color, border, layout, textStyle, typography);

const StyledTypography = styled.div.withConfig({
  shouldForwardProp: (prop) => isValidProp(prop)
})<Props>(
  ({ ellipsis }) => ({
    ...(ellipsis && {
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    })
  }),
  styleProps
);

const TypographyBase = forwardRef<HTMLDivElement, Props>(({ children, ...props }, ref) => {
  const content = useTranslatedNode(children);
  return (
    <StyledTypography ref={ref} {...props}>
      {content}
    </StyledTypography>
  );
});

TypographyBase.displayName = "Typography";

const Typography = memo(TypographyBase);

export const H1 = memo(({ children, ...props }: Props) => (
  <Typography as="h1" mb="0" mt="0" fontSize="30px" {...props}>
    {children}
  </Typography>
));

export const H2 = memo(({ children, ...props }: Props) => (
  <Typography as="h2" mb="0" mt="0" fontSize="25px" {...props}>
    {children}
  </Typography>
));

export const H3 = memo(({ children, ...props }: Props) => (
  <Typography as="h3" mb="0" mt="0" fontSize="20px" {...props}>
    {children}
  </Typography>
));

export const H4 = memo(({ children, ...props }: Props) => (
  <Typography as="h4" mb="0" mt="0" fontWeight="600" fontSize="17px" {...props}>
    {children}
  </Typography>
));

export const H5 = memo(({ children, ...props }: Props) => (
  <Typography as="h5" mb="0" mt="0" fontWeight="600" fontSize="16px" {...props}>
    {children}
  </Typography>
));

export const H6 = memo(({ children, ...props }: Props) => (
  <Typography as="h6" mb="0" mt="0" fontWeight="600" fontSize="14px" {...props}>
    {children}
  </Typography>
));

export const Paragraph = memo(({ children, ...props }: Props) => (
  <Typography as="p" mb="0" mt="0" {...props}>
    {children}
  </Typography>
));

export const Span = memo(({ children, ...props }: Props) => (
  <Typography as="span" fontSize="16px" {...props}>
    {children}
  </Typography>
));

export const SemiSpan = memo(({ children, ...props }: Props) => (
  <Typography as="span" fontSize="14px" color="text.muted" {...props}>
    {children}
  </Typography>
));

export const Small = memo(({ children, ...props }: Props) => (
  <Typography as="span" fontSize="12px" {...props}>
    {children}
  </Typography>
));

export const Tiny = memo(({ children, ...props }: Props) => (
  <Typography as="span" fontSize="10px" {...props}>
    {children}
  </Typography>
));

export default Typography;
