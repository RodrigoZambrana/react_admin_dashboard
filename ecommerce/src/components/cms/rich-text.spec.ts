import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { renderCmsRichTextContent } from "./rich-text";

describe("renderCmsRichTextContent", () => {
  it("renders structured rich text without html fallback", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        renderCmsRichTextContent(
          {
            richText: [
              {
                type: "element",
                tag: "p",
                children: [
                  { type: "text", value: "Hola " },
                  {
                    type: "element",
                    tag: "strong",
                    children: [{ type: "text", value: "mundo" }],
                  },
                ],
              },
              {
                type: "element",
                tag: "ul",
                children: [
                  {
                    type: "element",
                    tag: "li",
                    children: [{ type: "text", value: "Uno" }],
                  },
                ],
              },
            ],
          },
          { allowHtmlFallback: false },
        ),
      ),
    );

    expect(markup).toContain("<p>Hola <strong>mundo</strong></p>");
    expect(markup).toContain("<ul><li>Uno</li></ul>");
  });

  it("falls back to editorial html when structured data is absent", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        renderCmsRichTextContent(
          {
            bodyHtml: "<p>Texto editorial</p>",
          },
          { allowHtmlFallback: true },
        ),
      ),
    );

    expect(markup).toContain("<p>Texto editorial</p>");
  });
});
