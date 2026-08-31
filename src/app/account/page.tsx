import { and, desc, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/app/logout-button";
import { db } from "@/db/client";
import { appointments, businesses, businessMemberships, customerRelations, fidelityCards, fidelityRedemptions, serviceCategories, services, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { cancelCustomerAppointment } from "./actions";
import { SalonLinkOpener } from "./salon-link-opener";

const labels: Record<string, string> = {
  BOOKED: "Prenotato",
  CONFIRMED: "Confermato",
  ARRIVED: "Arrivato",
  COMPLETED: "Eseguito",
  CANCELLED: "Cancellato",
  NO_SHOW: "Non presentato",
};
const concludedStatuses = new Set(["COMPLETED", "CANCELLED", "NO_SHOW"]);

function googleCalendarUrl(booking: { serviceName: string; businessName: string; startsAt: Date; endsAt: Date }) {
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: `${booking.serviceName} · ${booking.businessName}`,
    dates: `${stamp(booking.startsAt)}/${stamp(booking.endsAt)}`,
    details: "Prenotazione effettuata tramite Alpha Beauty",
  });
  return `https://calendar.google.com/calendar/render?${query}`;
}

export default async function CustomerAccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/account/login");
  const [profile] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (session.user.emailVerified) {
    await db.update(customerRelations).set({ userId: session.user.id, updatedAt: new Date() }).where(and(isNull(customerRelations.userId), eq(customerRelations.email, session.user.email.toLowerCase())));
  }

  const [bookings, professionalAccess, cards, redemptions] = await Promise.all([
    db
      .select({
        id: appointments.id,
        businessId: appointments.businessId,
        businessName: businesses.name,
        slug: businesses.slug,
        logoKey: businesses.logoKey,
        serviceName: appointments.serviceName,
        categoryName: serviceCategories.name,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        timezone: appointments.timezone,
        price: appointments.price,
        status: appointments.status,
      })
      .from(appointments)
      .innerJoin(customerRelations, eq(customerRelations.id, appointments.customerRelationId))
      .innerJoin(businesses, eq(businesses.id, appointments.businessId))
      .leftJoin(services, eq(services.id, appointments.serviceId))
      .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
      .where(eq(customerRelations.userId, session.user.id))
      .orderBy(desc(appointments.startsAt)),
    db.select({ role: businessMemberships.role }).from(businessMemberships).where(eq(businessMemberships.userId, session.user.id)).limit(1),
    db
      .select({ businessId: fidelityCards.businessId, points: fidelityCards.points, expiresAt: fidelityCards.pointsExpiresAt })
      .from(fidelityCards)
      .innerJoin(customerRelations, eq(customerRelations.id, fidelityCards.customerRelationId))
      .where(eq(customerRelations.userId, session.user.id)),
    db
      .select({
        id: fidelityRedemptions.id,
        businessName: businesses.name,
        points: fidelityRedemptions.pointsSpent,
        type: fidelityRedemptions.rewardType,
        value: fidelityRedemptions.rewardValue,
        createdAt: fidelityRedemptions.createdAt,
        reversedAt: fidelityRedemptions.reversedAt,
      })
      .from(fidelityRedemptions)
      .innerJoin(customerRelations, eq(customerRelations.id, fidelityRedemptions.customerRelationId))
      .innerJoin(businesses, eq(businesses.id, fidelityRedemptions.businessId))
      .where(eq(customerRelations.userId, session.user.id))
      .orderBy(desc(fidelityRedemptions.createdAt)),
  ]);

  const now = new Date();
  const pendingBookings = bookings.filter((booking) => !concludedStatuses.has(booking.status));
  const concludedBookings = bookings.filter((booking) => concludedStatuses.has(booking.status));
  const pendingByCategory = Object.entries(pendingBookings.reduce<Record<string, typeof bookings>>((map, booking) => {
    const key = booking.categoryName ?? "Altri servizi";
    (map[key] ??= []).push(booking);
    return map;
  }, {}));
  const pointsByBusiness = new Map(cards.map((card) => [card.businessId, card.points]));
  const salons = [...new Map(bookings.map((booking) => [booking.slug, {
    name: booking.businessName,
    slug: booking.slug,
    businessId: booking.businessId,
    logoKey: booking.logoKey,
  }])).values()];

  return <main className="customer-account-shell">
    <nav className="customer-top-nav"><span>Area clienti</span><LogoutButton redirectTo="/account/login" /></nav>
    <header className="customer-account-header">
      <div><p className="eyebrow">Area clienti</p><h1>Ciao, {session.user.name || "benvenuto"}.</h1><p className="muted">Prenotazioni, saloni e premi in un unico posto.</p></div>
      {professionalAccess.length ? <div className="button-row"><Link className="ghost-button link-button" href="/app">Accedi come titolare/staff</Link></div> : null}
    </header>

    <details className="customer-collapsible">
      <summary>I miei dati</summary>
      <section className="panel customer-profile-card"><p><strong>Nome:</strong> {session.user.name || "—"}</p><p><strong>Email:</strong> {session.user.email}</p><p><strong>Telefono:</strong> {profile?.phone || "Non inserito"}</p><Link className="ghost-button link-button" href="/account/phone?edit=1">Modifica telefono</Link></section>
    </details>

    <SalonLinkOpener />

    <section className="list-section">
      <h2>I miei saloni</h2>
      {salons.length ? <div className="data-list">{salons.map((salon) => <article className="data-row" key={salon.slug}>
        <div className="salon-search-identity">
          {salon.logoKey ? <img src={`/api/media/view?salon=${salon.slug}&kind=logo`} alt={`Logo ${salon.name}`} className="salon-search-logo" /> : <span className="salon-search-logo salon-search-logo-fallback">{salon.name.slice(0, 1).toUpperCase()}</span>}
          <div><h3>{salon.name}</h3><p className="muted">{pointsByBusiness.get(salon.businessId) ?? 0} punti Fidelity</p></div>
        </div>
        <Link className="primary-button link-button" href={`/s/${salon.slug}`}>Prenota di nuovo</Link>
      </article>)}</div> : <div className="empty-state">I saloni compariranno dopo la prima prenotazione.</div>}
    </section>

    <details className="customer-collapsible" open>
      <summary>Le mie prenotazioni in sospeso ({pendingBookings.length})</summary>
      <section className="list-section">
        <h2>In sospeso</h2>
        {pendingBookings.length ? <div className="data-list">{pendingByCategory.map(([category, items]) => <section className="panel" key={category}>
          <p className="eyebrow">Categoria</p><h3>{category}</h3>
          {items.map((booking) => {
            const cancellable = booking.startsAt.getTime() - now.getTime() >= 60 * 60 * 1000 && ["BOOKED", "CONFIRMED"].includes(booking.status);
            return <article className="data-row customer-booking-row" key={booking.id}>
              <div><p className="eyebrow">{labels[booking.status] ?? booking.status}</p><h3>{booking.serviceName} · {booking.businessName}</h3><p className="muted">{booking.startsAt.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short", timeZone: booking.timezone })}</p><strong>€ {Number(booking.price).toFixed(2)}</strong></div>
              <div className="customer-booking-actions">
                {booking.startsAt > now ? <a className="ghost-button link-button" href={googleCalendarUrl(booking)} target="_blank" rel="noreferrer">Aggiungi al calendario</a> : null}
                {cancellable ? <form action={cancelCustomerAppointment}><input type="hidden" name="id" value={booking.id} /><button className="danger-button">Annulla</button></form> : null}
              </div>
            </article>;
          })}
        </section>)}</div> : <div className="empty-state">Non ci sono prenotazioni in sospeso.</div>}
      </section>
    </details>

    <details className="customer-collapsible">
      <summary>Prenotazioni concluse ({concludedBookings.length})</summary>
      <section className="list-section customer-history-list">
        {concludedBookings.length ? <div className="data-list">{concludedBookings.map((booking) => <article className="data-row customer-booking-row" key={booking.id}>
          <div><p className="eyebrow">{labels[booking.status] ?? booking.status}</p><h3>{booking.serviceName} · {booking.businessName}</h3><p className="muted">{booking.startsAt.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: booking.timezone })}</p></div>
          <strong>€ {Number(booking.price).toFixed(2)}</strong>
        </article>)}</div> : <div className="empty-state">Nessuna prenotazione conclusa.</div>}
      </section>
    </details>

    <details className="customer-collapsible">
      <summary>Storico premi Fidelity</summary>
      <section className="list-section">{redemptions.length ? <div className="data-list">{redemptions.map((redemption) => <article className="data-row" key={redemption.id}><div><h3>{redemption.businessName}</h3><p>{redemption.points} punti utilizzati · {redemption.type === "FREE_SERVICE" ? "Servizio omaggio" : redemption.type === "DISCOUNT_PERCENT" ? `${redemption.value}% di sconto` : `€ ${(redemption.value / 100).toFixed(2)} di sconto`}</p><p className="muted">{redemption.createdAt.toLocaleDateString("it-IT")} · {redemption.reversedAt ? "Punti restituiti" : "Utilizzato"}</p></div></article>)}</div> : <div className="empty-state">Nessun premio utilizzato.</div>}</section>
    </details>
  </main>;
}
