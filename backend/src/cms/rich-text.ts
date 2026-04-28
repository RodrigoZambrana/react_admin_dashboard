import { load } from "cheerio";

export type CmsRichTextNode =
  | {
      type: "text";
      value: string;
    }
  | {
      type: "element";
      tag: string;
      attributes?: Record<string, string | number | boolean | null | undefined>;
      children?: CmsRichTextNode[];
    };

const normalizeTagName = (value: string) => value.trim().toLowerCase();

const extractAttributes = (attribs: Record<string, string> | undefined, tag: string) => {
  if (!attribs) return undefined;

  const entries = Object.entries(attribs)
    .map(([key, value]) => {
      if (value === undefined || value === null) {
        return null;
      }
      const normalizedValue = String(value).trim();
      if (!normalizedValue) {
        return null;
      }
      return [key, normalizedValue] as const;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (!entries.length) {
    return undefined;
  }

  const attrs = Object.fromEntries(entries) as Record<string, string>;

  if (tag === "a") {
    return {
      href: attrs.href,
      target: attrs.target,
      rel: attrs.rel,
      title: attrs.title,
    };
  }

  if (tag === "img") {
    return {
      src: attrs.src,
      alt: attrs.alt,
      title: attrs.title,
      width: attrs.width,
      height: attrs.height,
    };
  }

  if (tag === "table" || tag === "col" || tag === "colgroup" || tag === "td" || tag === "th") {
    return {
      colspan: attrs.colspan,
      rowspan: attrs.rowspan,
      scope: attrs.scope,
    };
  }

  if (tag === "ol") {
    return {
      start: attrs.start,
      type: attrs.type,
    };
  }

  return {
    className: attrs.class,
    title: attrs.title,
    style: attrs.style,
  };
};

const parseDomNode = (node: any): CmsRichTextNode | null => {
  if (!node) {
    return null;
  }

  if (node.type === "text") {
    const value = typeof node.data === "string" ? node.data : "";
    return value ? { type: "text", value } : null;
  }

  if (node.type !== "tag") {
    return null;
  }

  const tag = normalizeTagName(String(node.tagName ?? node.name ?? ""));
  if (!tag || tag === "script" || tag === "style" || tag === "noscript") {
    return null;
  }

  const children = Array.isArray(node.children)
    ? node.children
        .map((child: any) => parseDomNode(child))
        .flatMap((child) => (child ? [child] : []))
    : [];

  const attributes = extractAttributes(node.attribs ?? undefined, tag);

  return {
    type: "element",
    tag,
    ...(attributes ? { attributes } : {}),
    ...(children.length ? { children } : {}),
  };
};

export const htmlFragmentToCmsRichTextNodes = (html: string): CmsRichTextNode[] => {
  const fragment = load(html ?? "", undefined, false);
  const nodes = fragment
    .root()
    .contents()
    .toArray()
    .map((node) => parseDomNode(node))
    .flatMap((node) => (node ? [node] : []))
    .filter((node) => node.type !== "text" || node.value.trim().length > 0);

  return nodes;
};
