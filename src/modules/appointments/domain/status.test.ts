import { describe, expect, it } from "vitest";
import { canTransitionAppointment, isAppointmentStatus } from "./status";

describe("appointment status", () => {
  it("allows the simplified service flow", () => {
    expect(canTransitionAppointment("BOOKED", "COMPLETED")).toBe(true);
    expect(canTransitionAppointment("BOOKED", "CANCELLED")).toBe(true);
    expect(canTransitionAppointment("BOOKED", "NO_SHOW")).toBe(true);
  });

  it("does not reopen terminal appointments", () => {
    expect(canTransitionAppointment("COMPLETED", "BOOKED")).toBe(false);
    expect(canTransitionAppointment("CANCELLED", "CONFIRMED")).toBe(false);
    expect(isAppointmentStatus("UNKNOWN")).toBe(false);
  });
});
