"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import {
  appointmentEvents,
  appointments,
  businesses,
  locations,
  serviceWaitlist,
  services,
} from "@/db/schema";
import { ensureServicePricingSchema } from "@/lib/ensure-service-pricing-schema";
import { sendBookingConfirmation } from "@/lib/staff-invitations";
import { hashWaitlistToken, offerNextWaitlist } from "@/lib/waitlist";

export async function confirmWaitlistOffer(formData: FormData) {
  const token = z.string().min(20).parse(formData.get("token"));
  await ensureServicePricingSchema();
  const tokenHash = hashWaitlistToken(token);
  const now = new Date();
  const [candidate] = await db
    .select({
      id: serviceWaitlist.id,
      businessId: serviceWaitlist.businessId,
      serviceId: serviceWaitlist.serviceId,
      staffId: serviceWaitlist.staffId,
      customerRelationId: serviceWaitlist.customerRelationId,
      email: serviceWaitlist.email,
      startsAt: serviceWaitlist.startsAt,
      expiresAt: serviceWaitlist.offerExpiresAt,
    })
    .from(serviceWaitlist)
    .where(eq(serviceWaitlist.offerTokenHash, tokenHash))
    .limit(1);

  if (!candidate || !candidate.customerRelationId) redirect(`/waitlist-confirm/${token}?error=invalid`);
  if (!candidate.expiresAt || candidate.expiresAt <= now) {
    await db.update(serviceWaitlist).set({ status: "EXPIRED", updatedAt: now }).where(and(eq(serviceWaitlist.id, candidate.id), eq(serviceWaitlist.status, "OFFERED")));
    await offerNextWaitlist(candidate);
    redirect(`/waitlist-confirm/${token}?error=expired`);
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${candidate.staffId}:${candidate.startsAt.toISOString()}`}))`);
    const [row] = await tx
      .select({
        id: serviceWaitlist.id,
        status: serviceWaitlist.status,
        startsAt: serviceWaitlist.startsAt,
        customerRelationId: serviceWaitlist.customerRelationId,
        customerEmail: serviceWaitlist.email,
        businessId: businesses.id,
        businessName: businesses.name,
        timezone: businesses.timezone,
        address: businesses.address,
        phone: businesses.phone,
        serviceId: services.id,
        serviceName: services.name,
        duration: services.durationMinutes,
        price: services.price,
        capacity: services.capacity,
        staffId: serviceWaitlist.staffId,
      })
      .from(serviceWaitlist)
      .innerJoin(services, eq(services.id, serviceWaitlist.serviceId))
      .innerJoin(businesses, eq(businesses.id, serviceWaitlist.businessId))
      .where(and(eq(serviceWaitlist.offerTokenHash, tokenHash), eq(serviceWaitlist.status, "OFFERED"), gt(serviceWaitlist.offerExpiresAt, now)))
      .limit(1);
    if (!row || !row.customerRelationId) throw new Error("Offerta non più disponibile.");
    const [occupied] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(eq(appointments.businessId, row.businessId), eq(appointments.serviceId, row.serviceId), eq(appointments.staffId, row.staffId), eq(appointments.startsAt, row.startsAt), sql`${appointments.status} in ('BOOKED','CONFIRMED','ARRIVED')`));
    if ((occupied?.total ?? 0) >= row.capacity) throw new Error("Il posto è già stato occupato.");
    const [location] = await tx.select({ id: locations.id }).from(locations).where(eq(locations.businessId, row.businessId)).limit(1);
    if (!location) throw new Error("Sede non configurata.");
    const [appointment] = await tx.insert(appointments).values({
      businessId: row.businessId,
      locationId: location.id,
      customerRelationId: row.customerRelationId,
      staffId: row.staffId,
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      durationMinutes: row.duration,
      price: String(row.price),
      startsAt: row.startsAt,
      endsAt: new Date(row.startsAt.getTime() + row.duration * 60_000),
      timezone: row.timezone,
      source: "WAITLIST",
      idempotencyKey: `waitlist-${row.id}`,
    }).returning({ id: appointments.id });
    await tx.update(serviceWaitlist).set({ status: "CONFIRMED", confirmedAt: now, updatedAt: now }).where(eq(serviceWaitlist.id, row.id));
    await tx.insert(appointmentEvents).values({ appointmentId: appointment.id, businessId: row.businessId, type: "WAITLIST_CONFIRMED", note: "Prenotazione confermata dalla lista d’attesa" });
    return row;
  }).catch(() => null);

  if (!result) redirect(`/waitlist-confirm/${token}?error=unavailable`);
  try {
    await sendBookingConfirmation({ email: result.customerEmail, businessName: result.businessName, serviceName: result.serviceName, startsAt: result.startsAt, timezone: result.timezone, address: result.address, phone: result.phone });
  } catch {}
  redirect(`/waitlist-confirm/${token}?confirmed=1`);
}
