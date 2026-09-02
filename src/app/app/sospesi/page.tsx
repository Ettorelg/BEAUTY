import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { appointments, customerRelations, staffMembers } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensurePaymentSchema } from "@/lib/ensure-payment-schema";
import { AppNav } from "../app-nav";
import { markOutstandingPaid } from "./actions";

export default async function OutstandingPaymentsPage() {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") redirect("/app/agenda");
  await ensurePaymentSchema();
  const rows = await db.select({
    id: appointments.id,
    customerId: customerRelations.id,
    customerName: customerRelations.name,
    email: customerRelations.email,
    phone: customerRelations.phone,
    serviceName: appointments.serviceName,
    price: appointments.price,
    startsAt: appointments.startsAt,
    staffName: staffMembers.name,
  }).from(appointments)
    .innerJoin(customerRelations, eq(customerRelations.id, appointments.customerRelationId))
    .innerJoin(staffMembers, eq(staffMembers.id, appointments.staffId))
    .where(and(
      eq(appointments.businessId, context.businessId),
      eq(appointments.status, "COMPLETED"),
      eq(appointments.paymentStatus, "UNPAID"),
    )).orderBy(asc(customerRelations.name), asc(appointments.startsAt));
  const total = rows.reduce((sum, row) => sum + Number(row.price), 0);
  const groups = [...rows.reduce((map, row) => {
    const group = map.get(row.customerId) ?? { customerId: row.customerId, name: row.customerName, email: row.email, phone: row.phone, rows: [] as typeof rows };
    group.rows.push(row);
    map.set(row.customerId, group);
    return map;
  }, new Map<string, { customerId: string; name: string; email: string | null; phone: string | null; rows: typeof rows }>()).values()];

  return <main className="dashboard-shell">
    <AppNav businessName={context.businessName} role={context.role}/>
    <div className="page-heading"><div><p className="eyebrow">Contabilità clienti</p><h1>Pagamenti sospesi</h1><p className="muted">Segna come pagata ogni singola prestazione dopo aver ricevuto il saldo.</p></div></div>
    <section className="module-grid"><article className="module-card"><h2>€ {total.toFixed(2)}</h2><p>Totale da incassare</p></article><article className="module-card"><h2>{rows.length}</h2><p>Prestazioni da saldare</p></article><article className="module-card"><h2>{groups.length}</h2><p>Clienti con sospesi</p></article></section>
    <section className="list-section">{groups.length ? <div className="data-list">{groups.map((group) => <article className="panel" key={group.customerId}>
      <div className="data-row"><div><h2>{group.name}</h2><p className="muted">{[group.email, group.phone].filter(Boolean).join(" · ")}</p></div><div><strong>Totale € {group.rows.reduce((sum, row) => sum + Number(row.price), 0).toFixed(2)}</strong><br/><Link className="ghost-button link-button" href={`/app/customers/${group.customerId}`}>Scheda cliente</Link></div></div>
      <div className="data-list">{group.rows.map((row) => <div className="data-row" key={row.id}><div><strong>{row.serviceName} · € {Number(row.price).toFixed(2)}</strong><p className="muted">{row.startsAt.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short", timeZone: context.timezone })} · {row.staffName}</p></div><form action={markOutstandingPaid}><input type="hidden" name="id" value={row.id}/><button className="primary-button">Segna come pagato</button></form></div>)}</div>
    </article>)}</div> : <div className="empty-state">Non ci sono pagamenti in sospeso.</div>}</section>
  </main>;
}

