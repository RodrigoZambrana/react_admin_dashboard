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
import { I18nProvider } from "@/state/i18n-context";
import ToastProvider from "@context/ToastContext";
import NetworkStatusBanner from "@/components/status/NetworkStatusBanner";

const publicSans = Public_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bonik - La mejor plantilla de comercio electrónico React",
  description:
    "Bonik es una plantilla de comercio electrónico basada en Next.js. Crea tiendas en línea optimizadas para SEO, apps de delivery y plataformas multivendedor.",
  authors: [{ name: "UI-LIB", url: "https://ui-lib.com" }],
  keywords: ["comercio electrónico", "plantilla ecommerce", "next.js", "react", "bonik"]
};

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
