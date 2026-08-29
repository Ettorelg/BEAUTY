import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db/client";
import { appointments, customerRelations } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { AppNav } from "../app-nav";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const context = await requireBusinessContext();
  const { q = "" } = await searchParams;
  const term = q.trim();
  const customers = await db.select({ id: customerRelations.id, name: customerRelations.name, email: customerRelations.email, phone: customerRelations.phone,
    notes: customerRelations.notes, lastAppointment: appointments.startsAt, lastService: appointments.serviceName })
    .from(customerRelations).leftJoin(appointments, and(eq(appointments.customerRelationId, customerRelations.id), eq(appointments.businessId, context.businessId)))
    .where(and(eq(customerRelations.businessId, context.businessId), term ? ilike(customerRelations.name, `%${term}%`) : undefined))
    .orderBy(desc(appointments.startsAt));
  const unique = Array.from(new Map(customers.map((item) => [item.id, item])).values());
  return <main className="dashboard-shell"><AppNav businessName={context.businessName} role={context.role}/>
    <div className="page-heading"><div><p className="eyebrow">Relazioni</p><h1>Clienti</h1></div><p className="muted">Anagrafica e ultimo appuntamento del tuo salone.</p></div>
    <form className="customer-search" method="get"><input name="q" defaultValue={term} placeholder="Cerca per nome"/><button className="ghost-button">Cerca</button></form>
    <section className="list-section">{unique.length ? <div className="data-list">{unique.map((customer) => <article className="data-row" key={customer.id}><div><h3>{customer.name}</h3><p className="muted">{[customer.email, customer.phone].filter(Boolean).join(" · ") || "Contatti non inseriti"}</p>{customer.lastAppointment ? <p>Ultimo appuntamento: {customer.lastAppointment.toLocaleString("it-IT", { timeZone: context.timezone })} · {customer.lastService}</p> : <p className="muted">Nessun appuntamento registrato.</p>}{customer.notes ? <p>{customer.notes}</p> : null}</div></article>)}</div> : <div className="empty-state">{term ? "Nessun cliente trovato." : "Nessun cliente ancora."}</div>}</section>
  </main>;
}
