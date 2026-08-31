import { describe, expect, it } from "vitest";
import { calculateBookingPriceCents } from "./booking-price";

describe("calculateBookingPriceCents", () => {
  it("uses the best discount when stacking is disabled", () => {
    expect(calculateBookingPriceCents(10_000, 20, { type: "DISCOUNT_EUR", value: 3_000 }, false)).toBe(7_000);
  });
  it("stacks discounts only when explicitly enabled", () => {
    expect(calculateBookingPriceCents(10_000, 20, { type: "DISCOUNT_PERCENT", value: 10 }, true)).toBe(7_200);
  });
  it("never produces a negative price", () => {
    expect(calculateBookingPriceCents(2_000, 0, { type: "DISCOUNT_EUR", value: 5_000 }, false)).toBe(0);
  });
  it("supports a free service", () => {
    expect(calculateBookingPriceCents(5_000, 20, { type: "FREE_SERVICE", value: 0 }, false)).toBe(0);
  });
});
