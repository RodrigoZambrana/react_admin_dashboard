import { SiteLayout } from "@/components/layout/SiteLayout"
import { getStorefrontConfig } from "@/lib/storefront-config"
import { CartProvider } from "@/state/cart-context"

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const config = await getStorefrontConfig()

  return (
    <CartProvider>
      <SiteLayout config={config}>{children}</SiteLayout>
    </CartProvider>
  )
}
