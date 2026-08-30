import { and, asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { appointments, customerRelations, fidelityCards, fidelityRedemptions, fidelityRules, services, staffMembers } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensureFidelitySchema } from "@/lib/ensure-fidelity-schema";
import { AppNav } from "../../app-nav";
import { mergeDuplicateCustomers, redeemFidelityReward } from "./actions";

const rewardLabel = (type: string, value: number, service?: string | null) => type === "FREE_SERVICE"
  ? `Servizio omaggio: ${service ?? "servizio"}`
  : type === "DISCOUNT_PERCENT" ? `${value}% di sconto` : `€ ${(value / 100).toFixed(2)} di sconto`;

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireBusinessContext();
  const { id } = await params;
  await ensureFidelitySchema();
  const [customer] = await db.select().from(customerRelations).where(and(
    eq(customerRelations.id, id),
    eq(customerRelations.businessId, context.businessId),
  )).limit(1);
  if (!customer) notFound();

  const [history, [card], rules, redemptions, catalog] = await Promise.all([
    db.select({ id: appointments.id, startsAt: appointments.startsAt, status: appointments.status, service: appointments.serviceName, price: appointments.price, staff: staffMembers.name })
      .from(appointments).innerJoin(staffMembers, eq(appointments.staffId, staffMembers.id))
      .where(and(eq(appointments.businessId, context.businessId), eq(appointments.customerRelationId, id)))
      .orderBy(asc(appointments.startsAt)),
    db.select({ points: fidelityCards.points, number: fidelityCards.cardNumber }).from(fidelityCards)
      .where(and(eq(fidelityCards.businessId, context.businessId), eq(fidelityCards.customerRelationId, id))).limit(1),
    db.select().from(fidelityRules).where(eq(fidelityRules.businessId, context.businessId)).orderBy(asc(fidelityRules.points)),
    db.select().from(fidelityRedemptions).where(and(eq(fidelityRedemptions.businessId, context.businessId), eq(fidelityRedemptions.customerRelationId, id))).orderBy(desc(fidelityRedemptions.createdAt)),
    db.select({ id: services.id, name: services.name }).from(services).where(eq(services.businessId, context.businessId)),
  ]);
  const names = new Map(catalog.map((service) => [service.id, service.name]));
  const done = history.filter((appointment) => appointment.status === "COMPLETED");
  const spent = done.reduce((total, appointment) => total + Number(appointment.price), 0);
  const serviceStats = Object.values(done.reduce<Record<string, { name: string; count: number }>>((map, appointment) => {
    map[appointment.service] ??= { name: appointment.service, count: 0 };
    map[appointment.service].count++;
    return map;
  }, {}));
  const last = done.at(-1);

  return <main className="dashboard-shell">
    <AppNav businessName={context.businessName} role={context.role}/>
    <Link className="ghost-button link-button" href="/app/customers">← Clienti</Link>
    <div className="page-heading"><div><p className="eyebrow">Scheda cliente</p><h1>{customer.name}</h1><p className="muted">{[customer.email, customer.phone].filter(Boolean).join(" · ")}</p></div></div>
    <section className="module-grid">
      <article className="module-card"><h2>€ {spent.toFixed(2)}</h2><p>Spesa totale</p></article>
      <article className="module-card"><h2>{done.length}</h2><p>Servizi eseguiti</p></article>
      <article className="module-card"><h2>{last?.service ?? "—"}</h2><p>Ultimo servizio</p></article>
      <article className="module-card"><h2>{card?.points ?? 0}</h2><p>Punti Fidelity</p></article>
    </section>
    <section className="management-grid">
      <article className="panel"><h2>Servizi effettuati</h2>{serviceStats.length ? serviceStats.map((service) => <p key={service.name}><strong>{service.name}</strong> · {service.count} ({Math.round(service.count / done.length * 100)}%)</p>) : <p className="muted">Nessun servizio eseguito.</p>}</article>
      <article className="panel"><h2>Esiti</h2><p>Cancellati: {history.filter((a) => a.status === "CANCELLED").length}</p><p>Non presentato: {history.filter((a) => a.status === "NO_SHOW").length}</p></article>
    </section>
    {context.role === "OWNER" ? <section className="management-grid">
      <article className="panel"><h2>Riscatta premio Fidelity</h2>{rules.length ? <div className="data-list">{rules.map((rule) => <form action={redeemFidelityReward} className="data-row" key={rule.id}><input type="hidden" name="customerId" value={id}/><input type="hidden" name="ruleId" value={rule.id}/><div><strong>{rule.points} punti</strong><p>{rewardLabel(rule.type, rule.value, rule.serviceId ? names.get(rule.serviceId) : null)}</p></div><button className="primary-button" disabled={(card?.points ?? 0) < rule.points}>Riscatta</button></form>)}</div> : <p className="muted">Nessuna regola attiva.</p>}</article>
      <article className="panel"><h2>Schede duplicate</h2><p className="muted">Unisce automaticamente le schede con la stessa email o lo stesso telefono, conservando appuntamenti, punti e riscatti.</p><form action={mergeDuplicateCustomers}><input type="hidden" name="customerId" value={id}/><button className="ghost-button">Cerca e unisci duplicati</button></form></article>
    </section> : null}
    <section className="management-grid"><article className="panel"><h2>Premi riscattati</h2>{redemptions.length ? redemptions.map((item) => <p key={item.id}><strong>{rewardLabel(item.rewardType, item.rewardValue, item.serviceId ? names.get(item.serviceId) : null)}</strong><br/><span className="muted">-{item.pointsSpent} punti · {item.createdAt.toLocaleString("it-IT", { timeZone: context.timezone })}</span></p>) : <p className="muted">Nessun premio riscattato.</p>}</article></section>
    <section className="list-section"><h2>Cronologia completa</h2><div className="data-list">{history.map((appointment) => <article className="data-row" key={appointment.id}><div><h3>{appointment.service} · € {Number(appointment.price).toFixed(2)}</h3><p className="muted">{appointment.startsAt.toLocaleString("it-IT", { timeZone: context.timezone })} · {appointment.staff} · {appointment.status}</p></div></article>)}</div></section>
  </main>;
}
