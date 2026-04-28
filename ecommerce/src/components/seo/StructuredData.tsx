import { serializeJsonLd } from "@/lib/seo/structured-data";

type StructuredDataProps = {
  schemas: Array<Record<string, unknown> | Record<string, unknown>[]>;
};

export default function StructuredData({ schemas }: StructuredDataProps) {
  if (!schemas.length) return null;

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}
    </>
  );
}
