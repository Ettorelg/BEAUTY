"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { appointments, serviceCategories, services, staffServices } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";

const categorySchema = z.object({ name: z.string().trim().min(2).max(60) });
const serviceSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(180).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().min(0).max(100000),
  onlineBookable: z.coerce.boolean(),
});

function ownerOnly(role: string) {
  if (role !== "OWNER") throw new Error("Operazione riservata al titolare.");
}

function refreshServicePages() {
  revalidatePath("/app/services");
  revalidatePath("/app/staff");
  revalidatePath("/s/[slug]", "page");
}

export async function createCategory(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = categorySchema.parse({ name: formData.get("name") });
  await db.insert(serviceCategories).values({ businessId: context.businessId, name: input.name });
  revalidatePath("/app/services");
}

export async function createService(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = serviceSchema.parse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
    onlineBookable: formData.get("onlineBookable") === "on",
  });
  const [category] = await db.select({ id: serviceCategories.id }).from(serviceCategories)
    .where(and(eq(serviceCategories.id, input.categoryId), eq(serviceCategories.businessId, context.businessId), eq(serviceCategories.active, true))).limit(1);
  if (!category) throw new Error("Categoria non valida.");
  await db.insert(services).values({
    businessId: context.businessId,
    categoryId: input.categoryId,
    name: input.name,
    description: input.description,
    durationMinutes: input.durationMinutes,
    price: input.price.toFixed(2),
    onlineBookable: input.onlineBookable,
  });
  refreshServicePages();
}

export async function deleteService(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const id = z.string().uuid().parse(formData.get("id"));
  await db.transaction(async (tx) => {
    const [linkedAppointment] = await tx.select({ id: appointments.id }).from(appointments)
      .where(and(eq(appointments.serviceId, id), eq(appointments.businessId, context.businessId))).limit(1);
    await tx.delete(staffServices).where(and(eq(staffServices.serviceId, id), eq(staffServices.businessId, context.businessId)));
    if (linkedAppointment) {
      await tx.update(services).set({ active: false, onlineBookable: false, updatedAt: new Date() })
        .where(and(eq(services.id, id), eq(services.businessId, context.businessId)));
    } else {
      await tx.delete(services).where(and(eq(services.id, id), eq(services.businessId, context.businessId)));
    }
  });
  refreshServicePages();
}
