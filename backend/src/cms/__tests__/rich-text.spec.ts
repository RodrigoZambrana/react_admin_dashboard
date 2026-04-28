import { describe, expect, it } from "vitest";

import { htmlFragmentToCmsRichTextNodes } from "../rich-text";

describe("htmlFragmentToCmsRichTextNodes", () => {
  it("parses block and inline structure without returning raw html", () => {
    const nodes = htmlFragmentToCmsRichTextNodes(
      "<p>Hola <strong>mundo</strong></p><ul><li>Uno</li><li>Dos</li></ul>",
    );

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toEqual({
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
    });
    expect(nodes[1]).toEqual({
      type: "element",
      tag: "ul",
      children: [
        {
          type: "element",
          tag: "li",
          children: [{ type: "text", value: "Uno" }],
        },
        {
          type: "element",
          tag: "li",
          children: [{ type: "text", value: "Dos" }],
        },
      ],
    });
  });
});

