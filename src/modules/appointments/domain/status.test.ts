import { describe, expect, it } from "vitest";
import { canTransitionAppointment, isAppointmentStatus } from "./status";

describe("appointment status", () => {
  it("allows the normal service flow", () => {
    expect(canTransitionAppointment("BOOKED", "CONFIRMED")).toBe(true);
    expect(canTransitionAppointment("CONFIRMED", "ARRIVED")).toBe(true);
    expect(canTransitionAppointment("ARRIVED", "COMPLETED")).toBe(true);
  });

  it("does not reopen terminal appointments", () => {
    expect(canTransitionAppointment("COMPLETED", "BOOKED")).toBe(false);
    expect(canTransitionAppointment("CANCELLED", "CONFIRMED")).toBe(false);
    expect(isAppointmentStatus("UNKNOWN")).toBe(false);
  });
});
