"use client";

import { useState, useCallback } from "react";
import styled from "styled-components";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";

import { IconButton, IconButtonProps } from "@component/buttons";

const WishlistButtonRoot = styled(IconButton)(({ theme }) => ({
  width: 36,
  height: 36,
  padding: "0.5rem",
  borderRadius: "50%",
  backgroundColor: theme.colors.body.paper,
  color: theme.colors.gray[500],
  boxShadow: theme.shadows.small,
  transition: "background-color 0.3s ease, color 0.3s ease",
  "&:hover": {
    backgroundColor: theme.colors.secondary.main,
    color: theme.colors.gray[0]
  }
}));

type ProductWishlistButtonProps = Omit<IconButtonProps, "children">;

export default function ProductWishlistButton(props: ProductWishlistButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  const handleToggle = useCallback(() => {
    setIsFavorite((prev) => !prev);
  }, []);

  return (
    <WishlistButtonRoot
      size="small"
      aria-label="Toggle wishlist"
      onClick={handleToggle}
      type="button"
      {...props}>
      {isFavorite ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
    </WishlistButtonRoot>
  );
}
