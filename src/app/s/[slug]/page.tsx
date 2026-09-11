import { and, asc, eq, gte, lt, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import {
  businesses,
  serviceCategories,
  serviceAdditionalCompatibilities,
  services,
  staffMembers,
  staffServices,
  users,
  customerRelations,
  fidelityCards,
  fidelitySettings,
  fidelityRules,
  fidelityPromotions,
  appointments,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { ensureFidelitySchema } from "@/lib/ensure-fidelity-schema";
import { ensureServicePricingSchema } from "@/lib/ensure-service-pricing-schema";
import { LogoutButton } from "@/app/app/logout-button";
import { getPublicAvailability } from "@/modules/availability/application/public-availability";
import { createPublicAppointment } from "./actions";
import { joinDayWaitlist, joinServiceWaitlist } from "./actions";
import { BookingDetailsForm } from "./booking-details-form";
import { BookingFilters } from "./booking-filters";
import { describePointAward } from "@/modules/fidelity/domain/rewards";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";
const dateOk = (v?: string) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");
const after = (v: string, n: number) => {
  const d = new Date(`${v}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string; date?: string; staff?: string;waitlist?:string; extras?: string }>;
}) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const [b] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1);
  if (!b || !b.active) notFound();
  await ensureFidelitySchema();
  await ensureServicePricingSchema();
  const session = await auth.api.getSession({ headers: await headers() });
  const [profile] = session
    ? await db
        .select({ phone: users.phone })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1)
    : [];
  const completedServiceRows = session
    ? await db
        .select({ serviceId: appointments.serviceId })
        .from(appointments)
        .innerJoin(
          customerRelations,
          and(
            eq(customerRelations.id, appointments.customerRelationId),
            eq(customerRelations.userId, session.user.id),
          ),
        )
        .where(
          and(
            eq(appointments.businessId, b.id),
            eq(appointments.status, "COMPLETED"),
          ),
        )
    : [];
  const completedServiceIds = new Set(
    completedServiceRows.map((x) => x.serviceId),
  );
  const [card] = session
    ? await db
        .select({
          points: fidelityCards.points,
          expiresAt: fidelityCards.pointsExpiresAt,
        })
        .from(fidelityCards)
        .innerJoin(
          customerRelations,
          eq(customerRelations.id, fidelityCards.customerRelationId),
        )
        .where(
          and(
            eq(fidelityCards.businessId, b.id),
            eq(customerRelations.userId, session.user.id),
          ),
        )
        .limit(1)
    : [];
  const [loyalty] = await db
    .select({
      rewardPoints: fidelitySettings.rewardPoints,
      rewardType: fidelitySettings.rewardType,
      rewardValue: fidelitySettings.rewardValue,
      allowRewardStacking: fidelitySettings.allowRewardStacking,
      awardMode: fidelitySettings.awardMode,
      spendCents: fidelitySettings.spendCents,
      pointsAward: fidelitySettings.pointsAward,
    })
    .from(fidelitySettings)
    .where(eq(fidelitySettings.businessId, b.id))
    .limit(1);
  const bonusRules = await db
    .select({
      id: fidelityRules.id,
      points: fidelityRules.points,
      type: fidelityRules.type,
      value: fidelityRules.value,
      serviceId: fidelityRules.serviceId,
    })
    .from(fidelityRules)
    .where(eq(fidelityRules.businessId, b.id))
    .orderBy(asc(fidelityRules.points));
  const allPromotions = await db
    .select({
      discount: fidelityPromotions.discountPercent,
      startsAt: fidelityPromotions.startsAt,
      endsAt: fidelityPromotions.endsAt,
      serviceId: fidelityPromotions.serviceId,
    })
    .from(fidelityPromotions)
    .where(eq(fidelityPromotions.businessId, b.id));
  const now = new Date();
  const activePromotions = allPromotions.filter(
    (x) => x.startsAt <= now && x.endsAt >= now,
  );
  const promotionByService = new Map(
    activePromotions.map((x) => [x.serviceId, x]),
  );
  const catalog = await db
    .select({
      id: services.id,
      name: services.name,
      description: services.description,
      duration: services.durationMinutes,
      price: services.price,
      repeatPrice: services.repeatPrice,
      repeatPriceEnabled: services.repeatPriceEnabled,
      repeatDurationMinutes: services.repeatDurationMinutes,
      capacity:services.capacity,
      waitlistEnabled:services.waitlistEnabled,
      addsDuration: services.addsDuration,
      additionalServiceMode: services.additionalServiceMode,
      category: serviceCategories.name,
    })
    .from(services)
    .innerJoin(
      serviceCategories,
      and(
        eq(services.categoryId, serviceCategories.id),
        eq(serviceCategories.businessId, b.id),
        eq(serviceCategories.active, true),
      ),
    )
    .where(
      and(
        eq(services.businessId, b.id),
        eq(services.active, true),
        eq(services.onlineBookable, true),
      ),
    )
    .orderBy(asc(serviceCategories.sortOrder), asc(services.name));
  const service = catalog.find((x) => x.id === q.service);
  const allowedAdditionalIds = service?.additionalServiceMode === "SELECTED" ? (await db.select({ id: serviceAdditionalCompatibilities.additionalServiceId }).from(serviceAdditionalCompatibilities).where(and(eq(serviceAdditionalCompatibilities.businessId, b.id), eq(serviceAdditionalCompatibilities.primaryServiceId, service.id)))).map(item => item.id) : [];
  const selectedExtraIds = [...new Set((q.extras ?? "").split(",").filter(Boolean))].filter(id => id !== service?.id && catalog.some(item => item.id === id) && service?.additionalServiceMode !== "NONE" && (service?.additionalServiceMode === "ALL" || allowedAdditionalIds.includes(id))).slice(0, 5);
  const selectedExtras = catalog.filter(item => selectedExtraIds.includes(item.id));
  const extraDuration = selectedExtras.filter(item => item.addsDuration).reduce((sum, item) => sum + item.duration, 0);
  const extraPrice = selectedExtras.reduce((sum, item) => sum + Number(item.price), 0);
  const usablePoints =
    card?.expiresAt && card.expiresAt < now ? 0 : (card?.points ?? 0);
  const availableBonusRules =
    service && session
      ? bonusRules.filter(
          (x) =>
            usablePoints >= x.points &&
            (!x.serviceId || x.serviceId === service.id),
        )
      : [];
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: b.timezone,
  }).format(new Date());
  let date = dateOk(q.date) ? q.date! : today;
  const staff = service
    ? await db
        .select({ id: staffMembers.id, name: staffMembers.name })
        .from(staffServices)
        .innerJoin(
          staffMembers,
          and(
            eq(staffMembers.id, staffServices.staffId),
            eq(staffMembers.businessId, b.id),
            eq(staffMembers.active, true),
          ),
        )
        .where(
          and(
            eq(staffServices.businessId, b.id),
            eq(staffServices.serviceId, service.id),
          ),
        )
        .orderBy(asc(staffMembers.name))
    : [];
  const staffId = staff.some((x) => x.id === q.staff) ? q.staff : undefined;
  const extraAssignments = service ? await db.select({ staffId: staffServices.staffId, serviceId: staffServices.serviceId }).from(staffServices).where(and(eq(staffServices.businessId, b.id), inArray(staffServices.serviceId, catalog.map(item => item.id)))) : [];
  const supportsExtras = (candidateStaffId: string) => selectedExtraIds.every(id => extraAssignments.some(link => link.staffId === candidateStaffId && link.serviceId === id));
  const candidateStaffIds = staffId ? [staffId] : staff.map(member => member.id);
  const selectedCombinationCompatible = candidateStaffIds.some(candidateStaffId => supportsExtras(candidateStaffId));
  const compatibleExtraCatalog = service ? catalog.filter(item => item.id !== service.id && (selectedExtraIds.includes(item.id) || (service.additionalServiceMode !== "NONE" && (service.additionalServiceMode === "ALL" || allowedAdditionalIds.includes(item.id)) && candidateStaffIds.some(candidateStaffId => supportsExtras(candidateStaffId) && extraAssignments.some(link => link.staffId === candidateStaffId && link.serviceId === item.id))))) : [];
  const selectedDayStart=zonedLocalToUtc(`${date}T00:00`,b.timezone),selectedDayEnd=zonedLocalToUtc(`${after(date,1)}T00:00`,b.timezone);
  const bookedForDay=service&&service.capacity>1?await db.select({staffId:appointments.staffId,startsAt:appointments.startsAt,staffName:staffMembers.name}).from(appointments).innerJoin(staffMembers,eq(staffMembers.id,appointments.staffId)).where(and(eq(appointments.businessId,b.id),eq(appointments.serviceId,service.id),inArray(appointments.status,["BOOKED","CONFIRMED","ARRIVED"]),gte(appointments.startsAt,selectedDayStart),lt(appointments.startsAt,selectedDayEnd),staffId?eq(appointments.staffId,staffId):undefined)):[];
  const fullCourseSlots=service?Array.from(bookedForDay.reduce((map,item)=>{const key=`${item.staffId}|${item.startsAt.toISOString()}`,group=map.get(key)??{...item,count:0};group.count++;map.set(key,group);return map},new Map<string,{staffId:string;startsAt:Date;staffName:string;count:number}>()).values()).filter(item=>item.count>=service.capacity):[];
  let slots = service
    ? await getPublicAvailability({
        businessId: b.id,
        serviceId: service.id,
        date,
        durationMinutes: (
          completedServiceIds.has(service.id) &&
          service.repeatDurationMinutes != null
            ? service.repeatDurationMinutes
            : service.duration) + extraDuration,
        timezone: b.timezone,
        capacity:service.capacity,
      })
    : [];
  if (staffId) slots = slots.filter((x) => x.staffId === staffId);
  slots = slots.filter(x => supportsExtras(x.staffId));
  if (service && !slots.length && !service.waitlistEnabled)
    for (let i = 1; i <= 30 && !slots.length; i++) {
      const candidate = after(date, i);
      let found = await getPublicAvailability({
        businessId: b.id,
        serviceId: service.id,
        date: candidate,
        durationMinutes: (
          completedServiceIds.has(service.id) &&
          service.repeatDurationMinutes != null
            ? service.repeatDurationMinutes
            : service.duration) + extraDuration,
        timezone: b.timezone,
        capacity:service.capacity,
      });
      if (staffId) found = found.filter((x) => x.staffId === staffId);
      found = found.filter(x => supportsExtras(x.staffId));
      if (found.length) {
        date = candidate;
        slots = found;
      }
    }
  const grouped = new Map<string, typeof slots>();
  for (const x of slots)
    grouped.set(x.localStart, [...(grouped.get(x.localStart) ?? []), x]);
  const catalogByCategory = Object.entries(
    catalog.reduce<Record<string, typeof catalog>>((map, item) => {
      (map[item.category] ??= []).push(item);
      return map;
    }, {}),
  );
  const compact = [...grouped.entries()].map(([localStart, items]) => ({
    staffId: items[0].staffId,
    localStart,
    label: items[0].label,
    availableSeats: items[0].availableSeats,
    totalAvailableSeats: items.reduce((sum, item) => sum + item.availableSeats, 0),
    operatorsLabel: staffId
      ? items[0].staffName
      : items.length > 1
        ? `${items.length} operatori disponibili`
        : items[0].staffName,
  }));
  return (
    <main className="public-shell">
      <header className="public-header">
        {b.logoKey ? (
          <img
            src={`/api/media/view?salon=${slug}&kind=logo`}
            alt={`Logo ${b.name}`}
            style={{
              width: 64,
              height: 64,
              objectFit: "contain",
              borderRadius: 12,
            }}
          />
        ) : null}
        <div>
          <p className="eyebrow">Alpha Prenota · Prenotazione online</p>
          <h1>{b.name}</h1>
        </div>
        <div className="public-account-actions">
          <Link className="ghost-button link-button" href="/account">
            ← Area clienti
          </Link>
          {session ? (
            <LogoutButton redirectTo="/account/login" />
          ) : (
            <Link className="primary-button link-button" href="/account/login">
              Accedi
            </Link>
          )}
        </div>
      </header>
      {b.coverKey ? (
        <img
          src={`/api/media/view?salon=${slug}&kind=cover`}
          alt="Copertina salone"
          style={{
            width: "100%",
            maxHeight: 260,
            objectFit: "cover",
            borderRadius: 18,
            marginBottom: 20,
          }}
        />
      ) : null}
      {session ? (
        <section className="panel salon-benefits">
          <div>
            <strong>La tua Fidelity Card</strong>
            <p>{usablePoints} punti in questo salone</p>
            {loyalty ? (
              <p className="muted">
                <strong>Come ottieni i punti:</strong>{" "}
                {describePointAward(
                  loyalty.awardMode,
                  loyalty.spendCents,
                  loyalty.pointsAward,
                )}
              </p>
            ) : (
              <p className="muted">
                Il salone non ha ancora configurato l’assegnazione punti.
              </p>
            )}
          </div>
          <div>
            <strong>Obiettivi bonus</strong>
            {bonusRules.length ? (
              bonusRules.map((x, i) => (
                <p key={i}>
                  {x.points} punti ·{" "}
                  {x.type === "FREE_SERVICE"
                    ? "servizio omaggio"
                    : x.type === "DISCOUNT_PERCENT"
                      ? `${x.value}% di sconto`
                      : `€ ${(x.value / 100).toFixed(2)} di sconto`}
                </p>
              ))
            ) : loyalty ? (
              <p>Premio a {loyalty.rewardPoints} punti</p>
            ) : (
              <p className="muted">Nessun obiettivo attivo.</p>
            )}
          </div>
          <div>
            <strong>Promozioni attive</strong>
            {activePromotions.length ? (
              activePromotions.map((x, i) => (
                <p key={i}>
                  -{x.discount}% su{" "}
                  {catalog.find((service) => service.id === x.serviceId)
                    ?.name ?? "servizio"}{" "}
                  · fino al {x.endsAt.toLocaleDateString("it-IT")}
                </p>
              ))
            ) : (
              <p className="muted">Nessuna promozione attiva.</p>
            )}
          </div>
        </section>
      ) : null}
      <section className="booking-layout">
        <div>
          <h2>1. Scegli il servizio</h2>
          <div className="service-grid">
            {catalogByCategory.map(([category, items]) => (
              <details className="service-category" key={category}>
                <summary>
                  {category}
                  <span>Mostra/nascondi</span>
                </summary>
                <div className="service-grid">
                  {items.map((x) => {
                    const promo = promotionByService.get(x.id);
                    const personalizedBase =
                      completedServiceIds.has(x.id) &&
                      x.repeatPriceEnabled &&
                      x.repeatPrice != null
                        ? Number(x.repeatPrice)
                        : Number(x.price);
                    const discounted = promo
                      ? (personalizedBase * (100 - promo.discount)) / 100
                      : personalizedBase;
                    const personalizedDuration =
                      completedServiceIds.has(x.id) &&
                      x.repeatDurationMinutes != null
                        ? x.repeatDurationMinutes
                        : x.duration;
                    return (
                      <Link
                        scroll={false}
                        className={`service-card ${service?.id === x.id ? "selected" : ""}`}
                        href={`/s/${slug}?service=${x.id}&date=${today}`}
                        key={x.id}
                      >
                        <span className="eyebrow">{x.category}</span>
                        <h3>{x.name}</h3>
                        <p>
                          {x.description ||
                            "Trattamento dedicato al tuo benessere."}
                        </p>
                        {promo ? (
                          <p className="promotion-badge">
                            Promozione -{promo.discount}%
                          </p>
                        ) : null}
                        <strong>
                          {promo ? (
                            <>
                              <del>€ {personalizedBase.toFixed(2)}</del> €{" "}
                              {discounted.toFixed(2)}
                            </>
                          ) : x.repeatPriceEnabled && x.repeatPrice != null ? (
                            <>
                              Prima prenotazione € {Number(x.price).toFixed(2)}{" "}
                              · dalla seconda €{" "}
                              {Number(x.repeatPrice).toFixed(2)}
                            </>
                          ) : (
                            <>€ {Number(x.price).toFixed(2)}</>
                          )}{" "}
                          · {personalizedDuration} min
                          {x.capacity>1?<> · {x.capacity} posti</>:null}
                          {x.repeatDurationMinutes != null ? (
                            <> (prima: {x.duration} min)</>
                          ) : null}
                        </strong>
                      </Link>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </div>
        {service ? (
          <div className="booking-panel">
            <h2>2. Scegli quando e con chi</h2>
            <BookingFilters
              slug={slug}
      serviceId={service.id}
              date={date}
              staffId={staffId}
              staff={staff}
              minimumDate={today}
              extras={selectedExtraIds.join(",")}
            />
            <details className="service-category"><summary>Aggiungi altri servizi<span>{selectedExtras.length ? `${selectedExtras.length} selezionati` : "Facoltativo"}</span></summary>{compatibleExtraCatalog.length ? <div className="service-grid">{compatibleExtraCatalog.map(item => { const active = selectedExtraIds.includes(item.id); const next = active ? selectedExtraIds.filter(id => id !== item.id) : [...selectedExtraIds, item.id].slice(0, 5); const query = new URLSearchParams({ service: service.id, date }); if (staffId) query.set("staff", staffId); if (next.length) query.set("extras", next.join(",")); return <Link className={`service-card ${active ? "selected" : ""}`} href={`/s/${slug}?${query}`} key={item.id}><strong>{active ? "✓ " : "+ "}{item.name}</strong><p>€ {Number(item.price).toFixed(2)} · {item.addsDuration ? `+${item.duration} min` : "nessun tempo aggiuntivo"}</p></Link>})}</div> : <p className="empty-state">Nessun altro servizio compatibile con {staffId ? "l’operatore scelto" : "questa combinazione"}.</p>}</details>
            {!selectedCombinationCompatible && selectedExtras.length ? <p className="error-message">L’operatore scelto non esegue tutti i servizi selezionati. Rimuovi il servizio incompatibile oppure scegli un altro operatore.</p> : null}
            {compact.length ? (
              <>
                <p className="muted">
                  Prima data utile: <strong>{date}</strong>
                </p>
                <BookingDetailsForm
                  action={createPublicAppointment}
                  slug={slug}
                  serviceId={service.id}
                  slots={compact}
                  name={session?.user.name ?? ""}
                  email={session?.user.email ?? ""}
                  phone={profile?.phone ?? ""}
                  rewards={availableBonusRules}
                  basePrice={
                    completedServiceIds.has(service.id) &&
                    service.repeatPriceEnabled &&
                    service.repeatPrice != null
                      ? Number(service.repeatPrice)
                      : Number(service.price)
                  }
                  promotionDiscount={
                    promotionByService.get(service.id)?.discount ?? 0
                  }
                  allowRewardStacking={loyalty?.allowRewardStacking ?? false}
                  additionalServiceIds={selectedExtraIds}
                  additionalPrice={extraPrice}
                  additionalDuration={extraDuration}
                  showAvailableSeats={service.capacity > 1 || compact.some(slot => slot.totalAvailableSeats > 1)}
                />
              </>
            ) : (
              <p className="empty-state">
                Nessuna disponibilità per questa data.
              </p>
            )}
            {q.waitlist?<p className="success-message">Iscrizione alla lista d’attesa registrata. Riceverai un’email se si libera un posto.</p>:null}
            {service.waitlistEnabled && !selectedExtras.length && !compact.length ? <details className="service-category waitlist-panel" open><summary>Lista d’attesa per la giornata<span>{date}</span></summary><form action={joinDayWaitlist} className="compact-form stacked panel"><input type="hidden" name="slug" value={slug}/><input type="hidden" name="serviceId" value={service.id}/><input type="hidden" name="date" value={date}/><input type="hidden" name="staffId" value={staffId ?? ""}/><p>Nessun orario disponibile. Iscriviti e riceverai automaticamente un’email appena si libera un posto{staffId ? " con l’operatore scelto" : " con qualsiasi operatore"}.</p><input name="customerName" defaultValue={session?.user.name??""} placeholder="Nome e cognome" required/><input name="email" type="email" defaultValue={session?.user.email??""} placeholder="Email" required/><input name="phone" defaultValue={profile?.phone??""} placeholder="Telefono" required/><button className="primary-button">Avvisami se si libera un posto</button></form></details> : null}
            {service.waitlistEnabled&&!selectedExtras.length&&fullCourseSlots.length?<details className="service-category waitlist-panel"><summary>Iscriviti alla lista d’attesa<span>{fullCourseSlots.length} orari completi</span></summary><div className="service-grid">{fullCourseSlots.map(slot=><form action={joinServiceWaitlist} className="compact-form stacked panel" key={`${slot.staffId}-${slot.startsAt.toISOString()}`}><input type="hidden" name="slug" value={slug}/><input type="hidden" name="serviceId" value={service.id}/><input type="hidden" name="staffId" value={slot.staffId}/><input type="hidden" name="startsAt" value={slot.startsAt.toLocaleString("sv-SE",{timeZone:b.timezone}).replace(" ","T").slice(0,16)}/><strong>{slot.startsAt.toLocaleString("it-IT",{dateStyle:"long",timeStyle:"short",timeZone:b.timezone})} · {slot.staffName}</strong><input name="customerName" defaultValue={session?.user.name??""} placeholder="Nome e cognome" required/><input name="email" type="email" defaultValue={session?.user.email??""} placeholder="Email" required/><input name="phone" defaultValue={profile?.phone??""} placeholder="Telefono" required/><button className="primary-button">Entra in lista d’attesa</button></form>)}</div></details>:null}
          </div>
        ) : (
          <aside className="booking-panel empty-prompt">
            <p>Seleziona un servizio.</p>
          </aside>
        )}
      </section>
    </main>
  );
}
