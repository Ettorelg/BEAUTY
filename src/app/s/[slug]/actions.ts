"use server";

import { and, eq, gt, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import {
  appointmentEvents,
  appointmentAdditionalServices,
  appointments,
  businesses,
  customerRelations,
  fidelityCards,
  fidelityPromotions,
  fidelityRedemptions,
  fidelityRules,
  fidelitySettings,
  locations,
  services,
  staffMembers,
  staffServices,
  serviceWaitlist,
  serviceAdditionalCompatibilities,
  serviceOccurrences,
  users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { sendBookingConfirmation } from "@/lib/staff-invitations";
import { ensureServicePricingSchema } from "@/lib/ensure-service-pricing-schema";
import { ensureAdditionalServicesSchema } from "@/lib/ensure-additional-services-schema";
import { getPublicAvailability } from "@/modules/availability/application/public-availability";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";
import { calculateBookingPriceCents } from "@/modules/fidelity/domain/booking-price";

const schema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().uuid(),
  selection: z.string().transform((value, context) => {
    const [staffId, startsAt] = value.split("|");
    if (
      !z.string().uuid().safeParse(staffId).success ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt ?? "")
    ) {
      context.addIssue({ code: "custom", message: "Slot non valido." });
      return z.NEVER;
    }
    return { staffId, startsAt };
  }),
  customerName: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  phone: z.string().trim().min(6).max(30),
  idempotencyKey: z.string().uuid(),
  rewardRuleId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().uuid().optional(),
  ),
  additionalServiceIds: z.preprocess((value) => typeof value === "string" && value ? value.split(",") : [], z.array(z.string().uuid()).max(5)),
});

export async function createPublicAppointment(formData: FormData) {
  await ensureServicePricingSchema();
  await ensureAdditionalServicesSchema();
  const input = schema.parse(Object.fromEntries(formData));
  const session = await auth.api.getSession({ headers: await headers() });
  const { staffId, startsAt: localStart } = input.selection;
  const [selection] = await db
    .select({
      businessId: businesses.id,
      businessName: businesses.name,
      address: businesses.address,
      phone: businesses.phone,
      timezone: businesses.timezone,
      locationId: locations.id,
      serviceName: services.name,
      duration: services.durationMinutes,
      price: services.price,
      repeatPrice: services.repeatPrice,
      repeatPriceEnabled: services.repeatPriceEnabled,
      repeatDuration: services.repeatDurationMinutes,
      capacity: services.capacity,
      additionalServiceMode: services.additionalServiceMode,
    })
    .from(businesses)
    .innerJoin(locations, eq(locations.businessId, businesses.id))
    .innerJoin(
      services,
      and(
        eq(services.businessId, businesses.id),
        eq(services.id, input.serviceId),
        eq(services.active, true),
        eq(services.onlineBookable, true),
      ),
    )
    .innerJoin(
      staffServices,
      and(
        eq(staffServices.businessId, businesses.id),
        eq(staffServices.serviceId, services.id),
        eq(staffServices.staffId, staffId),
      ),
    )
    .innerJoin(
      staffMembers,
      and(
        eq(staffMembers.id, staffId),
        eq(staffMembers.businessId, businesses.id),
        eq(staffMembers.active, true),
      ),
    )
    .where(eq(businesses.slug, input.slug))
    .limit(1);
  if (!selection) throw Error("Prenotazione non valida.");
  const extraIds = [...new Set(input.additionalServiceIds)].filter(id => id !== input.serviceId);
  if (extraIds.length && selection.additionalServiceMode === "NONE") throw Error("Questo servizio non può essere abbinato ad altri servizi.");
  if (extraIds.length && selection.additionalServiceMode === "SELECTED") {
    const allowed = await db.select({ id: serviceAdditionalCompatibilities.additionalServiceId }).from(serviceAdditionalCompatibilities).where(and(eq(serviceAdditionalCompatibilities.businessId, selection.businessId), eq(serviceAdditionalCompatibilities.primaryServiceId, input.serviceId), inArray(serviceAdditionalCompatibilities.additionalServiceId, extraIds)));
    if (allowed.length !== extraIds.length) throw Error("Uno dei servizi scelti non è compatibile con il servizio principale.");
  }
  const extras = extraIds.length ? await db.select({ id: services.id, name: services.name, duration: services.durationMinutes, price: services.price, addsDuration: services.addsDuration }).from(services).innerJoin(staffServices, and(eq(staffServices.serviceId, services.id), eq(staffServices.staffId, staffId), eq(staffServices.businessId, selection.businessId))).where(and(eq(services.businessId, selection.businessId), eq(services.active, true), eq(services.onlineBookable, true), inArray(services.id, extraIds))) : [];
  if (extras.length !== extraIds.length) throw Error("Uno dei servizi aggiuntivi non è disponibile con questo operatore.");
  const extraDuration = extras.filter(item => item.addsDuration).reduce((sum, item) => sum + item.duration, 0);

  const date = localStart.slice(0, 10);
  const slots = await getPublicAvailability({
    businessId: selection.businessId,
    serviceId: input.serviceId,
    date,
    durationMinutes: selection.duration + extraDuration,
    timezone: selection.timezone,
    capacity: selection.capacity,
  });
  if (
    !slots.some(
      (slot) => slot.staffId === staffId && slot.localStart === localStart,
    )
  )
    throw Error("Lo slot non è più disponibile.");

  const startsAt = zonedLocalToUtc(localStart, selection.timezone);
  const [occurrence] = await db.select({ capacity: serviceOccurrences.capacity }).from(serviceOccurrences).where(and(eq(serviceOccurrences.businessId, selection.businessId), eq(serviceOccurrences.serviceId, input.serviceId), eq(serviceOccurrences.staffId, staffId), eq(serviceOccurrences.startsAt, startsAt), eq(serviceOccurrences.active, true))).limit(1);
  const bookingCapacity = occurrence?.capacity ?? selection.capacity;
  const signedIn =
    session?.user.email.toLowerCase() === input.email.toLowerCase()
      ? session.user
      : null;
  if (input.rewardRuleId && !signedIn)
    throw Error("Accedi come cliente per utilizzare i punti Fidelity.");
  const [promotion] = await db
    .select({ discount: fidelityPromotions.discountPercent })
    .from(fidelityPromotions)
    .where(
      and(
        eq(fidelityPromotions.businessId, selection.businessId),
        eq(fidelityPromotions.serviceId, input.serviceId),
        lte(fidelityPromotions.startsAt, startsAt),
        gte(fidelityPromotions.endsAt, startsAt),
      ),
    )
    .limit(1);

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${staffId}))`);
    const email = input.email.toLowerCase();
    if (signedIn)
      await tx
        .update(users)
        .set({ phone: input.phone, updatedAt: new Date() })
        .where(eq(users.id, signedIn.id));
    const normalizedPhone = input.phone.replace(/\D/g, "");
    const knownRows = signedIn
      ? await tx
          .select({ id: customerRelations.id })
          .from(customerRelations)
          .where(
            and(
              eq(customerRelations.businessId, selection.businessId),
              eq(customerRelations.userId, signedIn.id),
            ),
          )
          .limit(1)
      : await tx
          .select({ id: customerRelations.id })
          .from(customerRelations)
          .where(
            and(
              eq(customerRelations.businessId, selection.businessId),
              eq(customerRelations.email, email),
              eq(
                sql`regexp_replace(coalesce(${customerRelations.phone}, ''), '\\D', '', 'g')`,
                normalizedPhone,
              ),
            ),
          )
          .limit(2);
    const [known] = knownRows;
    const customerId =
      known?.id ??
      (
        await tx
          .insert(customerRelations)
          .values({
            businessId: selection.businessId,
            userId: signedIn?.id ?? null,
            name: input.customerName,
            email,
            phone: input.phone,
          })
          .returning({ id: customerRelations.id })
      )[0].id;
    if (known)
      await tx
        .update(customerRelations)
        .set({
          userId: signedIn?.id ?? null,
          name: input.customerName,
          phone: input.phone,
          updatedAt: new Date(),
        })
        .where(eq(customerRelations.id, known.id));

    const [previousService] = await tx
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, selection.businessId),
          eq(appointments.customerRelationId, customerId),
          eq(appointments.serviceId, input.serviceId),
          eq(appointments.status, "COMPLETED"),
        ),
      )
      .limit(1);
    const primaryDuration =
      previousService && selection.repeatDuration != null
        ? selection.repeatDuration
        : selection.duration;
    const effectiveDuration = primaryDuration + extraDuration;
    const effectiveSlots = await getPublicAvailability({
      businessId: selection.businessId,
      serviceId: input.serviceId,
      date,
      durationMinutes: effectiveDuration,
      timezone: selection.timezone,
      capacity: bookingCapacity,
    });
    if (
      !effectiveSlots.some(
        (slot) => slot.staffId === staffId && slot.localStart === localStart,
      )
    )
      throw Error("Lo slot non è disponibile per la durata prevista.");
    const busy = await tx
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, selection.businessId),
          eq(appointments.staffId, staffId),
          lt(
            appointments.startsAt,
            new Date(startsAt.getTime() + effectiveDuration * 60_000),
          ),
          gt(appointments.endsAt, startsAt),
          sql`"status" in ('BOOKED','CONFIRMED','ARRIVED')`,
        ),
      );
    if (busy.length >= bookingCapacity)
      throw Error("Lo slot ha raggiunto il numero massimo di posti.");
    const basePrice =
      previousService &&
      selection.repeatPriceEnabled &&
      selection.repeatPrice != null
        ? selection.repeatPrice
        : selection.price;

    const [fidelityConfig] = await tx
      .select({ allowRewardStacking: fidelitySettings.allowRewardStacking })
      .from(fidelitySettings)
      .where(eq(fidelitySettings.businessId, selection.businessId))
      .limit(1);
    let priceCents = calculateBookingPriceCents(
      Math.round(Number(basePrice) * 100),
      promotion?.discount ?? 0,
    );
    let reward: typeof fidelityRules.$inferSelect | undefined;
    if (input.rewardRuleId) {
      [reward] = await tx
        .select()
        .from(fidelityRules)
        .where(
          and(
            eq(fidelityRules.id, input.rewardRuleId),
            eq(fidelityRules.businessId, selection.businessId),
          ),
        )
        .limit(1);
      if (!reward || (reward.serviceId && reward.serviceId !== input.serviceId))
        throw Error("Il bonus selezionato non è valido per questo servizio.");
      const [card] = await tx
        .select({
          points: fidelityCards.points,
          expiresAt: fidelityCards.pointsExpiresAt,
        })
        .from(fidelityCards)
        .where(
          and(
            eq(fidelityCards.businessId, selection.businessId),
            eq(fidelityCards.customerRelationId, customerId),
          ),
        )
        .limit(1);
      if (
        !card ||
        (card.expiresAt && card.expiresAt < new Date()) ||
        card.points < reward.points
      )
        throw Error("Punti Fidelity insufficienti o scaduti.");
      priceCents = calculateBookingPriceCents(
        Math.round(Number(basePrice) * 100),
        promotion?.discount ?? 0,
        reward,
        fidelityConfig?.allowRewardStacking ?? false,
      );
    }
    const [created] = await tx
      .insert(appointments)
      .values({
        businessId: selection.businessId,
        locationId: selection.locationId,
        customerRelationId: customerId,
        staffId,
        serviceId: input.serviceId,
        serviceName: selection.serviceName,
        durationMinutes: effectiveDuration,
        price: (priceCents / 100).toFixed(2),
        startsAt,
        endsAt: new Date(startsAt.getTime() + effectiveDuration * 60_000),
        timezone: selection.timezone,
        source: "PUBLIC",
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoNothing({
        target: [appointments.businessId, appointments.idempotencyKey],
      })
      .returning({ id: appointments.id });
    if (!created) throw Error("Prenotazione già registrata.");
    if (extras.length) await tx.insert(appointmentAdditionalServices).values(extras.map(item => ({ businessId: selection.businessId, appointmentId: created.id, serviceId: item.id, serviceName: item.name, durationMinutes: item.addsDuration ? item.duration : 0, price: String(item.price) })));

    if (reward) {
      const [updatedCard] = await tx
        .update(fidelityCards)
        .set({
          points: sql`${fidelityCards.points} - ${reward.points}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(fidelityCards.businessId, selection.businessId),
            eq(fidelityCards.customerRelationId, customerId),
            gte(fidelityCards.points, reward.points),
          ),
        )
        .returning({ id: fidelityCards.id });
      if (!updatedCard) throw Error("Punti Fidelity insufficienti.");
      await tx
        .insert(fidelityRedemptions)
        .values({
          businessId: selection.businessId,
          customerRelationId: customerId,
          ruleId: reward.id,
          appointmentId: created.id,
          pointsSpent: reward.points,
          rewardType: reward.type,
          rewardValue: reward.value,
          serviceId: reward.serviceId,
        });
    }
    await tx
      .insert(appointmentEvents)
      .values({
        appointmentId: created.id,
        businessId: selection.businessId,
        type: "CREATED",
        toStatus: "BOOKED",
        note: reward ? `Premio Fidelity: ${reward.points} punti` : null,
      });
  });

  await sendBookingConfirmation({
    businessId: selection.businessId,
    email: input.email,
    businessName: selection.businessName ?? input.slug,
    serviceName: [selection.serviceName, ...extras.map(item => item.name)].join(" + "),
    startsAt,
    timezone: selection.timezone,
    address: selection.address,
    phone: selection.phone,
  });
  redirect(`/s/${input.slug}/conferma${signedIn ? "" : "?account=1"}`);
}

export async function joinServiceWaitlist(formData:FormData){await ensureServicePricingSchema();const input=z.object({slug:z.string().min(1),serviceId:z.string().uuid(),staffId:z.string().uuid(),startsAt:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),customerName:z.string().trim().min(2).max(100),email:z.string().trim().email(),phone:z.string().trim().min(6).max(30)}).parse(Object.fromEntries(formData));const[row]=await db.select({businessId:businesses.id,capacity:services.capacity,enabled:services.waitlistEnabled,timezone:businesses.timezone}).from(businesses).innerJoin(services,and(eq(services.businessId,businesses.id),eq(services.id,input.serviceId),eq(services.active,true))).innerJoin(staffServices,and(eq(staffServices.businessId,businesses.id),eq(staffServices.serviceId,services.id),eq(staffServices.staffId,input.staffId))).where(eq(businesses.slug,input.slug)).limit(1);if(!row||!row.enabled)throw Error("Lista d’attesa non disponibile.");const startsAt=zonedLocalToUtc(input.startsAt,row.timezone),bookings=await db.select({id:appointments.id}).from(appointments).where(and(eq(appointments.businessId,row.businessId),eq(appointments.serviceId,input.serviceId),eq(appointments.staffId,input.staffId),eq(appointments.startsAt,startsAt),sql`"status" in ('BOOKED','CONFIRMED','ARRIVED')`));if(bookings.length<row.capacity)throw Error("C’è ancora un posto disponibile: effettua direttamente la prenotazione.");const email=input.email.toLowerCase(),[known]=await db.select({id:customerRelations.id}).from(customerRelations).where(and(eq(customerRelations.businessId,row.businessId),eq(customerRelations.email,email))).limit(1);const customerId=known?.id??(await db.insert(customerRelations).values({businessId:row.businessId,name:input.customerName,email,phone:input.phone}).returning({id:customerRelations.id}))[0].id;const[duplicate]=await db.select({id:serviceWaitlist.id}).from(serviceWaitlist).where(and(eq(serviceWaitlist.businessId,row.businessId),eq(serviceWaitlist.serviceId,input.serviceId),eq(serviceWaitlist.staffId,input.staffId),eq(serviceWaitlist.startsAt,startsAt),eq(serviceWaitlist.email,email),sql`"status" in ('WAITING','OFFERED')`)).limit(1);if(!duplicate)await db.insert(serviceWaitlist).values({businessId:row.businessId,serviceId:input.serviceId,staffId:input.staffId,customerRelationId:customerId,customerName:input.customerName,email,phone:input.phone,startsAt});redirect(`/s/${input.slug}?service=${input.serviceId}&waitlist=1`)}

export async function joinDayWaitlist(formData: FormData) {
  await ensureServicePricingSchema();
  const input = z.object({ slug: z.string().min(1), serviceId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), staffId: z.preprocess(v => v || undefined, z.string().uuid().optional()), customerName: z.string().trim().min(2).max(100), email: z.string().trim().email(), phone: z.string().trim().min(6).max(30) }).parse(Object.fromEntries(formData));
  const [row] = await db.select({ businessId: businesses.id, timezone: businesses.timezone, duration: services.durationMinutes, capacity: services.capacity, enabled: services.waitlistEnabled }).from(businesses).innerJoin(services, and(eq(services.businessId, businesses.id), eq(services.id, input.serviceId), eq(services.active, true))).where(eq(businesses.slug, input.slug)).limit(1);
  if (!row?.enabled) throw Error("Lista d’attesa non disponibile.");
  let available = await getPublicAvailability({ businessId: row.businessId, serviceId: input.serviceId, date: input.date, durationMinutes: row.duration, timezone: row.timezone, capacity: row.capacity });
  if (input.staffId) available = available.filter(slot => slot.staffId === input.staffId);
  if (available.length) throw Error("Ci sono ancora orari disponibili: effettua direttamente la prenotazione.");
  const eligibleStaff = await db.select({ id: staffServices.staffId }).from(staffServices).innerJoin(staffMembers, and(eq(staffMembers.id, staffServices.staffId), eq(staffMembers.active, true))).where(and(eq(staffServices.businessId, row.businessId), eq(staffServices.serviceId, input.serviceId), input.staffId ? eq(staffServices.staffId, input.staffId) : undefined)).limit(1);
  if (!eligibleStaff[0]) throw Error("Nessun operatore disponibile per questo servizio.");
  const email = input.email.toLowerCase();
  const [known] = await db.select({ id: customerRelations.id }).from(customerRelations).where(and(eq(customerRelations.businessId, row.businessId), eq(customerRelations.email, email))).limit(1);
  const customerId = known?.id ?? (await db.insert(customerRelations).values({ businessId: row.businessId, name: input.customerName, email, phone: input.phone }).returning({ id: customerRelations.id }))[0].id;
  const [duplicate] = await db.select({ id: serviceWaitlist.id }).from(serviceWaitlist).where(and(eq(serviceWaitlist.businessId, row.businessId), eq(serviceWaitlist.serviceId, input.serviceId), eq(serviceWaitlist.requestedDay, input.date), eq(serviceWaitlist.email, email), sql`"status" in ('WAITING','OFFERED')`)).limit(1);
  if (!duplicate) await db.insert(serviceWaitlist).values({ businessId: row.businessId, serviceId: input.serviceId, staffId: eligibleStaff[0].id, customerRelationId: customerId, customerName: input.customerName, email, phone: input.phone, startsAt: zonedLocalToUtc(`${input.date}T00:00`, row.timezone), requestedDay: input.date, anyStaff: !input.staffId });
  redirect(`/s/${input.slug}?service=${input.serviceId}&date=${input.date}${input.staffId ? `&staff=${input.staffId}` : ""}&waitlist=1`);
}
