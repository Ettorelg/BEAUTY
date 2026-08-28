import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { appointments, customerRelations, services, staffMembers, staffServices } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { AppNav } from "../app-nav";
import { changeAppointmentStatus, createAppointment } from "./actions";

const statusLabels: Record<string, string> = { BOOKED: "Prenotato", CONFIRMED: "Confermato", ARRIVED: "Arrivato", COMPLETED: "Completato", CANCELLED: "Cancellato", NO_SHOW: "Non presentato" };

export default async function AgendaPage() {
  const context = await requireBusinessContext();
  const staff = await db.select({ id: staffMembers.id, name: staffMembers.name }).from(staffMembers)
    .where(and(eq(staffMembers.businessId, context.businessId), eq(staffMembers.active, true))).orderBy(asc(staffMembers.name));
  const catalog = await db.select({ staffId: staffServices.staffId, id: services.id, name: services.name, duration: services.durationMinutes })
    .from(staffServices).innerJoin(services, and(eq(staffServices.serviceId, services.id), eq(services.businessId, context.businessId), eq(services.active, true)))
    .where(eq(staffServices.businessId, context.businessId)).orderBy(asc(services.name));
  const entries = await db.select({ id: appointments.id, startsAt: appointments.startsAt, status: appointments.status, serviceName: appointments.serviceName,
    customerName: customerRelations.name, staffName: staffMembers.name, notes: appointments.notes })
    .from(appointments)
    .innerJoin(customerRelations, and(eq(appointments.customerRelationId, customerRelations.id), eq(customerRelations.businessId, context.businessId)))
    .innerJoin(staffMembers, and(eq(appointments.staffId, staffMembers.id), eq(staffMembers.businessId, context.businessId)))
    .where(and(eq(appointments.businessId, context.businessId), gte(appointments.endsAt, new Date()))).orderBy(asc(appointments.startsAt));

  return <main className="dashboard-shell"><AppNav businessName={context.businessName} role={context.role}/>
    <div className="page-heading"><div><p className="eyebrow">Operatività</p><h1>Agenda</h1></div><p className="muted">Appuntamenti futuri e avanzamento del servizio.</p></div>
    <section className="management-grid"><article className="panel"><h2>Nuovo appuntamento</h2>{staff.length && catalog.length ? <form action={createAppointment} className="compact-form stacked">
      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()}/><input name="customerName" placeholder="Nome cliente" required minLength={2}/>
      <div className="form-row"><input name="email" type="email" placeholder="Email"/><input name="phone" type="tel" placeholder="Telefono"/></div>
      <label>Operatore<select name="staffId" required>{staff.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>Servizio<select name="serviceId" required>{catalog.map(item=><option value={item.id} key={`${item.staffId}-${item.id}`}>{item.name} · {item.duration} min</option>)}</select></label>
      <label>Data e ora ({context.timezone})<input name="startsAt" type="datetime-local" required/></label><textarea name="notes" placeholder="Note (opzionali)" maxLength={500}/><button className="primary-button">Prenota</button>
    </form> : <p className="muted">Configura almeno un operatore con un servizio associato.</p>}</article></section>
    <section className="list-section"><h2>Prossimi appuntamenti</h2>{entries.length ? <div className="data-list">{entries.map(item=><article className="data-row" key={item.id}><div><p className="eyebrow">{statusLabels[item.status] ?? item.status}</p><h3>{item.customerName} · {item.serviceName}</h3><p className="muted">{item.startsAt.toLocaleString("it-IT", { timeZone: context.timezone })} · {item.staffName}</p>{item.notes ? <p>{item.notes}</p> : null}</div><form action={changeAppointmentStatus} className="inline-actions"><input type="hidden" name="id" value={item.id}/><select name="status" defaultValue="CONFIRMED"><option value="CONFIRMED">Conferma</option><option value="ARRIVED">Arrivato</option><option value="COMPLETED">Completa</option><option value="CANCELLED">Cancella</option><option value="NO_SHOW">Non presentato</option></select><button className="ghost-button">Aggiorna</button></form></article>)}</div> : <div className="empty-state">Nessun appuntamento futuro.</div>}</section>
  </main>;
}
