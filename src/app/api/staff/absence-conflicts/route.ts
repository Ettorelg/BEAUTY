import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { appointments, customerRelations, staffMembers } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { getPublicAvailability } from "@/modules/availability/application/public-availability";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";

function localDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireBusinessContext();
    const startsValue = request.nextUrl.searchParams.get("startsAt") ?? "";
    const endsValue = request.nextUrl.searchParams.get("endsAt") ?? "";
    const startsAt = zonedLocalToUtc(startsValue, context.timezone);
    const endsAt = zonedLocalToUtc(endsValue, context.timezone);
    if (endsAt <= startsAt) return NextResponse.json({ error: "La fine deve essere successiva all’inizio." }, { status: 400 });
    const requestedStaffId = request.nextUrl.searchParams.get("staffId");
    const [staff] = await db.select({ id: staffMembers.id }).from(staffMembers).where(and(
      eq(staffMembers.businessId, context.businessId),
      eq(staffMembers.active, true),
      context.role === "STAFF" ? eq(staffMembers.userId, context.user.id) : requestedStaffId ? eq(staffMembers.id, requestedStaffId) : undefined,
    )).limit(1);
    if (!staff) return NextResponse.json({ error: "Operatore non valido." }, { status: 400 });
    const rows = await db.select({
      id: appointments.id, customerName: customerRelations.name, customerEmail: customerRelations.email,
      serviceId: appointments.serviceId, serviceName: appointments.serviceName, duration: appointments.durationMinutes,
      startsAt: appointments.startsAt,
    }).from(appointments).leftJoin(customerRelations, eq(customerRelations.id, appointments.customerRelationId)).where(and(
      eq(appointments.businessId, context.businessId), eq(appointments.staffId, staff.id),
      inArray(appointments.status, ["BOOKED", "CONFIRMED", "ARRIVED"]), lt(appointments.startsAt, endsAt), gt(appointments.endsAt, startsAt),
    ));
    const suggestionCache = new Map<string, Array<{ label: string; staffName: string; date: string }>>();
    for (const row of rows) {
      const key = `${row.serviceId}:${row.duration}`;
      if (suggestionCache.has(key)) continue;
      const suggestions: Array<{ label: string; staffName: string; date: string }> = [];
      const firstDate = localDate(endsAt, context.timezone);
      for (let day = 0; day < 14 && suggestions.length < 3; day += 1) {
        const date = addDays(firstDate, day);
        const slots = await getPublicAvailability({ businessId: context.businessId, serviceId: row.serviceId, date, durationMinutes: row.duration, timezone: context.timezone });
        suggestions.push(...slots.filter(slot => zonedLocalToUtc(slot.localStart, context.timezone) >= endsAt).slice(0, 3 - suggestions.length).map(slot => ({ label: slot.label, staffName: slot.staffName, date })));
      }
      suggestionCache.set(key, suggestions);
    }
    const formatter = new Intl.DateTimeFormat("it-IT", { timeZone: context.timezone, dateStyle: "short", timeStyle: "short" });
    return NextResponse.json({ conflicts: rows.map(row => ({
      id: row.id, customerName: row.customerName ?? "Cliente", customerEmail: row.customerEmail,
      serviceName: row.serviceName, startsAtLabel: formatter.format(row.startsAt), agendaDate: localDate(row.startsAt, context.timezone),
      suggestions: suggestionCache.get(`${row.serviceId}:${row.duration}`) ?? [],
    })) });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Controllo non riuscito." }, { status: 400 });
  }
}
