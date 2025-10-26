// @ts-nocheck

import "./globals.css"
import "react-tippy/dist/tippy.css"
import "@/theme/styles/index.scss"
import CartContextProvider from "@global/CartContext"
import CompareContextProvider from "@global/CompareContext"
import WishlistContextProvider from "@global/WishlistContext"
import ProductsContextProvider from "@global/ProductsContext"

export const metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: {
    default: "Ecommerce Storefront",
    template: "%s · Ecommerce Storefront",
  },
  description:
    "Configurable Next.js storefront powered by a headless Node.js backend. Supports dynamic layouts, merchandising, and secure commerce flows.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <CartContextProvider>
          <CompareContextProvider>
            <WishlistContextProvider>
              <ProductsContextProvider>{children}</ProductsContextProvider>
            </WishlistContextProvider>
          </CompareContextProvider>
        </CartContextProvider>
      </body>
    </html>
  )
}
