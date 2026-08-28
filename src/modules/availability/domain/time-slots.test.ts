import { describe, expect, it } from "vitest";
import { generateStartTimes, parseTimeToMinutes, subtractIntervals } from "./time-slots";

describe("availability intervals", () => {
  it("removes pauses from a shift", () => {
    expect(subtractIntervals([{ start: 540, end: 780 }], [{ start: 660, end: 690 }])).toEqual([
      { start: 540, end: 660 }, { start: 690, end: 780 },
    ]);
  });

  it("does not offer a slot shorter than the service", () => {
    expect(generateStartTimes([{ start: 540, end: 570 }], 45)).toEqual([]);
  });

  it("generates aligned starts", () => {
    expect(generateStartTimes([{ start: 545, end: 650 }], 45, 15)).toEqual([555, 570, 585, 600]);
  });

  it("parses valid times", () => expect(parseTimeToMinutes("09:30")).toBe(570));
});
