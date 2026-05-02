"use client";

import { createElement, type ReactNode } from "react";

import { isCmsRichTextContent, type CmsRichTextNode } from "@common/cms/rich-text";

type RichTextContent = Record<string, unknown> | null | undefined;

type RenderOptions = {
  allowHtmlFallback?: boolean;
  fallbackClassName?: string;
};

const isRichTextNodeArray = (value: unknown): value is CmsRichTextNode[] =>
  Array.isArray(value);

const readRichTextNodes = (content: RichTextContent): CmsRichTextNode[] | null => {
  if (!content || typeof content !== "object") {
    return null;
  }

  const record = content as Record<string, unknown>;
  const candidates = [
    record.richText,
    record.nodes,
    record.answerRichText,
    record.fragments,
  ];

  for (const candidate of candidates) {
    if (isRichTextNodeArray(candidate)) {
      return candidate;
    }
    if (isCmsRichTextContent(candidate)) {
      return candidate.nodes;
    }
  }

  return null;
};

const normalizeProps = (attributes?: Record<string, unknown>) => {
  if (!attributes) {
    return {};
  }

  const props: Record<string, string> = {};
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    const normalized = String(value).trim();
    if (!normalized) {
      return;
    }
    if (key === "className") {
      props.className = normalized;
      return;
    }
    if (key === "href" || key === "src" || key === "alt" || key === "title" || key === "target" || key === "rel" || key === "scope" || key === "style") {
      props[key] = normalized;
      return;
    }
    props[key] = normalized;
  });

  return props;
};

const renderNode = (node: CmsRichTextNode, key: string): ReactNode => {
  if (node.type === "text") {
    return node.value;
  }

  const children = (node.children ?? []).map((child, index) =>
    renderNode(child, `${key}-${index}`),
  );
  const attrs = normalizeProps(node.attributes);

  switch (node.tag) {
    case "br":
      return createElement("br", { key });
    case "hr":
      return createElement("hr", { key, ...attrs });
    case "img":
      return createElement("img", { key, ...attrs });
    case "a":
      return createElement(
        "a",
        {
          key,
          ...attrs,
          rel: attrs.target === "_blank" ? attrs.rel || "noreferrer" : attrs.rel,
        },
        children,
      );
    case "p":
    case "div":
    case "span":
    case "section":
    case "article":
    case "figure":
    case "figcaption":
    case "blockquote":
    case "strong":
    case "em":
    case "b":
    case "i":
    case "u":
    case "small":
    case "sup":
    case "sub":
    case "code":
    case "pre":
    case "table":
    case "thead":
    case "tbody":
    case "tfoot":
    case "tr":
    case "td":
    case "th":
    case "ul":
    case "ol":
    case "li":
    case "header":
    case "footer":
    case "main":
    case "nav":
      return createElement(node.tag, { key, ...attrs }, children);
    default:
      return createElement(node.tag, { key, ...attrs }, children);
  }
};

export const renderCmsRichTextNodes = (nodes: CmsRichTextNode[], keyPrefix = "rich-text") =>
  nodes.map((node, index) => renderNode(node, `${keyPrefix}-${index}`));

export const renderCmsRichTextContent = (
  content: RichTextContent,
  options: RenderOptions = {},
) => {
  const nodes = readRichTextNodes(content);
  const className = options.fallbackClassName;

  if (nodes && nodes.length > 0) {
    return createElement("div", { className }, renderCmsRichTextNodes(nodes));
  }

  if (!options.allowHtmlFallback || typeof content !== "object" || content === null) {
    return null;
  }

  const html =
    typeof content.html === "string"
      ? content.html
      : typeof content.bodyHtml === "string"
        ? content.bodyHtml
        : typeof content.answer === "string"
          ? content.answer
          : typeof content.body === "string"
            ? content.body
            : typeof content.description === "string"
              ? content.description
              : "";

  if (!html.trim()) {
    return null;
  }

  return createElement("div", {
    className,
    dangerouslySetInnerHTML: { __html: html },
  });
};
