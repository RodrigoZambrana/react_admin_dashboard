import { describe, expect, it } from "vitest";

import {
  normalizeStructuralEventName,
  STRUCTURAL_EVENT_NAMES,
} from "./eventSchema";

describe("structural analytics event names", () => {
  it("keeps canonical structural names stable", () => {
    expect(STRUCTURAL_EVENT_NAMES).toContain("view_item");
    expect(STRUCTURAL_EVENT_NAMES).toContain("purchase");
  });

  it("does not rewrite unknown legacy aliases", () => {
    expect(normalizeStructuralEventName("view_product")).toBe("view_product");
    expect(normalizeStructuralEventName("purchase_completed")).toBe("purchase_completed");
  });
});
