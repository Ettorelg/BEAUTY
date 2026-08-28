import { and, eq, inArray, lt, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { appointments, staffAbsences, staffMembers, staffServices, workingHours } from "@/db/schema";
import { formatMinutes, generateStartTimes, subtractIntervals } from "../domain/time-slots";
import { zonedLocalToUtc } from "../domain/timezone";

export type PublicSlot = { staffId: string; staffName: string; localStart: string; label: string };

export async function getPublicAvailability(input: {
  businessId: string; serviceId: string; date: string; durationMinutes: number; timezone: string;
}): Promise<PublicSlot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return [];
  const dayStart = zonedLocalToUtc(`${input.date}T00:00`, input.timezone);
  const dayEnd = new Date(dayStart.getTime() + 26 * 60 * 60_000);
  const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay();

  const eligible = await db.select({ id: staffMembers.id, name: staffMembers.name })
    .from(staffServices)
    .innerJoin(staffMembers, and(eq(staffServices.staffId, staffMembers.id), eq(staffMembers.businessId, input.businessId), eq(staffMembers.active, true)))
    .where(and(eq(staffServices.businessId, input.businessId), eq(staffServices.serviceId, input.serviceId)));
  if (!eligible.length) return [];
  const staffIds = eligible.map((item) => item.id);
  const [hours, absences, bookings] = await Promise.all([
    db.select().from(workingHours).where(and(eq(workingHours.businessId, input.businessId), inArray(workingHours.staffId, staffIds), eq(workingHours.weekday, weekday))),
    db.select().from(staffAbsences).where(and(eq(staffAbsences.businessId, input.businessId), inArray(staffAbsences.staffId, staffIds), lt(staffAbsences.startsAt, dayEnd), gt(staffAbsences.endsAt, dayStart))),
    db.select({ staffId: appointments.staffId, startsAt: appointments.startsAt, endsAt: appointments.endsAt }).from(appointments)
      .where(and(eq(appointments.businessId, input.businessId), inArray(appointments.staffId, staffIds), inArray(appointments.status, ["BOOKED", "CONFIRMED", "ARRIVED"]), lt(appointments.startsAt, dayEnd), gt(appointments.endsAt, dayStart))),
  ]);
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: input.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const toMinutes = (instant: Date) => { const [h, m] = formatter.format(instant).split(":").map(Number); return h * 60 + m; };
  const now = new Date();

  return eligible.flatMap((person) => {
    const base = hours.filter((item) => item.staffId === person.id).map((item) => ({ start: item.startMinutes, end: item.endMinutes }));
    const blocked = [...absences.filter((item) => item.staffId === person.id).map((item) => ({ start: toMinutes(item.startsAt), end: toMinutes(item.endsAt) })),
      ...bookings.filter((item) => item.staffId === person.id).map((item) => ({ start: toMinutes(item.startsAt), end: toMinutes(item.endsAt) }))];
    return generateStartTimes(subtractIntervals(base, blocked), input.durationMinutes).map((minutes) => {
      const time = formatMinutes(minutes);
      const localStart = `${input.date}T${time}`;
      return { staffId: person.id, staffName: person.name, localStart, label: time, instant: zonedLocalToUtc(localStart, input.timezone) };
    }).filter((slot) => slot.instant > now).map((slot) => ({ staffId: slot.staffId, staffName: slot.staffName, localStart: slot.localStart, label: slot.label }));
  }).sort((a, b) => a.localStart.localeCompare(b.localStart) || a.staffName.localeCompare(b.staffName));
}
