"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import {
  customerRelations,
  fidelityPromotions,
  fidelityRules,
  fidelitySettings,
  promotionBroadcasts,
  services,
} from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensureFidelitySchema } from "@/lib/ensure-fidelity-schema";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";
import { sendPromotionEmail } from "@/lib/staff-invitations";

async function owner() {
  const c = await requireBusinessContext();
  if (c.role !== "OWNER") throw Error("Operazione riservata al titolare.");
  await ensureFidelitySchema();
  return c;
}
const refresh = () => {
  revalidatePath("/app/fidelity");
  revalidatePath("/s/[slug]", "page");
};
export async function saveFidelitySettings(f: FormData) {
  const c = await owner();
  const x = z
    .object({
      awardMode: z.enum(["BY_SPEND", "PER_SERVICE", "PER_APPOINTMENT"]),
      spendEuros: z.coerce.number().min(1),
      pointsAward: z.coerce.number().int().min(1),
      pointsValidityMonths: z.coerce.number().int().min(1).max(60),
      allowRewardStacking: z.string().optional(),
    })
    .parse(Object.fromEntries(f));
  const settings = {
    awardMode: x.awardMode,
    spendCents: Math.round(x.spendEuros * 100),
    pointsAward: x.pointsAward,
    pointsValidityMonths: x.pointsValidityMonths,
    allowRewardStacking: x.allowRewardStacking === "on",
    updatedAt: new Date(),
  };
  await db
    .insert(fidelitySettings)
    .values({ businessId: c.businessId, ...settings })
    .onConflictDoUpdate({ target: fidelitySettings.businessId, set: settings });
  refresh();
  redirect("/app/fidelity?saved=1");
}
export async function addFidelityRule(f: FormData) {
  const c = await owner();
  const x = z
    .object({
      points: z.coerce.number().int().min(1),
      type: z.enum(["DISCOUNT_EUR", "DISCOUNT_PERCENT", "FREE_SERVICE"]),
      value: z.coerce.number().min(0),
      serviceId: z.string().uuid().optional(),
    })
    .parse({
      ...Object.fromEntries(f),
      serviceId: f.get("serviceId") || undefined,
    });
  if (x.type === "FREE_SERVICE" && !x.serviceId)
    throw Error("Seleziona il servizio omaggio.");
  await db
    .insert(fidelityRules)
    .values({
      businessId: c.businessId,
      points: x.points,
      type: x.type,
      value:
        x.type === "DISCOUNT_EUR"
          ? Math.round(x.value * 100)
          : Math.round(x.value),
      serviceId: x.type === "FREE_SERVICE" ? x.serviceId : null,
    });
  refresh();
  redirect("/app/fidelity?rule=1");
}
export async function deleteFidelityRule(f: FormData) {
  const c = await owner();
  const id = z.string().uuid().parse(f.get("id"));
  await db
    .delete(fidelityRules)
    .where(
      and(eq(fidelityRules.id, id), eq(fidelityRules.businessId, c.businessId)),
    );
  refresh();
}
export async function addPromotion(f: FormData) {
  const c = await owner();
  const x = z
    .object({
      serviceId: z.string().uuid(),
      discountPercent: z.coerce.number().int().min(1).max(100),
      startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    })
    .parse(Object.fromEntries(f));
  const startsAt = zonedLocalToUtc(x.startsAt, c.timezone),
    endsAt = zonedLocalToUtc(x.endsAt, c.timezone);
  if (endsAt <= startsAt)
    throw Error("La fine deve essere successiva all'inizio.");
  const [service] = await db
    .select({ id: services.id })
    .from(services)
    .where(
      and(
        eq(services.id, x.serviceId),
        eq(services.businessId, c.businessId),
        eq(services.active, true),
      ),
    )
    .limit(1);
  if (!service) throw Error("Servizio non valido.");
  await db
    .insert(fidelityPromotions)
    .values({
      businessId: c.businessId,
      serviceId: x.serviceId,
      discountPercent: x.discountPercent,
      startsAt,
      endsAt,
    });
  refresh();
  redirect("/app/fidelity?promo=1");
}
export async function deletePromotion(f: FormData) {
  const c = await owner();
  const id = z.string().uuid().parse(f.get("id"));
  await db
    .delete(fidelityPromotions)
    .where(
      and(
        eq(fidelityPromotions.id, id),
        eq(fidelityPromotions.businessId, c.businessId),
      ),
    );
  refresh();
}

export async function sendPromotionToAllCustomers(f: FormData) {
  const c = await owner(),
    id = z.string().uuid().parse(f.get("id"));
  const [promotion] = await db
    .select({
      id: fidelityPromotions.id,
      discount: fidelityPromotions.discountPercent,
      startsAt: fidelityPromotions.startsAt,
      endsAt: fidelityPromotions.endsAt,
      serviceName: services.name,
    })
    .from(fidelityPromotions)
    .innerJoin(services, eq(services.id, fidelityPromotions.serviceId))
    .where(
      and(
        eq(fidelityPromotions.id, id),
        eq(fidelityPromotions.businessId, c.businessId),
      ),
    )
    .limit(1);
  if (!promotion) throw Error("Promozione non trovata.");
  const customers = await db
    .select({ email: customerRelations.email })
    .from(customerRelations)
    .where(eq(customerRelations.businessId, c.businessId));
  const emails = [
    ...new Set(
      customers
        .map((x) => x.email?.trim().toLowerCase())
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  if (!emails.length) throw Error("Nessun cliente con email disponibile.");
  const [broadcast] = await db
    .insert(promotionBroadcasts)
    .values({
      businessId: c.businessId,
      promotionId: id,
      status: "SENDING",
      recipientCount: emails.length,
    })
    .returning({ id: promotionBroadcasts.id });
  let success = 0,
    failure = 0,
    lastError: string | null = null;
  for (const email of emails) {
    const result = await sendPromotionEmail({
      email,
      businessName: c.businessName,
      serviceName: promotion.serviceName,
      discountPercent: promotion.discount,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      timezone: c.timezone,
      promotionId: id,
    });
    if (result.sent) success++;
    else {
      failure++;
      lastError = result.error;
    }
  }
  await db
    .update(promotionBroadcasts)
    .set({
      status: failure === 0 ? "SENT" : success > 0 ? "PARTIAL" : "FAILED",
      successCount: success,
      failureCount: failure,
      lastError,
      sentAt: new Date(),
    })
    .where(eq(promotionBroadcasts.id, broadcast.id));
  refresh();
  redirect(`/app/fidelity?sent=${success}&failed=${failure}`);
}
