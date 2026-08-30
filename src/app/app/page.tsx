import { and, asc, count, eq, gte, lt, notInArray } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { appointments, customerRelations, services, staffMembers } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";
import { AppNav } from "./app-nav";
import { ShareBookingLink } from "./share-booking-link";
import { QRBookingCode } from "./qr-booking-code";

const statusLabel: Record<string, string> = {
  BOOKED: "Prenotato",
  CONFIRMED: "Confermato",
  ARRIVED: "Arrivato",
  COMPLETED: "Eseguito",
};

export default async function AppPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session && isSuperAdminEmail(session.user.email)) redirect("/admin/licenses");

  const context = await requireBusinessContext();
  if (context.role === "STAFF") redirect("/app/agenda");

  const bookingUrl = `${process.env.APP_URL ?? "https://beauty.alphasystemsrl.it"}/s/${context.businessSlug}`;
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: context.timezone }).format(now);
  const tomorrowDate = new Date(`${today}T12:00:00Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const dayStart = zonedLocalToUtc(`${today}T00:00`, context.timezone);
  const dayEnd = zonedLocalToUtc(`${tomorrow}T00:00`, context.timezone);

  const [todayAppointments, [serviceTotal], [staffTotal], [customerTotal]] = await Promise.all([
    db.select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      customerName: customerRelations.name,
      serviceName: appointments.serviceName,
      staffName: staffMembers.name,
      status: appointments.status,
    })
      .from(appointments)
      .innerJoin(customerRelations, eq(customerRelations.id, appointments.customerRelationId))
      .innerJoin(staffMembers, eq(staffMembers.id, appointments.staffId))
      .where(and(
        eq(appointments.businessId, context.businessId),
        gte(appointments.startsAt, dayStart),
        lt(appointments.startsAt, dayEnd),
        notInArray(appointments.status, ["CANCELLED", "NO_SHOW"]),
      ))
      .orderBy(asc(appointments.startsAt)),
    db.select({ value: count() }).from(services).where(and(eq(services.businessId, context.businessId), eq(services.active, true))),
    db.select({ value: count() }).from(staffMembers).where(and(eq(staffMembers.businessId, context.businessId), eq(staffMembers.active, true))),
    db.select({ value: count() }).from(customerRelations).where(eq(customerRelations.businessId, context.businessId)),
  ]);

  const remaining = todayAppointments.filter((item) => item.startsAt >= now && item.status !== "COMPLETED");
  const completed = todayAppointments.filter((item) => item.status === "COMPLETED").length;
  const time = new Intl.DateTimeFormat("it-IT", { timeZone: context.timezone, hour: "2-digit", minute: "2-digit" });

  return <main className="dashboard-shell">
    <AppNav businessName={context.businessName} role={context.role}/>

    <section className="dashboard-hero">
      <div>
        <p className="eyebrow">{context.locationName} · oggi</p>
        <h1>Ciao, {context.user.name}.</h1>
        <p>Hai <strong>{remaining.length}</strong> {remaining.length === 1 ? "appuntamento" : "appuntamenti"} ancora in programma oggi.</p>
      </div>
      <div className="dashboard-hero-actions">
        <Link className="primary-button link-button" href={`/app/agenda?date=${today}&view=day`}>Apri agenda di oggi</Link>
        <Link className="ghost-button link-button" href={bookingUrl}>Vedi pagina clienti</Link>
      </div>
    </section>

    <section className="dashboard-summary" aria-label="Riepilogo attività">
      <Link href={`/app/agenda?date=${today}&view=day`}><strong>{todayAppointments.length}</strong><span>Appuntamenti oggi</span><small>{completed} eseguiti</small></Link>
      <Link href="/app/customers"><strong>{customerTotal.value}</strong><span>Clienti</span><small>Apri anagrafiche</small></Link>
      <Link href="/app/staff"><strong>{staffTotal.value}</strong><span>Operatori attivi</span><small>Turni e disponibilità</small></Link>
      <Link href="/app/services"><strong>{serviceTotal.value}</strong><span>Servizi attivi</span><small>Gestisci listino</small></Link>
    </section>

    <section className="dashboard-main-grid">
      <article className="panel dashboard-today">
        <div className="dashboard-section-heading"><div><p className="eyebrow">Prossimi appuntamenti</p><h2>La giornata a colpo d’occhio</h2></div><Link href={`/app/agenda?date=${today}&view=day`}>Vedi agenda completa →</Link></div>
        {remaining.length ? <div className="dashboard-appointment-list">{remaining.slice(0, 5).map((item) => <Link href={`/app/agenda?date=${today}&view=day`} key={item.id}>
          <time>{time.format(item.startsAt)}</time>
          <span><strong>{item.customerName}</strong><small>{item.serviceName} · {item.staffName}</small></span>
          <em>{statusLabel[item.status] ?? item.status}</em>
        </Link>)}</div> : <div className="empty-state">Nessun altro appuntamento per oggi.</div>}
      </article>

      <aside className="panel dashboard-actions">
        <p className="eyebrow">Azioni rapide</p>
        <h2>Cosa vuoi fare?</h2>
        <Link className="dashboard-action primary" href={`/app/agenda?date=${today}&view=day&new=1`}><span>＋</span><div><strong>Nuova prenotazione</strong><small>Inserisci un appuntamento</small></div></Link>
        <Link className="dashboard-action" href="/app/customers"><span>⌕</span><div><strong>Cerca un cliente</strong><small>Anagrafica e storico</small></div></Link>
        <Link className="dashboard-action" href="/app/fidelity"><span>★</span><div><strong>Fidelity e promozioni</strong><small>Regole, punti e offerte</small></div></Link>
        <Link className="dashboard-action" href="/app/statistics"><span>↗</span><div><strong>Controlla statistiche</strong><small>Incassi e andamento</small></div></Link>
      </aside>
    </section>

    <details className="dashboard-share-section">
      <summary>Condividi la pagina di prenotazione</summary>
      <p className="muted">Link e QR code da inviare o mostrare ai clienti.</p>
      <div className="management-grid"><ShareBookingLink url={bookingUrl}/><QRBookingCode url={bookingUrl}/></div>
    </details>
  </main>;
}
