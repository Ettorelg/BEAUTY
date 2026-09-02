"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { appointmentEvents, appointments } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensurePaymentSchema } from "@/lib/ensure-payment-schema";

export async function markOutstandingPaid(formData: FormData) {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") throw new Error("Operazione riservata al titolare.");
  const id = z.string().uuid().parse(formData.get("id"));
  await ensurePaymentSchema();
  await db.transaction(async (tx) => {
    const [updated] = await tx.update(appointments).set({
      paymentStatus: "PAID",
      paidAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(appointments.id, id),
      eq(appointments.businessId, context.businessId),
      eq(appointments.status, "COMPLETED"),
      eq(appointments.paymentStatus, "UNPAID"),
    )).returning({ id: appointments.id });
    if (!updated) throw new Error("Pagamento già saldato o non disponibile.");
    await tx.insert(appointmentEvents).values({
      appointmentId: id,
      businessId: context.businessId,
      type: "PAYMENT_SETTLED",
      actorId: context.user.id,
      note: "Pagamento sospeso segnato come saldato",
    });
  });
  revalidatePath("/app/sospesi");
  revalidatePath("/app/agenda");
  revalidatePath("/app/customers");
}
