"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { services, staffAbsences, staffMembers, staffServices, workingHours } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { parseTimeToMinutes } from "@/modules/availability/domain/time-slots";

function ownerOnly(role: string) { if (role !== "OWNER") throw new Error("Operazione riservata al titolare."); }

export async function createStaffMember(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = z.object({ name: z.string().trim().min(2).max(100), title: z.string().trim().max(80).optional() })
    .parse({ name: formData.get("name"), title: formData.get("title") || undefined });
  await db.insert(staffMembers).values({ businessId: context.businessId, locationId: context.locationId, ...input });
  revalidatePath("/app/staff");
}

export async function assignService(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = z.object({ staffId: z.string().uuid(), serviceId: z.string().uuid() })
    .parse({ staffId: formData.get("staffId"), serviceId: formData.get("serviceId") });
  const [staff] = await db.select({ id: staffMembers.id }).from(staffMembers).where(and(eq(staffMembers.id, input.staffId), eq(staffMembers.businessId, context.businessId))).limit(1);
  const [service] = await db.select({ id: services.id }).from(services).where(and(eq(services.id, input.serviceId), eq(services.businessId, context.businessId))).limit(1);
  if (!staff || !service) throw new Error("Operatore o servizio non valido.");
  await db.insert(staffServices).values({ ...input, businessId: context.businessId }).onConflictDoNothing();
  revalidatePath("/app/staff");
}

export async function addWorkingHours(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = z.object({ staffId: z.string().uuid(), weekday: z.coerce.number().int().min(0).max(6), start: z.string(), end: z.string() })
    .parse({ staffId: formData.get("staffId"), weekday: formData.get("weekday"), start: formData.get("start"), end: formData.get("end") });
  const [staff] = await db.select({ id: staffMembers.id }).from(staffMembers).where(and(eq(staffMembers.id, input.staffId), eq(staffMembers.businessId, context.businessId))).limit(1);
  if (!staff) throw new Error("Operatore non valido.");
  const startMinutes = parseTimeToMinutes(input.start); const endMinutes = parseTimeToMinutes(input.end);
  if (endMinutes <= startMinutes) throw new Error("La fine del turno deve essere successiva all’inizio.");
  await db.insert(workingHours).values({ businessId: context.businessId, staffId: input.staffId, weekday: input.weekday, startMinutes, endMinutes });
  revalidatePath("/app/staff");
}

export async function addAbsence(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = z.object({ staffId: z.string().uuid(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), reason: z.string().trim().max(120).optional() })
    .parse({ staffId: formData.get("staffId"), startsAt: formData.get("startsAt"), endsAt: formData.get("endsAt"), reason: formData.get("reason") || undefined });
  if (input.endsAt <= input.startsAt) throw new Error("La fine dell’assenza deve essere successiva all’inizio.");
  const [staff] = await db.select({ id: staffMembers.id }).from(staffMembers).where(and(eq(staffMembers.id, input.staffId), eq(staffMembers.businessId, context.businessId))).limit(1);
  if (!staff) throw new Error("Operatore non valido.");
  await db.insert(staffAbsences).values({ businessId: context.businessId, staffId: input.staffId, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason });
  revalidatePath("/app/staff");
}
