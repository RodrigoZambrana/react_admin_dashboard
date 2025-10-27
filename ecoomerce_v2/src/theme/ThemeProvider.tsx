"use client";

import { PropsWithChildren } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider as StyledThemeProvider } from "styled-components";

import GlobalStyles from "./GlobalStyles";
import getThemeOptions from "./themeOptions";

export default function ThemeProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const theme = getThemeOptions(pathname);

  return (
    <StyledThemeProvider theme={theme}>
      <GlobalStyles />
      {children}
    </StyledThemeProvider>
  );
}
