"use client";

import type { ComponentProps } from "react";

import FlexBox from "@component/FlexBox";
import Typography from "@component/Typography";

type NoImagePlaceholderProps = ComponentProps<typeof FlexBox> & {
  text?: string;
};

export default function NoImagePlaceholder({
  text = "No image available",
  borderRadius = 12,
  children,
  ...rest
}: NoImagePlaceholderProps) {
  return (
    <FlexBox
      alignItems="center"
      justifyContent="center"
      bg="gray.200"
      color="gray.600"
      borderRadius={borderRadius}
      textAlign="center"
      px="0.75rem"
      py="0.5rem"
      {...rest}>
      <Typography fontSize="12px" lineHeight={1.4} color="gray.600">
        {text}
      </Typography>
      {children}
    </FlexBox>
  );
}
