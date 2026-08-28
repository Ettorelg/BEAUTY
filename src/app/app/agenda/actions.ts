"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { appointmentEvents, appointments, customerRelations, services, staffMembers, staffServices } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { canTransitionAppointment, isAppointmentStatus } from "@/modules/appointments/domain/status";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";

const bookingSchema = z.object({
  staffId: z.string().uuid(), serviceId: z.string().uuid(), customerName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().optional(), phone: z.string().trim().min(6).max(30).optional(),
  startsAt: z.string(), notes: z.string().trim().max(500).optional(), idempotencyKey: z.string().uuid(),
}).refine((value) => value.email || value.phone, { message: "Inserisci email o telefono." });

export async function createAppointment(formData: FormData) {
  const context = await requireBusinessContext();
  const input = bookingSchema.parse({
    staffId: formData.get("staffId"), serviceId: formData.get("serviceId"), customerName: formData.get("customerName"),
    email: formData.get("email") || undefined, phone: formData.get("phone") || undefined, startsAt: formData.get("startsAt"),
    notes: formData.get("notes") || undefined, idempotencyKey: formData.get("idempotencyKey"),
  });

  const [selection] = await db.select({ serviceName: services.name, durationMinutes: services.durationMinutes, price: services.price })
    .from(staffServices)
    .innerJoin(staffMembers, and(eq(staffServices.staffId, staffMembers.id), eq(staffMembers.businessId, context.businessId)))
    .innerJoin(services, and(eq(staffServices.serviceId, services.id), eq(services.businessId, context.businessId), eq(services.active, true)))
    .where(and(eq(staffServices.businessId, context.businessId), eq(staffServices.staffId, input.staffId), eq(staffServices.serviceId, input.serviceId))).limit(1);
  if (!selection) throw new Error("Operatore non abilitato per questo servizio.");

  const startsAt = zonedLocalToUtc(input.startsAt, context.timezone);
  const endsAt = new Date(startsAt.getTime() + selection.durationMinutes * 60_000);
  if (startsAt <= new Date()) throw new Error("L’appuntamento deve essere nel futuro.");

  await db.transaction(async (tx) => {
    const normalizedEmail = input.email?.toLowerCase();
    const [existing] = normalizedEmail ? await tx.select({ id: customerRelations.id }).from(customerRelations)
      .where(and(eq(customerRelations.businessId, context.businessId), eq(customerRelations.email, normalizedEmail))).limit(1) : [];
    const customerId = existing?.id ?? (await tx.insert(customerRelations).values({
      businessId: context.businessId, name: input.customerName, email: normalizedEmail, phone: input.phone,
    }).returning({ id: customerRelations.id }))[0].id;

    const [appointment] = await tx.insert(appointments).values({
      businessId: context.businessId, locationId: context.locationId, customerRelationId: customerId,
      staffId: input.staffId, serviceId: input.serviceId, serviceName: selection.serviceName,
      durationMinutes: selection.durationMinutes, price: selection.price, startsAt, endsAt,
      timezone: context.timezone, notes: input.notes, createdBy: context.user.id, idempotencyKey: input.idempotencyKey,
    }).onConflictDoNothing({ target: [appointments.businessId, appointments.idempotencyKey] }).returning({ id: appointments.id });
    if (appointment) await tx.insert(appointmentEvents).values({ appointmentId: appointment.id, businessId: context.businessId, type: "CREATED", toStatus: "BOOKED", actorId: context.user.id });
  });
  revalidatePath("/app/agenda");
}

export async function changeAppointmentStatus(formData: FormData) {
  const context = await requireBusinessContext();
  const id = z.string().uuid().parse(formData.get("id"));
  const next = z.string().parse(formData.get("status"));
  if (!isAppointmentStatus(next)) throw new Error("Stato non valido.");
  await db.transaction(async (tx) => {
    const [current] = await tx.select({ status: appointments.status }).from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.businessId, context.businessId))).limit(1);
    if (!current || !isAppointmentStatus(current.status) || !canTransitionAppointment(current.status, next)) throw new Error("Transizione di stato non consentita.");
    await tx.update(appointments).set({ status: next, version: sql`${appointments.version} + 1`, updatedAt: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.businessId, context.businessId)));
    await tx.insert(appointmentEvents).values({ appointmentId: id, businessId: context.businessId, type: "STATUS_CHANGED", fromStatus: current.status, toStatus: next, actorId: context.user.id });
  });
  revalidatePath("/app/agenda");
}
