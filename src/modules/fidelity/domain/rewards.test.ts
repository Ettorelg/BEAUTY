import { describe, expect, it } from "vitest";
import { calculateEarnedPoints, canRedeemReward } from "./rewards";

describe("Fidelity rewards", () => {
  it("assegna punti soltanto per soglie di spesa complete", () => {
    expect(calculateEarnedPoints(24.99, 1000, 2)).toBe(4);
    expect(calculateEarnedPoints(9.99, 1000, 2)).toBe(0);
  });

  it("permette il riscatto soltanto con punti sufficienti", () => {
    expect(canRedeemReward(10, 10)).toBe(true);
    expect(canRedeemReward(9, 10)).toBe(false);
  });
});
