"use server";

import { and, eq, gte, inArray, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { appointments, customerRelations, fidelityCards, fidelityRedemptions, fidelityRules } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensureFidelitySchema } from "@/lib/ensure-fidelity-schema";

export async function mergeDuplicateCustomers(formData: FormData) {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") throw new Error("Operazione riservata al titolare.");
  const customerId = z.string().uuid().parse(formData.get("customerId"));
  await ensureFidelitySchema();

  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(customerRelations).where(and(
      eq(customerRelations.id, customerId),
      eq(customerRelations.businessId, context.businessId),
    )).limit(1);
    if (!target) throw new Error("Cliente non trovato.");

    const normalizedPhone = target.phone?.replace(/\D/g, "");
    const identity = or(
      target.email ? eq(sql`lower(${customerRelations.email})`, target.email.toLowerCase()) : undefined,
      normalizedPhone ? eq(sql`regexp_replace(coalesce(${customerRelations.phone}, ''), '\\D', '', 'g')`, normalizedPhone) : undefined,
    );
    if (!identity) throw new Error("Il cliente non ha email o telefono utilizzabili per trovare duplicati.");

    const duplicates = await tx.select().from(customerRelations).where(and(
      eq(customerRelations.businessId, context.businessId),
      ne(customerRelations.id, customerId),
      identity,
    ));
    if (!duplicates.length) return;
    const duplicateIds = duplicates.map((row) => row.id);

    await tx.update(appointments).set({ customerRelationId: customerId, updatedAt: new Date() })
      .where(and(eq(appointments.businessId, context.businessId), inArray(appointments.customerRelationId, duplicateIds)));
    await tx.update(fidelityRedemptions).set({ customerRelationId: customerId })
      .where(and(eq(fidelityRedemptions.businessId, context.businessId), inArray(fidelityRedemptions.customerRelationId, duplicateIds)));

    const cards = await tx.select().from(fidelityCards).where(and(
      eq(fidelityCards.businessId, context.businessId),
      inArray(fidelityCards.customerRelationId, [customerId, ...duplicateIds]),
    ));
    const points = cards.reduce((sum, card) => sum + card.points, 0);
    const existingTargetCard = cards.find((card) => card.customerRelationId === customerId);
    await tx.delete(fidelityCards).where(and(
      eq(fidelityCards.businessId, context.businessId),
      inArray(fidelityCards.customerRelationId, duplicateIds),
    ));
    if (existingTargetCard) {
      await tx.update(fidelityCards).set({ points, updatedAt: new Date() }).where(eq(fidelityCards.id, existingTargetCard.id));
    } else if (cards.length) {
      await tx.insert(fidelityCards).values({
        businessId: context.businessId,
        customerRelationId: customerId,
        cardNumber: `AB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        points,
      });
    }

    const linked = duplicates.find((row) => row.userId);
    await tx.update(customerRelations).set({
      userId: target.userId ?? linked?.userId ?? null,
      email: target.email ?? duplicates.find((row) => row.email)?.email ?? null,
      phone: target.phone ?? duplicates.find((row) => row.phone)?.phone ?? null,
      updatedAt: new Date(),
    }).where(eq(customerRelations.id, customerId));
    await tx.delete(customerRelations).where(inArray(customerRelations.id, duplicateIds));
  });

  revalidatePath(`/app/customers/${customerId}`);
  revalidatePath("/app/customers");
}

export async function redeemFidelityReward(formData: FormData) {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") throw new Error("Operazione riservata al titolare.");
  const input = z.object({ customerId: z.string().uuid(), ruleId: z.string().uuid() }).parse(Object.fromEntries(formData));
  await ensureFidelitySchema();

  await db.transaction(async (tx) => {
    const [rule] = await tx.select().from(fidelityRules).where(and(
      eq(fidelityRules.id, input.ruleId),
      eq(fidelityRules.businessId, context.businessId),
    )).limit(1);
    if (!rule) throw new Error("Regola Fidelity non valida.");
    const [card] = await tx.update(fidelityCards)
      .set({ points: sql`${fidelityCards.points} - ${rule.points}`, updatedAt: new Date() })
      .where(and(
        eq(fidelityCards.businessId, context.businessId),
        eq(fidelityCards.customerRelationId, input.customerId),
        gte(fidelityCards.points, rule.points),
      ))
      .returning({ id: fidelityCards.id });
    if (!card) throw new Error("Punti insufficienti per riscattare questo premio.");
    await tx.insert(fidelityRedemptions).values({
      businessId: context.businessId,
      customerRelationId: input.customerId,
      ruleId: rule.id,
      pointsSpent: rule.points,
      rewardType: rule.type,
      rewardValue: rule.value,
      serviceId: rule.serviceId,
    });
  });

  revalidatePath(`/app/customers/${input.customerId}`);
  revalidatePath("/app/fidelity");
}
