import type { Metadata } from "next";

import Container from "@component/Container";
import { H1, H3, Paragraph } from "@component/Typography";
import Box from "@component/Box";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Términos y condiciones",
    description: "Condiciones generales de compra, uso del sitio y atención al cliente."
  });
}

const sections = [
  {
    title: "Uso del sitio",
    body: "Al navegar o comprar en urucortinas aceptas utilizar el sitio de forma lícita, sin interferir con su funcionamiento ni con la experiencia de otros usuarios."
  },
  {
    title: "Productos, precios y disponibilidad",
    body: "Los precios, imágenes, especificaciones y disponibilidad pueden actualizarse. La confirmación final de una compra queda sujeta a la validación del pedido, del pago y de la disponibilidad operativa."
  },
  {
    title: "Pagos y confirmaciones",
    body: "Los pagos electrónicos quedan sujetos a la aprobación del proveedor de pagos. En pagos en efectivo, el pedido puede registrarse, pero la acreditación final depende de la confirmación manual de nuestro equipo."
  },
  {
    title: "Entregas",
    body: "Las fechas estimadas de entrega son una referencia operativa. Pueden ajustarse por disponibilidad, coordinación logística, instalación, zona de envío u otros factores propios del pedido."
  },
  {
    title: "Soporte y contacto",
    body: "Si necesitas asistencia sobre tu cuenta, pedidos, direcciones, pagos o seguridad, puedes comunicarte por los canales oficiales publicados en el sitio."
  }
];

export default function TermsAndConditionsPage() {
  return (
    <Container my="3rem" style={{ maxWidth: 860 }}>
      <H1 mb="0.75rem">Términos y condiciones</H1>
      <Paragraph color="text.muted" mb="2rem">
        Estas condiciones resumen el funcionamiento comercial y operativo actual del sitio público de
        urucortinas.
      </Paragraph>

      <Box display="flex" flexDirection="column" style={{ gap: "1.5rem" }}>
        {sections.map((section) => (
          <Box key={section.title}>
            <H3 mb="0.5rem">{section.title}</H3>
            <Paragraph mb={0}>{section.body}</Paragraph>
          </Box>
        ))}
      </Box>
    </Container>
  );
}
