import type { Metadata } from "next";
import Container from "@component/Container";
import CloudinaryMediaUploader from "@/components/media/CloudinaryMediaUploader";
import { buildStorefrontPageMetadata } from "@/lib/page-metadata";

export const revalidate = 360;

export async function generateMetadata(): Promise<Metadata> {
  return buildStorefrontPageMetadata({
    title: "Cloudinary signed upload",
    description: "Demo del flujo signed upload con firma backend, validación y progress bar.",
    canonicalPath: "/mock/cloudinary-upload",
  });
}

export default function CloudinaryUploadDemoPage() {
  return (
    <Container>
      <main style={{ padding: "64px 0", display: "grid", gap: 24 }}>
        <div style={{ maxWidth: 760 }}>
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 12 }}>
            Signed upload
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1.05 }}>
            Upload directo a Cloudinary con firma backend
          </h1>
          <p style={{ color: "#475569" }}>
            El backend firma el upload, el frontend valida tipo y tamaño antes de enviar el archivo directo a
            Cloudinary y la DB solo guarda metadata.
          </p>
        </div>

        <CloudinaryMediaUploader productId={1} type="image" />
      </main>
    </Container>
  );
}

