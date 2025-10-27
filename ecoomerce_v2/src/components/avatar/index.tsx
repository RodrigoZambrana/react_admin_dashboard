"use client";

import Image from "next/image";
import { CSSProperties, ReactNode } from "react";
import { BorderProps, ColorProps, SpaceProps, LayoutProps } from "styled-system";
// STYLED COMPONENT
import StyledAvatar from "./styles";

// ==============================================================
export interface BaseAvatarProps extends BorderProps, ColorProps, SpaceProps, LayoutProps {
  size?: number;
}

export interface AvatarProps extends BaseAvatarProps {
  src?: string;
  alt?: string;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
}
// ==============================================================

export default function Avatar({
  src,
  children,
  className,
  size = 48,
  alt = "avatar",
  ...props
}: AvatarProps) {
  return (
    <StyledAvatar size={size} {...props}>
      {src && <Image fill src={src} alt={alt} sizes="100%" />}
      {!src && children && <span>{children}</span>}
    </StyledAvatar>
  );
}
