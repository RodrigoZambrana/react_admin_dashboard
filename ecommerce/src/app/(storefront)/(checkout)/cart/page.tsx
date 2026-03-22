import type { Metadata } from "next";
import Box from "@component/Box";
import { H2, Paragraph } from "@component/Typography";

import { CartView } from "@/components/cart/CartView";
import TranslatedText from "@/components/i18n/TranslatedText";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Carrito",
    description: "Revisa los productos agregados al carrito antes de continuar con la compra."
  });
}

export default function CartPage() {
  return (
    <Box>
      <Box mb="2rem">
        <H2 fontWeight={600} mb="0.5rem">
          <TranslatedText translationKey="cart.page.title" defaultMessage="Your Cart" />
        </H2>
        <Paragraph color="text.muted" maxWidth="520px">
          <TranslatedText
            translationKey="cart.page.subtitle"
            defaultMessage="Items in your cart are reserved for a limited time. Complete checkout to confirm inventory allocation."
          />
        </Paragraph>
      </Box>

      <CartView />
    </Box>
  );
}
