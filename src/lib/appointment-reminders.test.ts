import { describe, expect, it } from "vitest";
import { getReminderWindow } from "./appointment-reminders";

describe("appointment reminder window", () => {
  it("seleziona appuntamenti a circa 24 ore di distanza", () => {
    const now = new Date("2026-08-30T10:00:00.000Z");
    const window = getReminderWindow(now);
    expect(window.from.toISOString()).toBe("2026-08-31T09:50:00.000Z");
    expect(window.to.toISOString()).toBe("2026-08-31T10:10:00.000Z");
  });
});
