import { describe, expect, it } from "vitest";
import { addCalendarMonths, monthGridDates, startOfCalendarWeek } from "./calendar";

describe("agenda calendar", () => {
  it("starts weeks on Monday", () => {
    expect(startOfCalendarWeek("2026-08-31")).toBe("2026-08-31");
    expect(startOfCalendarWeek("2026-09-06")).toBe("2026-08-31");
  });

  it("moves between months without overflowing short months", () => {
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addCalendarMonths("2026-03-31", -1)).toBe("2026-02-01");
  });

  it("builds a Monday-first grid containing every day of the month", () => {
    const august = monthGridDates("2026-08-19");
    expect(august).toHaveLength(42);
    expect(august[0]).toBeNull();
    expect(august[5]).toBe("2026-08-01");
    expect(august.filter(Boolean)).toHaveLength(31);
  });
});
