"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { appointmentEvents, appointments, customerRelations, fidelityCards, fidelityRedemptions } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function cancelCustomerAppointment(formData: FormData) {
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

    if (!booking || !["BOOKED", "CONFIRMED"].includes(booking.status) || booking.startsAt <= new Date()) {
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
