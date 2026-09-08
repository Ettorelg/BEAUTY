import { describe, expect, it } from "vitest";
import { normalizeBusinessSlug } from "./business-slug";

describe("business slug", () => {
  it("normalizza nome e accenti", () => {
    expect(normalizeBusinessSlug("  Èlite Wellness Lab  ")).toBe("elite-wellness-lab");
  });

  it("elimina punteggiatura ripetuta", () => {
    expect(normalizeBusinessSlug("Hair & Nail---Studio")).toBe("hair-nail-studio");
  });
});
