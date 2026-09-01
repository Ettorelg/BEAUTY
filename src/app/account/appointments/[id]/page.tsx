import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { appointments, businesses, customerRelations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getPublicAvailability } from "@/modules/availability/application/public-availability";
import { rescheduleCustomerAppointment } from "../../actions";

export default async function CustomerReschedulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/account/login");
  const { id } = await params;
  const [booking] = await db.select({
    id: appointments.id, businessId: appointments.businessId, businessName: businesses.name,
    serviceId: appointments.serviceId, serviceName: appointments.serviceName, duration: appointments.durationMinutes,
    startsAt: appointments.startsAt, timezone: appointments.timezone, status: appointments.status,
  }).from(appointments).innerJoin(customerRelations, and(eq(customerRelations.id, appointments.customerRelationId), eq(customerRelations.userId, session.user.id)))
    .innerJoin(businesses, eq(businesses.id, appointments.businessId)).where(eq(appointments.id, id)).limit(1);
  if (!booking) notFound();
  const editable = ["BOOKED", "CONFIRMED"].includes(booking.status) && booking.startsAt.getTime() - Date.now() >= 60 * 60 * 1000;
  const query = await searchParams;
  const defaultDate = new Intl.DateTimeFormat("en-CA", { timeZone: booking.timezone }).format(booking.startsAt);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date! : defaultDate;
  const slots = editable ? await getPublicAvailability({ businessId: booking.businessId, serviceId: booking.serviceId, date, durationMinutes: booking.duration, timezone: booking.timezone }) : [];
  const current = booking.startsAt.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short", timeZone: booking.timezone });
  return <main className="customer-shell"><header className="app-header"><div><p className="eyebrow">Area clienti</p><strong>Modifica prenotazione</strong></div><Link className="ghost-button link-button" href="/account">Torna alle prenotazioni</Link></header>
    <section className="page-heading"><div><p className="eyebrow">{booking.businessName}</p><h1>{booking.serviceName}</h1></div><p className="muted">Appuntamento attuale: <strong>{current}</strong></p></section>
    {!editable ? <div className="empty-state">Questa prenotazione non può più essere modificata online. La modifica è consentita fino a un’ora prima.</div> : <section className="panel"><h2>Scegli la nuova data</h2><form method="get" className="compact-form"><input name="date" type="date" defaultValue={date} min={new Intl.DateTimeFormat("en-CA", { timeZone: booking.timezone }).format(new Date())}/><button className="ghost-button">Mostra disponibilità</button></form><h2>Orari e operatori disponibili</h2>{slots.length ? <div className="slot-grid">{slots.map(slot => <form action={rescheduleCustomerAppointment} key={`${slot.staffId}-${slot.localStart}`}><input type="hidden" name="id" value={booking.id}/><input type="hidden" name="staffId" value={slot.staffId}/><input type="hidden" name="startsAt" value={slot.localStart}/><button className="ghost-button" title={`Sposta con ${slot.staffName}`}>{slot.label} · {slot.staffName}</button></form>)}</div> : <p className="muted">Nessuna disponibilità per questa data. Seleziona un altro giorno.</p>}<p className="muted">Il vecchio orario verrà liberato soltanto dopo la conferma del nuovo slot.</p></section>}
  </main>;
}