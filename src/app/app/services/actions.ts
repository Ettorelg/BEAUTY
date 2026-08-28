"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { serviceCategories, services } from "@/db/schema";
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

export async function createCategory(formData: FormData) {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") throw new Error("Operazione riservata al titolare.");
  const input = categorySchema.parse({ name: formData.get("name") });
  await db.insert(serviceCategories).values({ businessId: context.businessId, name: input.name });
  revalidatePath("/app/services");
}

export async function createService(formData: FormData) {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") throw new Error("Operazione riservata al titolare.");
  const input = serviceSchema.parse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
    onlineBookable: formData.get("onlineBookable") === "on",
  });
  const [category] = await db.select({ id: serviceCategories.id }).from(serviceCategories)
    .where(and(eq(serviceCategories.id, input.categoryId), eq(serviceCategories.businessId, context.businessId))).limit(1);
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
  revalidatePath("/app/services");
}

export async function toggleService(formData: FormData) {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") throw new Error("Operazione riservata al titolare.");
  const id = z.string().uuid().parse(formData.get("id"));
  const active = formData.get("active") === "true";
  await db.update(services).set({ active: !active, updatedAt: new Date() })
    .where(and(eq(services.id, id), eq(services.businessId, context.businessId)));
  revalidatePath("/app/services");
}
