"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { appointments, businessMemberships, serviceCategories, services, staffAbsences, staffInvitations, staffMembers, staffServices, workingHours } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { issueStaffInvitation } from "@/lib/staff-invitations";
import { parseTimeToMinutes } from "@/modules/availability/domain/time-slots";

const weekdayValues = [1, 2, 3, 4, 5, 6, 0];

function ownerOnly(role: string) {
  if (role !== "OWNER") throw new Error("Operazione riservata al titolare.");
}

function refreshStaffPages() {
  revalidatePath("/app/staff");
  revalidatePath("/s/[slug]", "page");
}

export async function createStaffMember(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    title: z.string().trim().max(80).optional(),
    email: z.string().trim().email().optional(),
  }).parse({ name: formData.get("name"), title: formData.get("title") || undefined, email: formData.get("email") || undefined });
  const [created] = await db.insert(staffMembers).values({ businessId: context.businessId, locationId: context.locationId, name: input.name, title: input.title })
    .returning({ id: staffMembers.id });
  if (input.email) await issueStaffInvitation({ businessId: context.businessId, businessName: context.businessName, staffId: created.id, email: input.email, createdBy: context.user.id });
  refreshStaffPages();
}

export async function inviteStaffMember(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = z.object({ staffId: z.string().uuid(), email: z.string().trim().email() })
    .parse({ staffId: formData.get("staffId"), email: formData.get("email") });
  const [staff] = await db.select({ id: staffMembers.id, userId: staffMembers.userId }).from(staffMembers)
    .where(and(eq(staffMembers.id, input.staffId), eq(staffMembers.businessId, context.businessId), eq(staffMembers.active, true))).limit(1);
  if (!staff) throw new Error("Operatore non valido.");
  if (staff.userId) throw new Error("Questo operatore possiede già un account collegato.");
  await issueStaffInvitation({ businessId: context.businessId, businessName: context.businessName, staffId: staff.id, email: input.email, createdBy: context.user.id });
  refreshStaffPages();
}

export async function createOwnerStaffProfile() {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const [existing] = await db.select({ id: staffMembers.id }).from(staffMembers)
    .where(and(eq(staffMembers.businessId, context.businessId), eq(staffMembers.userId, context.user.id))).limit(1);
  if (existing) {
    await db.update(staffMembers).set({ active: true, locationId: context.locationId, updatedAt: new Date() }).where(eq(staffMembers.id, existing.id));
  } else {
    const name = context.user.name?.trim() || context.user.email.split("@")[0];
    await db.insert(staffMembers).values({ businessId: context.businessId, locationId: context.locationId, userId: context.user.id, name, title: "Titolare" });
  }
  refreshStaffPages();
}

export async function updateStaffMember(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(100), title: z.string().trim().max(80).optional() })
    .parse({ id: formData.get("id"), name: formData.get("name"), title: formData.get("title") || undefined });
  await db.update(staffMembers).set({ name: input.name, title: input.title ?? null, updatedAt: new Date() })
    .where(and(eq(staffMembers.id, input.id), eq(staffMembers.businessId, context.businessId)));
  refreshStaffPages();
}

export async function deleteStaffMember(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const id = z.string().uuid().parse(formData.get("id"));
  await db.transaction(async (tx) => {
    const [member] = await tx.select({ userId: staffMembers.userId }).from(staffMembers)
      .where(and(eq(staffMembers.id, id), eq(staffMembers.businessId, context.businessId))).limit(1);
    const [linkedAppointment] = await tx.select({ id: appointments.id }).from(appointments)
      .where(and(eq(appointments.staffId, id), eq(appointments.businessId, context.businessId))).limit(1);
    await tx.delete(staffServices).where(and(eq(staffServices.staffId, id), eq(staffServices.businessId, context.businessId)));
    await tx.delete(workingHours).where(and(eq(workingHours.staffId, id), eq(workingHours.businessId, context.businessId)));
    await tx.delete(staffAbsences).where(and(eq(staffAbsences.staffId, id), eq(staffAbsences.businessId, context.businessId)));
    if (member?.userId) await tx.delete(businessMemberships).where(and(
      eq(businessMemberships.businessId, context.businessId),
      eq(businessMemberships.userId, member.userId),
      eq(businessMemberships.role, "STAFF"),
    ));
    if (linkedAppointment) {
      await tx.update(staffMembers).set({ active: false, updatedAt: new Date() })
        .where(and(eq(staffMembers.id, id), eq(staffMembers.businessId, context.businessId)));
    } else {
      await tx.delete(staffMembers).where(and(eq(staffMembers.id, id), eq(staffMembers.businessId, context.businessId)));
    }
  });
  refreshStaffPages();
}

export async function assignService(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = z.object({ staffId: z.string().uuid(), serviceId: z.string().uuid() })
    .parse({ staffId: formData.get("staffId"), serviceId: formData.get("serviceId") });
  const [staff] = await db.select({ id: staffMembers.id }).from(staffMembers).where(and(eq(staffMembers.id, input.staffId), eq(staffMembers.businessId, context.businessId), eq(staffMembers.active, true))).limit(1);
  const [service] = await db.select({ id: services.id }).from(services).where(and(eq(services.id, input.serviceId), eq(services.businessId, context.businessId), eq(services.active, true))).limit(1);
  if (!staff || !service) throw new Error("Operatore o servizio non valido.");
  await db.insert(staffServices).values({ ...input, businessId: context.businessId }).onConflictDoNothing();
  refreshStaffPages();
}

export async function removeAssignedService(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = z.object({ staffId: z.string().uuid(), serviceId: z.string().uuid() })
    .parse({ staffId: formData.get("staffId"), serviceId: formData.get("serviceId") });
  await db.delete(staffServices).where(and(eq(staffServices.staffId, input.staffId), eq(staffServices.serviceId, input.serviceId), eq(staffServices.businessId, context.businessId)));
  refreshStaffPages();
}

export async function assignCategory(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = z.object({ staffId: z.string().uuid(), categoryId: z.string().uuid() })
    .parse({ staffId: formData.get("staffId"), categoryId: formData.get("categoryId") });
  const [staff] = await db.select({ id: staffMembers.id }).from(staffMembers)
    .where(and(eq(staffMembers.id, input.staffId), eq(staffMembers.businessId, context.businessId), eq(staffMembers.active, true))).limit(1);
  const [category] = await db.select({ id: serviceCategories.id }).from(serviceCategories)
    .where(and(eq(serviceCategories.id, input.categoryId), eq(serviceCategories.businessId, context.businessId), eq(serviceCategories.active, true))).limit(1);
  if (!staff || !category) throw new Error("Operatore o categoria non valida.");
  const categoryServices = await db.select({ id: services.id }).from(services)
    .where(and(eq(services.businessId, context.businessId), eq(services.categoryId, input.categoryId), eq(services.active, true)));
  if (categoryServices.length) await db.insert(staffServices).values(categoryServices.map((service) => ({ staffId: staff.id, serviceId: service.id, businessId: context.businessId }))).onConflictDoNothing();
  refreshStaffPages();
}

function parseWorkingHours(formData: FormData) {
  const input = z.object({ weekday: z.coerce.number().int().min(0).max(6), start: z.string(), end: z.string() })
    .parse({ weekday: formData.get("weekday"), start: formData.get("start"), end: formData.get("end") });
  const startMinutes = parseTimeToMinutes(input.start);
  const endMinutes = parseTimeToMinutes(input.end);
  if (endMinutes <= startMinutes) throw new Error("La fine del turno deve essere successiva all’inizio.");
  return { weekday: weekdayValues[input.weekday], startMinutes, endMinutes };
}

export async function addWorkingHours(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const staffId = z.string().uuid().parse(formData.get("staffId"));
  const input = parseWorkingHours(formData);
  const [staff] = await db.select({ id: staffMembers.id }).from(staffMembers).where(and(eq(staffMembers.id, staffId), eq(staffMembers.businessId, context.businessId), eq(staffMembers.active, true))).limit(1);
  if (!staff) throw new Error("Operatore non valido.");
  await db.insert(workingHours).values({ businessId: context.businessId, staffId, ...input });
  refreshStaffPages();
}

export async function updateWorkingHours(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const id = z.string().uuid().parse(formData.get("id"));
  const input = parseWorkingHours(formData);
  await db.update(workingHours).set(input).where(and(eq(workingHours.id, id), eq(workingHours.businessId, context.businessId)));
  refreshStaffPages();
}

export async function deleteWorkingHours(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const id = z.string().uuid().parse(formData.get("id"));
  await db.delete(workingHours).where(and(eq(workingHours.id, id), eq(workingHours.businessId, context.businessId)));
  refreshStaffPages();
}

export async function addAbsence(formData: FormData) {
  const context = await requireBusinessContext(); ownerOnly(context.role);
  const input = z.object({ staffId: z.string().uuid(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), reason: z.string().trim().max(120).optional() })
    .parse({ staffId: formData.get("staffId"), startsAt: formData.get("startsAt"), endsAt: formData.get("endsAt"), reason: formData.get("reason") || undefined });
  if (input.endsAt <= input.startsAt) throw new Error("La fine dell’assenza deve essere successiva all’inizio.");
  const [staff] = await db.select({ id: staffMembers.id }).from(staffMembers).where(and(eq(staffMembers.id, input.staffId), eq(staffMembers.businessId, context.businessId), eq(staffMembers.active, true))).limit(1);
  if (!staff) throw new Error("Operatore non valido.");
  await db.insert(staffAbsences).values({ businessId: context.businessId, staffId: input.staffId, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason });
  refreshStaffPages();
}
