export const appointmentStatuses = ["BOOKED", "CONFIRMED", "ARRIVED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];

const transitions: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  BOOKED: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["ARRIVED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  ARRIVED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus) {
  return transitions[from].includes(to);
}

export function isAppointmentStatus(value: string): value is AppointmentStatus {
  return appointmentStatuses.includes(value as AppointmentStatus);
}
