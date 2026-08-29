import { and, asc, eq, gte, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { appointments, customerRelations, services, staffMembers, staffServices } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";

function addDays(date: string, days: number) { const [year, month, day] = date.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10); }

export async function GET(request: NextRequest) {
  const context = await requireBusinessContext(); const isOwner = context.role === "OWNER";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: context.timezone }).format(new Date());
  const requestedDate = request.nextUrl.searchParams.get("date") ?? today; const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today;
  const view = request.nextUrl.searchParams.get("view") === "week" ? "week" : "day"; const startDate = view === "week" ? addDays(date, -(new Date(`${date}T12:00:00Z`).getUTCDay() || 7) + 1) : date; const endDate = addDays(startDate, view === "week" ? 7 : 1);
  const start = zonedLocalToUtc(`${startDate}T00:00`, context.timezone); const end = zonedLocalToUtc(`${endDate}T00:00`, context.timezone);
  const [ownStaff] = isOwner ? [undefined] : await db.select({ id: staffMembers.id, name: staffMembers.name }).from(staffMembers).where(and(eq(staffMembers.businessId, context.businessId), eq(staffMembers.userId, context.user.id), eq(staffMembers.active, true))).limit(1);
  if (!isOwner && !ownStaff) return NextResponse.json({ date, startDate, view, timezone: context.timezone, canManage: false, staff: [], catalog: [], entries: [] });
  const staffCondition = isOwner ? eq(staffMembers.businessId, context.businessId) : and(eq(staffMembers.businessId, context.businessId), eq(staffMembers.id, ownStaff!.id));
  const [staff, catalog, entries] = await Promise.all([
    db.select({ id: staffMembers.id, name: staffMembers.name }).from(staffMembers).where(and(staffCondition, eq(staffMembers.active, true))).orderBy(asc(staffMembers.name)),
    isOwner ? db.select({ staffId: staffServices.staffId, id: services.id, name: services.name, duration: services.durationMinutes }).from(staffServices).innerJoin(services, and(eq(staffServices.serviceId, services.id), eq(services.businessId, context.businessId), eq(services.active, true))).where(eq(staffServices.businessId, context.businessId)).orderBy(asc(services.name)) : Promise.resolve([]),
    db.select({ id: appointments.id, startsAt: appointments.startsAt, endsAt: appointments.endsAt, status: appointments.status, serviceName: appointments.serviceName, customerName: customerRelations.name, staffId: staffMembers.id, staffName: staffMembers.name, notes: appointments.notes }).from(appointments).innerJoin(customerRelations, and(eq(appointments.customerRelationId, customerRelations.id), eq(customerRelations.businessId, context.businessId))).innerJoin(staffMembers, and(eq(appointments.staffId, staffMembers.id), eq(staffMembers.businessId, context.businessId))).where(and(eq(appointments.businessId, context.businessId), isOwner ? undefined : eq(appointments.staffId, ownStaff!.id), gte(appointments.startsAt, start), lt(appointments.startsAt, end))).orderBy(asc(appointments.startsAt)),
  ]);
  return NextResponse.json({ date, startDate, view, timezone: context.timezone, canManage: isOwner, staff, catalog, entries });
}
