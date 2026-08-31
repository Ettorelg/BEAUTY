"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { appointmentEvents, appointments, fidelityCards, fidelitySettings } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensureFidelitySchema } from "@/lib/ensure-fidelity-schema";
import { calculateEarnedPoints } from "@/modules/fidelity/domain/rewards";

const priceInput = z.string().trim().regex(/^\d{1,7}(?:[.,]\d{1,2})?$/, "Inserisci un prezzo valido.");

export async function updateAppointmentPrice(formData: FormData): Promise<{ ok: boolean; price?: string; error?: string }> {
  try {
    const context = await requireBusinessContext();
    if (context.role !== "OWNER") throw new Error("Solo il titolare può modificare il prezzo.");
    const id = z.string().uuid().parse(formData.get("id"));
    const parsedPrice = Number(priceInput.parse(formData.get("price")).replace(",", "."));
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) throw new Error("Inserisci un prezzo valido.");
    const price = parsedPrice.toFixed(2);

    await ensureFidelitySchema();
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          price: appointments.price,
          status: appointments.status,
          customerId: appointments.customerRelationId,
          version: appointments.version,
        })
        .from(appointments)
        .where(and(eq(appointments.id, id), eq(appointments.businessId, context.businessId)))
        .limit(1);
      if (!current) throw new Error("Appuntamento non disponibile.");

      const updated = await tx
        .update(appointments)
        .set({ price, version: sql`${appointments.version} + 1`, updatedAt: new Date() })
        .where(and(eq(appointments.id, id), eq(appointments.businessId, context.businessId), eq(appointments.version, current.version)))
        .returning({ id: appointments.id });
      if (!updated.length) throw new Error("L’appuntamento è stato modificato. Aggiorna l’agenda e riprova.");

      if (current.status === "COMPLETED") {
        const [settings] = await tx.select().from(fidelitySettings).where(eq(fidelitySettings.businessId, context.businessId)).limit(1);
        if (settings) {
          const previousPoints = calculateEarnedPoints(Number(current.price), settings.spendCents, settings.pointsAward);
          const nextPoints = calculateEarnedPoints(parsedPrice, settings.spendCents, settings.pointsAward);
          const difference = nextPoints - previousPoints;
          if (difference) {
            await tx
              .update(fidelityCards)
              .set({ points: sql`greatest(0, ${fidelityCards.points} + ${difference})`, updatedAt: new Date() })
              .where(and(eq(fidelityCards.businessId, context.businessId), eq(fidelityCards.customerRelationId, current.customerId)));
          }
        }
      }

      await tx.insert(appointmentEvents).values({
        appointmentId: id,
        businessId: context.businessId,
        type: "PRICE_CHANGED",
        actorId: context.user.id,
        note: `${Number(current.price).toFixed(2)} → ${price}`,
      });
    });

    revalidatePath("/app/agenda");
    revalidatePath("/app/statistics");
    revalidatePath("/app/customers");
    return { ok: true, price };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Impossibile modificare il prezzo." };
  }
}
