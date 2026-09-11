import { and, eq, inArray, lt, gt, gte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  appointmentRescheduleRequests,
  appointments,
  staffAbsences,
  staffMembers,
  staffServices,
  serviceOccurrences,
  workingHours,
} from "@/db/schema";
import {
  formatMinutes,
  generateStartTimes,
  subtractIntervals,
} from "../domain/time-slots";
import { zonedLocalToUtc } from "../domain/timezone";
import { ensureRescheduleSchema } from "@/lib/ensure-reschedule-schema";

export type PublicSlot = {
  staffId: string;
  staffName: string;
  localStart: string;
  label: string;
  availableSeats: number;
};

export async function getPublicAvailability(input: {
  businessId: string;
  serviceId: string;
  date: string;
  durationMinutes: number;
  timezone: string;
  capacity?: number;
}): Promise<PublicSlot[]> {
  await ensureRescheduleSchema();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return [];
  const dayStart = zonedLocalToUtc(`${input.date}T00:00`, input.timezone);
  const dayEnd = new Date(dayStart.getTime() + 26 * 60 * 60_000);
  const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay();

  const eligible = await db
    .select({ id: staffMembers.id, name: staffMembers.name })
    .from(staffServices)
    .innerJoin(
      staffMembers,
      and(
        eq(staffServices.staffId, staffMembers.id),
        eq(staffMembers.businessId, input.businessId),
        eq(staffMembers.active, true),
      ),
    )
    .where(
      and(
        eq(staffServices.businessId, input.businessId),
        eq(staffServices.serviceId, input.serviceId),
      ),
    );
  if (!eligible.length) return [];
  const staffIds = eligible.map((item) => item.id);
  const [hours, absences, bookings, holds, occurrences] = await Promise.all([
    db
      .select()
      .from(workingHours)
      .where(
        and(
          eq(workingHours.businessId, input.businessId),
          inArray(workingHours.staffId, staffIds),
          eq(workingHours.weekday, weekday),
        ),
      ),
    db
      .select()
      .from(staffAbsences)
      .where(
        and(
          eq(staffAbsences.businessId, input.businessId),
          inArray(staffAbsences.staffId, staffIds),
          lt(staffAbsences.startsAt, dayEnd),
          gt(staffAbsences.endsAt, dayStart),
        ),
      ),
    db
      .select({
        staffId: appointments.staffId,
        serviceId: appointments.serviceId,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, input.businessId),
          inArray(appointments.staffId, staffIds),
          inArray(appointments.status, ["BOOKED", "CONFIRMED", "ARRIVED"]),
          lt(appointments.startsAt, dayEnd),
          gt(appointments.endsAt, dayStart),
        ),
      ),
    db
      .select({
        staffId: appointmentRescheduleRequests.proposedStaffId,
        startsAt: appointmentRescheduleRequests.proposedStartsAt,
        endsAt: appointmentRescheduleRequests.proposedEndsAt,
      })
      .from(appointmentRescheduleRequests)
      .where(
        and(
          eq(appointmentRescheduleRequests.businessId, input.businessId),
          inArray(appointmentRescheduleRequests.proposedStaffId, staffIds),
          eq(appointmentRescheduleRequests.status, "PENDING"),
          gt(appointmentRescheduleRequests.expiresAt, new Date()),
          lt(appointmentRescheduleRequests.proposedStartsAt, dayEnd),
          gt(appointmentRescheduleRequests.proposedEndsAt, dayStart),
        ),
      ),
    db.select({ id: serviceOccurrences.id, staffId: serviceOccurrences.staffId, startsAt: serviceOccurrences.startsAt, endsAt: serviceOccurrences.endsAt, capacity: serviceOccurrences.capacity }).from(serviceOccurrences).where(and(eq(serviceOccurrences.businessId, input.businessId), eq(serviceOccurrences.serviceId, input.serviceId), eq(serviceOccurrences.active, true), gte(serviceOccurrences.startsAt, dayStart), lt(serviceOccurrences.startsAt, dayEnd))),
  ]);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: input.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const toMinutes = (instant: Date) => {
    const [h, m] = formatter.format(instant).split(":").map(Number);
    return h * 60 + m;
  };
  const now = new Date();
  // I servizi a capienza (corsi/eventi) sono prenotabili soltanto nelle
  // sessioni pubblicate dal titolare o dallo staff, non a ogni ora libera.
  if (occurrences.length || (input.capacity ?? 1) > 1) {
    return occurrences.filter(occurrence => occurrence.startsAt > now && !absences.some(item => item.staffId === occurrence.staffId && item.startsAt < occurrence.endsAt && item.endsAt > occurrence.startsAt) && !holds.some(item => item.staffId === occurrence.staffId && item.startsAt < occurrence.endsAt && item.endsAt > occurrence.startsAt)).map(occurrence => {
      const groupBookings = bookings.filter(item => item.staffId === occurrence.staffId && item.serviceId === input.serviceId && item.startsAt.getTime() === occurrence.startsAt.getTime());
      const conflicting = bookings.some(item => item.staffId === occurrence.staffId && !(item.serviceId === input.serviceId && item.startsAt.getTime() === occurrence.startsAt.getTime()) && item.startsAt < occurrence.endsAt && item.endsAt > occurrence.startsAt);
      const localStart = `${input.date}T${formatter.format(occurrence.startsAt)}`;
      return { staffId: occurrence.staffId, staffName: eligible.find(item => item.id === occurrence.staffId)?.name ?? "Operatore", localStart, label: formatter.format(occurrence.startsAt), availableSeats: conflicting ? 0 : Math.max(0, occurrence.capacity - groupBookings.length) };
    }).filter(slot => slot.availableSeats > 0).sort((a,b) => a.localStart.localeCompare(b.localStart) || a.staffName.localeCompare(b.staffName));
  }

  return eligible
    .flatMap((person) => {
      const base = hours
        .filter((item) => item.staffId === person.id)
        .map((item) => ({ start: item.startMinutes, end: item.endMinutes }));
      const capacity = Math.max(1, input.capacity ?? 1);
      const personBookings = bookings
        .filter((item) => item.staffId === person.id)
        .map((item) => ({
          start: toMinutes(item.startsAt),
          end: toMinutes(item.endsAt),
        }));
      const blocked = [
        ...absences
          .filter((item) => item.staffId === person.id)
          .map((item) => ({
            start: toMinutes(item.startsAt),
            end: toMinutes(item.endsAt),
          })),
        ...(capacity === 1 ? personBookings : []),
        ...holds
          .filter((item) => item.staffId === person.id)
          .map((item) => ({
            start: toMinutes(item.startsAt),
            end: toMinutes(item.endsAt),
          })),
      ];
      return generateStartTimes(
        subtractIntervals(base, blocked),
        input.durationMinutes,
      )
        .filter(
          (minutes) =>
            capacity === 1 ||
            personBookings.filter(
              (booking) =>
                booking.start < minutes + input.durationMinutes &&
                booking.end > minutes,
            ).length < capacity,
        )
        .map((minutes) => {
          const time = formatMinutes(minutes);
          const localStart = `${input.date}T${time}`;
          return {
            staffId: person.id,
            staffName: person.name,
            localStart,
            label: time,
            instant: zonedLocalToUtc(localStart, input.timezone),
            availableSeats: Math.max(0, capacity - personBookings.filter(booking => booking.start < minutes + input.durationMinutes && booking.end > minutes).length),
          };
        })
        .filter((slot) => slot.instant > now)
        .map((slot) => ({
          staffId: slot.staffId,
          staffName: slot.staffName,
          localStart: slot.localStart,
          label: slot.label,
          availableSeats: slot.availableSeats,
        }));
    })
    .sort(
      (a, b) =>
        a.localStart.localeCompare(b.localStart) ||
        a.staffName.localeCompare(b.staffName),
    );
}
