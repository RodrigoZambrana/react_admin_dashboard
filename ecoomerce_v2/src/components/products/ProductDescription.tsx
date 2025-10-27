import Typography, { H3 } from "@component/Typography";

interface ProductDescriptionProps {
  description?: string;
  descriptionHtml?: string;
  specifications?: Array<{ label: string; value: string }>;
}

export default function ProductDescription({
  description,
  descriptionHtml,
  specifications = []
}: ProductDescriptionProps) {
  return (
    <div>
      {descriptionHtml ? (
        <div
          className="product-description-html"
          style={{ color: "inherit", lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
      ) : (
        <Typography color="text.muted">{description ?? "Product description is coming soon."}</Typography>
      )}

      {specifications.length > 0 ? (
        <div style={{ marginTop: "1.5rem" }}>
          <H3 mb="0.75rem">Specifications</H3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {specifications.map((item) => (
              <li
                key={item.label}
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  padding: "0.35rem 0",
                  borderBottom: "1px solid rgba(15, 23, 42, 0.08)"
                }}>
                <Typography fontWeight={500} minWidth="140px">
                  {item.label}
                </Typography>
                <Typography color="text.muted">{item.value}</Typography>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
