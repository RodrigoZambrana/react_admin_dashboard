import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { Public_Sans } from "next/font/google";
// THEME PROVIDER
import StyledComponentsRegistry from "@lib/registry";
// CONTEXT PROVIDER
import CartProvider from "@context/CartContext";
// THIRD PARTY CSS FILE
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import { ThemeProvider } from "theme";
import NProgressBar from "@component/NProgress";

const publicSans = Public_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bonik - The Best React eCommerce Template",
  description:
    "Bonik is a React Next.js E-commerce template. Build SEO friendly Online store, delivery app and Multi vendor store",
  authors: [{ name: "UI-LIB", url: "https://ui-lib.com" }],
  keywords: ["e-commerce", "e-commerce template", "next.js", "react", "bonik"]
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body className={publicSans.className}>
        <StyledComponentsRegistry>
          <CartProvider>
            <ThemeProvider>
              {children}
              <NProgressBar />
            </ThemeProvider>
          </CartProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
