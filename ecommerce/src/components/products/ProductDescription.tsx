"use client";

import Typography from "@component/Typography";
import { useTranslation } from "@/state/i18n-context";

interface ProductDescriptionProps {
  description?: string;
  descriptionHtml?: string;
}

export default function ProductDescription({
  description,
  descriptionHtml
}: ProductDescriptionProps) {
  const t = useTranslation();
  return (
    <div>
      {descriptionHtml ? (
        <div
          className="product-description-html"
          style={{ color: "inherit", lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: descriptionHtml }}
        />
      ) : (
        <Typography color="text.muted">
          {description ??
            t("product.description.pending", {
              defaultMessage: "Product description is coming soon."
            })}
        </Typography>
      )}
    </div>
  );
}
