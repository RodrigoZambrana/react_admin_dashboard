const stripExtension = (value: string) => value.replace(/\.[^.]+$/, "");

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const fallbackAnchor = (kind: string, order: number) => `${kind}-${String(order + 1).padStart(2, "0")}`;

export const normalizeMediaAnchor = (value: string) => value.trim().replace(/^#/, "");

export const buildMediaAnchor = ({
  title,
  publicId,
  kind = "media",
  order,
}: {
  title?: string | null;
  publicId?: string | null;
  kind?: string;
  order: number;
}) => {
  const baseName = stripExtension(publicId?.split("/").pop() || "");
  const source = title || baseName || fallbackAnchor(kind, order);
  return slugify(source) || fallbackAnchor(kind, order);
};
