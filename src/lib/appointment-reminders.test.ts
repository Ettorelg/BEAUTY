import { describe, expect, it } from "vitest";
import { getReminderWindow } from "./appointment-reminders";

describe("appointment reminder window", () => {
  it("seleziona appuntamenti tra 50 e 70 minuti", () => {
    const now = new Date("2026-08-30T10:00:00.000Z");
    const window = getReminderWindow(now);
    expect(window.from.toISOString()).toBe("2026-08-30T10:50:00.000Z");
    expect(window.to.toISOString()).toBe("2026-08-30T11:10:00.000Z");
  });
});
