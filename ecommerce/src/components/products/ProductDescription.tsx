import Typography from "@component/Typography";

interface ProductDescriptionProps {
  description?: string;
  descriptionHtml?: string;
}

export default function ProductDescription({
  description,
  descriptionHtml
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
    </div>
  );
}
