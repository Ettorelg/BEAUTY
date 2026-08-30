import { describe, expect, it } from "vitest";
import { validateDailyShifts } from "./staff-shifts";

describe("staff daily shifts", () => {
  it("accetta uno o due turni separati e li ordina", () => {
    expect(validateDailyShifts([{ startMinutes: 840, endMinutes: 1080 }, { startMinutes: 540, endMinutes: 780 }]))
      .toEqual([{ startMinutes: 540, endMinutes: 780 }, { startMinutes: 840, endMinutes: 1080 }]);
  });

  it("rifiuta sovrapposizioni e più di due turni", () => {
    expect(() => validateDailyShifts([{ startMinutes: 540, endMinutes: 800 }, { startMinutes: 780, endMinutes: 900 }])).toThrow("sovrapporsi");
    expect(() => validateDailyShifts([{ startMinutes: 1, endMinutes: 2 }, { startMinutes: 3, endMinutes: 4 }, { startMinutes: 5, endMinutes: 6 }])).toThrow("massimo due");
  });
});
