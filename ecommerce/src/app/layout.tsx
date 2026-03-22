import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import localFont from "next/font/local";
// THEME PROVIDER
import StyledComponentsRegistry from "@lib/registry";
// CONTEXT PROVIDER
import CartProvider from "@context/CartContext";
// THIRD PARTY CSS FILE
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import { ThemeProvider } from "theme";
import NProgressBar from "@component/NProgress";
import { I18nProvider } from "@/state/i18n-context";
import ToastProvider from "@context/ToastContext";
import NetworkStatusBanner from "@/components/status/NetworkStatusBanner";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

const publicSans = localFont({
  src: [
    {
      path: "./fonts/public-sans/PublicSans-VariableFont_wght.woff2",
      style: "normal",
      weight: "100 900"
    },
    {
      path: "./fonts/public-sans/PublicSans-Italic-VariableFont_wght.woff2",
      style: "italic",
      weight: "100 900"
    }
  ],
  display: "swap"
});

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata();
}

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={publicSans.className}>
        <StyledComponentsRegistry>
          <I18nProvider>
            <ThemeProvider>
              <ToastProvider>
                <CartProvider>
                  {children}
                  <NetworkStatusBanner />
                  <NProgressBar />
                </CartProvider>
              </ToastProvider>
            </ThemeProvider>
          </I18nProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
