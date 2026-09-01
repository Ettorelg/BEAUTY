"use server";

import { and, eq, gt, isNull, lt, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { appointmentEvents, appointmentRescheduleRequests, appointments, customerRelations, fidelityCards, fidelityRedemptions, staffAbsences, staffMembers, staffServices, workingHours } from "@/db/schema";
import { auth } from "@/lib/auth";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";
import { createRescheduleRequest } from "@/lib/reschedule-requests";
import { ensureRescheduleSchema } from "@/lib/ensure-reschedule-schema";

export async function cancelCustomerAppointment(formData: FormData) {
  await ensureRescheduleSchema();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/account/login");
  const id = z.string().uuid().parse(formData.get("id"));

  await db.transaction(async (tx) => {
    const [booking] = await tx
      .select({
        id: appointments.id,
        businessId: appointments.businessId,
        status: appointments.status,
        startsAt: appointments.startsAt,
        customerId: appointments.customerRelationId,
        version: appointments.version,
      })
      .from(appointments)
      .innerJoin(customerRelations, eq(customerRelations.id, appointments.customerRelationId))
      .where(and(eq(appointments.id, id), eq(customerRelations.userId, session.user.id)))
      .limit(1);

    if (!booking || !["BOOKED", "CONFIRMED"].includes(booking.status) || booking.startsAt.getTime() - Date.now() < 60 * 60 * 1000) {
      throw new Error("Questo appuntamento non può più essere annullato online.");
    }

    const updated = await tx
      .update(appointments)
      .set({ status: "CANCELLED", version: sql`${appointments.version} + 1`, updatedAt: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.status, booking.status), eq(appointments.version, booking.version)))
      .returning({ id: appointments.id });
    if (!updated.length) throw new Error("L’appuntamento è già stato modificato. Aggiorna la pagina e riprova.");

    const [redemption] = await tx
      .select()
      .from(fidelityRedemptions)
      .where(and(eq(fidelityRedemptions.appointmentId, id), isNull(fidelityRedemptions.reversedAt)))
      .limit(1);
    if (redemption) {
      await tx
        .update(fidelityCards)
        .set({ points: sql`${fidelityCards.points} + ${redemption.pointsSpent}`, updatedAt: new Date() })
        .where(and(eq(fidelityCards.businessId, booking.businessId), eq(fidelityCards.customerRelationId, booking.customerId)));
      await tx.update(fidelityRedemptions).set({ reversedAt: new Date() }).where(eq(fidelityRedemptions.id, redemption.id));
    }

    await tx.update(appointmentRescheduleRequests).set({ status: "CANCELLED", respondedAt: new Date() }).where(and(eq(appointmentRescheduleRequests.appointmentId, id), eq(appointmentRescheduleRequests.status, "PENDING")));
    await tx.insert(appointmentEvents).values({
      appointmentId: id,
      businessId: booking.businessId,
      type: "STATUS_CHANGED",
      fromStatus: booking.status,
      toStatus: "CANCELLED",
      actorId: session.user.id,
      note: "Cancellato dal cliente",
    });
  });

  revalidatePath("/account");
}

export async function rescheduleCustomerAppointment(formData: FormData) {
  await ensureRescheduleSchema();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/account/login");
  const input = z.object({ id: z.string().uuid(), staffId: z.string().uuid(), startsAt: z.string().min(16) }).parse(Object.fromEntries(formData));
  await db.transaction(async (tx) => {
    const [booking] = await tx.select({ id: appointments.id, businessId: appointments.businessId, serviceId: appointments.serviceId, duration: appointments.durationMinutes, timezone: appointments.timezone, status: appointments.status, startsAt: appointments.startsAt, version: appointments.version }).from(appointments).innerJoin(customerRelations, eq(customerRelations.id, appointments.customerRelationId)).where(and(eq(appointments.id, input.id), eq(customerRelations.userId, session.user.id))).limit(1);
    if (!booking || !["BOOKED", "CONFIRMED"].includes(booking.status) || booking.startsAt.getTime() - Date.now() < 60 * 60 * 1000) throw new Error("Questa prenotazione non può più essere modificata online.");
    const [enabled] = await tx.select({ id: staffMembers.id }).from(staffServices).innerJoin(staffMembers, and(eq(staffMembers.id, staffServices.staffId), eq(staffMembers.active, true), eq(staffMembers.businessId, booking.businessId))).where(and(eq(staffServices.businessId, booking.businessId), eq(staffServices.staffId, input.staffId), eq(staffServices.serviceId, booking.serviceId))).limit(1);
    if (!enabled) throw new Error("Operatore non disponibile per questo servizio.");
    const startsAt = zonedLocalToUtc(input.startsAt, booking.timezone); const endsAt = new Date(startsAt.getTime() + booking.duration * 60000);
    if (startsAt <= new Date()) throw new Error("Scegli un orario futuro.");
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.staffId}))`);
    const localTime = input.startsAt.slice(11, 16).split(":").map(Number);
    const startMinutes = localTime[0] * 60 + localTime[1];
    const endMinutes = startMinutes + booking.duration;
    const weekday = new Date(`${input.startsAt.slice(0, 10)}T12:00:00Z`).getUTCDay();
    const [working] = await tx.select({ id: workingHours.id }).from(workingHours).where(and(
      eq(workingHours.businessId, booking.businessId), eq(workingHours.staffId, input.staffId), eq(workingHours.weekday, weekday),
      sql`${workingHours.startMinutes} <= ${startMinutes}`, sql`${workingHours.endMinutes} >= ${endMinutes}`,
    )).limit(1);
    if (!working) throw new Error("L’orario scelto non rientra nel turno dell’operatore.");
    const [absence] = await tx.select({ id: staffAbsences.id }).from(staffAbsences).where(and(
      eq(staffAbsences.businessId, booking.businessId), eq(staffAbsences.staffId, input.staffId), lt(staffAbsences.startsAt, endsAt), gt(staffAbsences.endsAt, startsAt),
    )).limit(1);
    if (absence) throw new Error("L’operatore non è disponibile nell’orario scelto.");
    const [conflict] = await tx.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.businessId, booking.businessId), eq(appointments.staffId, input.staffId), ne(appointments.id, booking.id), lt(appointments.startsAt, endsAt), gt(appointments.endsAt, startsAt), sql`"status" in ('BOOKED','CONFIRMED','ARRIVED')`)).limit(1);
    if (conflict) throw new Error("Lo slot è stato appena occupato. Scegline un altro.");
    return { businessId: booking.businessId, staffId: input.staffId, startsAt, endsAt, version: booking.version };
  }).then(proposal => createRescheduleRequest({ appointmentId: input.id, businessId: proposal.businessId, staffId: proposal.staffId, startsAt: proposal.startsAt, endsAt: proposal.endsAt, version: proposal.version, proposerType: "CUSTOMER", proposedBy: session.user.id }));
  revalidatePath("/account"); revalidatePath("/app/agenda"); redirect("/account");
}