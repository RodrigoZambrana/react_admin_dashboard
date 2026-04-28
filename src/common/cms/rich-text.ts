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

export type CmsRichTextContent = {
  nodes: CmsRichTextNode[];
};

export const isCmsRichTextNode = (value: unknown): value is CmsRichTextNode => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const node = value as Record<string, unknown>;
  if (node.type === "text") {
    return typeof node.value === "string";
  }

  if (node.type === "element") {
    return typeof node.tag === "string";
  }

  return false;
};

export const isCmsRichTextContent = (value: unknown): value is CmsRichTextContent => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return Array.isArray(payload.nodes) && payload.nodes.every(isCmsRichTextNode);
};

