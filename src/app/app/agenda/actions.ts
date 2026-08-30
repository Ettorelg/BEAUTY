"use server";

import { and, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import {
  appointmentEvents,
  appointments,
  customerRelations,
  fidelityCards,
  fidelitySettings,
  services,
  staffMembers,
  staffServices,
} from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensureFidelitySchema } from "@/lib/ensure-fidelity-schema";
import { isAppointmentStatus } from "@/modules/appointments/domain/status";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";

const finalStatuses = ["COMPLETED", "CANCELLED", "NO_SHOW"] as const;
const bookingSchema = z.object({
  staffId: z.string().uuid(),
  serviceId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(6).max(30).optional(),
  startsAt: z.string(),
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().uuid(),
}).refine((value) => value.email || value.phone, { message: "Inserisci email o telefono." });

function normalizePhone(value?: string) {
  return value?.replace(/\D/g, "") || undefined;
}

async function staffIdForCurrentUser(businessId: string, userId: string) {
  const [member] = await db.select({ id: staffMembers.id }).from(staffMembers)
    .where(and(eq(staffMembers.businessId, businessId), eq(staffMembers.userId, userId), eq(staffMembers.active, true))).limit(1);
  return member?.id;
}

export async function createAppointment(formData: FormData) {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") throw new Error("Solo il titolare può creare appuntamenti manuali.");
  const input = bookingSchema.parse({
    staffId: formData.get("staffId"), serviceId: formData.get("serviceId"), customerName: formData.get("customerName"),
    email: formData.get("email") || undefined, phone: formData.get("phone") || undefined,
    startsAt: formData.get("startsAt"), notes: formData.get("notes") || undefined, idempotencyKey: formData.get("idempotencyKey"),
  });
  const [selection] = await db.select({ serviceName: services.name, durationMinutes: services.durationMinutes, price: services.price })
    .from(staffServices).innerJoin(staffMembers, and(eq(staffServices.staffId, staffMembers.id), eq(staffMembers.businessId, context.businessId)))
    .innerJoin(services, and(eq(staffServices.serviceId, services.id), eq(services.businessId, context.businessId), eq(services.active, true)))
    .where(and(eq(staffServices.businessId, context.businessId), eq(staffServices.staffId, input.staffId), eq(staffServices.serviceId, input.serviceId))).limit(1);
  if (!selection) throw new Error("Operatore non abilitato per questo servizio.");
  const startsAt = zonedLocalToUtc(input.startsAt, context.timezone);
  const endsAt = new Date(startsAt.getTime() + selection.durationMinutes * 60_000);
  if (startsAt <= new Date()) throw new Error("L’appuntamento deve essere nel futuro.");
  const email = input.email?.toLowerCase();
  const phone = normalizePhone(input.phone);

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.staffId}))`);
    const [conflict] = await tx.select({ id: appointments.id }).from(appointments).where(and(
      eq(appointments.businessId, context.businessId), eq(appointments.staffId, input.staffId),
      lt(appointments.startsAt, endsAt), gt(appointments.endsAt, startsAt), sql`not ${appointments.status} in ('COMPLETED','CANCELLED','NO_SHOW')`,
    )).limit(1);
    if (conflict) throw new Error("Lo slot non è più disponibile.");
    const identity = or(
      email ? eq(sql`lower(${customerRelations.email})`, email) : undefined,
      phone ? eq(sql`regexp_replace(coalesce(${customerRelations.phone}, ''), '\\D', '', 'g')`, phone) : undefined,
    );
    const [known] = identity ? await tx.select({ id: customerRelations.id }).from(customerRelations)
      .where(and(eq(customerRelations.businessId, context.businessId), identity)).limit(1) : [];
    const customerId = known?.id ?? (await tx.insert(customerRelations).values({
      businessId: context.businessId, name: input.customerName, email, phone,
    }).returning({ id: customerRelations.id }))[0].id;
    if (known) await tx.update(customerRelations).set({ name: input.customerName, email, phone, updatedAt: new Date() }).where(eq(customerRelations.id, known.id));
    const [created] = await tx.insert(appointments).values({
      businessId: context.businessId, locationId: context.locationId, customerRelationId: customerId,
      staffId: input.staffId, serviceId: input.serviceId, serviceName: selection.serviceName,
      durationMinutes: selection.durationMinutes, price: selection.price, startsAt, endsAt,
      timezone: context.timezone, notes: input.notes, createdBy: context.user.id, idempotencyKey: input.idempotencyKey,
    }).onConflictDoNothing({ target: [appointments.businessId, appointments.idempotencyKey] }).returning({ id: appointments.id });
    if (created) await tx.insert(appointmentEvents).values({ appointmentId: created.id, businessId: context.businessId, type: "CREATED", toStatus: "BOOKED", actorId: context.user.id });
  });
  revalidatePath("/app/agenda");
}

export async function changeAppointmentStatus(formData: FormData) {
  const context = await requireBusinessContext();
  const id = z.string().uuid().parse(formData.get("id"));
  const next = z.string().parse(formData.get("status"));
  if (!isAppointmentStatus(next) || !inArrayValue(finalStatuses, next)) throw new Error("Stato non valido.");
  const ownStaffId = context.role === "STAFF" ? await staffIdForCurrentUser(context.businessId, context.user.id) : undefined;
  if (context.role === "STAFF" && !ownStaffId) throw new Error("Profilo operatore non collegato.");
  if (next === "COMPLETED") await ensureFidelitySchema();
  await db.transaction(async (tx) => {
    const [current] = await tx.select({ status: appointments.status, staffId: appointments.staffId, customerId: appointments.customerRelationId, price: appointments.price })
      .from(appointments).where(and(eq(appointments.id, id), eq(appointments.businessId, context.businessId))).limit(1);
    if (!current || (ownStaffId && current.staffId !== ownStaffId)) throw new Error("Appuntamento non disponibile.");
    await tx.update(appointments).set({ status: next, version: sql`${appointments.version} + 1`, updatedAt: new Date() }).where(eq(appointments.id, id));
    await tx.insert(appointmentEvents).values({ appointmentId: id, businessId: context.businessId, type: "STATUS_CHANGED", fromStatus: current.status, toStatus: next, actorId: context.user.id });
    if (next === "COMPLETED" && current.status !== "COMPLETED") {
      const [settings] = await tx.select().from(fidelitySettings).where(eq(fidelitySettings.businessId, context.businessId)).limit(1);
      if (settings) {
        const earned = Math.floor(Math.round(Number(current.price) * 100) / settings.spendCents) * settings.pointsAward;
        if (earned > 0) await tx.insert(fidelityCards).values({ businessId: context.businessId, customerRelationId: current.customerId, cardNumber: `AB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, points: earned })
          .onConflictDoUpdate({ target: [fidelityCards.businessId, fidelityCards.customerRelationId], set: { points: sql`${fidelityCards.points} + ${earned}`, updatedAt: new Date() } });
      }
    }
  });
  revalidatePath("/app/agenda"); revalidatePath("/app/customers"); revalidatePath("/app/fidelity");
}

function inArrayValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

export async function rescheduleAppointment(formData: FormData) {
  const context = await requireBusinessContext();
  const input = z.object({ id: z.string().uuid(), startsAt: z.string().min(16), staffId: z.string().uuid().optional() }).parse(Object.fromEntries(formData));
  const ownStaffId = context.role === "STAFF" ? await staffIdForCurrentUser(context.businessId, context.user.id) : undefined;
  if (context.role === "STAFF" && !ownStaffId) throw new Error("Profilo operatore non collegato.");
  await db.transaction(async (tx) => {
    const [current] = await tx.select({ staffId: appointments.staffId, serviceId: appointments.serviceId, durationMinutes: appointments.durationMinutes, status: appointments.status })
      .from(appointments).where(and(eq(appointments.id, input.id), eq(appointments.businessId, context.businessId))).limit(1);
    if (!current || (ownStaffId && current.staffId !== ownStaffId)) throw new Error("Appuntamento non spostabile.");
    if (context.role === "STAFF" && inArrayValue(finalStatuses, current.status)) throw new Error("Lo staff non può spostare un appuntamento concluso.");
    const targetStaffId = context.role === "OWNER" ? input.staffId ?? current.staffId : current.staffId;
    const [assignment] = await tx.select({ id: staffServices.staffId }).from(staffServices).innerJoin(staffMembers, and(eq(staffServices.staffId, staffMembers.id), eq(staffMembers.businessId, context.businessId), eq(staffMembers.active, true))).where(and(eq(staffServices.businessId, context.businessId), eq(staffServices.staffId, targetStaffId), eq(staffServices.serviceId, current.serviceId))).limit(1);
    if (!assignment) throw new Error("Operatore non abilitato per questo servizio.");
    const startsAt = zonedLocalToUtc(input.startsAt, context.timezone);
    const endsAt = new Date(startsAt.getTime() + current.durationMinutes * 60_000);
    if (startsAt <= new Date()) throw new Error("Scegli una data futura.");
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${targetStaffId}))`);
    const [conflict] = await tx.select({ id: appointments.id }).from(appointments).where(and(
      eq(appointments.businessId, context.businessId), eq(appointments.staffId, targetStaffId), ne(appointments.id, input.id),
      lt(appointments.startsAt, endsAt), gt(appointments.endsAt, startsAt), sql`not ${appointments.status} in ('COMPLETED','CANCELLED','NO_SHOW')`,
    )).limit(1);
    if (conflict) throw new Error("Fascia non disponibile.");
    await tx.update(appointments).set({ staffId: targetStaffId, startsAt, endsAt, version: sql`${appointments.version} + 1`, updatedAt: new Date() }).where(eq(appointments.id, input.id));
    await tx.insert(appointmentEvents).values({ appointmentId: input.id, businessId: context.businessId, type: "RESCHEDULED", actorId: context.user.id, note: `${input.startsAt} · operatore ${targetStaffId}` });
  });
  revalidatePath("/app/agenda");
}
