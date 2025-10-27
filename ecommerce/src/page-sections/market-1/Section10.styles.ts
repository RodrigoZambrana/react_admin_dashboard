"use client";

import styled from "styled-components";

export const CategoryWrapper = styled.div(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  borderRadius: "8px",
  cursor: "pointer",
  "& img": {
    transition: "transform 0.35s ease"
  },
  "&:hover": {
    "& img": { transform: "scale(1.06)" },
    "& .category-title": {
      color: theme.colors.gray[0],
      backgroundColor: theme.colors.secondary.main
    }
  }
}));

export const CategoryTitle = styled.div(({ theme }) => ({
  position: "absolute",
  left: 12,
  right: 12,
  bottom: 12,
  padding: "0.5rem",
  borderRadius: "6px",
  textAlign: "center",
  backgroundColor: "rgba(255, 255, 255, 0.75)",
  transition: "all 0.35s ease"
}));
