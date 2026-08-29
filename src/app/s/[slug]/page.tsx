import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { businesses, serviceCategories, services, staffMembers, staffServices } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getPublicAvailability } from "@/modules/availability/application/public-availability";
import { createPublicAppointment } from "./actions";

const validDate = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
const addDays = (date: string, days: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string; date?: string; staff?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [business] = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (!business || !business.active) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  const catalog = await db.select({ id: services.id, name: services.name, description: services.description, duration: services.durationMinutes, price: services.price, category: serviceCategories.name }).from(services).innerJoin(serviceCategories, and(eq(services.categoryId, serviceCategories.id), eq(serviceCategories.businessId, business.id), eq(serviceCategories.active, true))).where(and(eq(services.businessId, business.id), eq(services.active, true), eq(services.onlineBookable, true))).orderBy(asc(serviceCategories.sortOrder), asc(services.name));
  const selected = catalog.find((item) => item.id === query.service);
  const operators = selected ? await db.select({ id: staffMembers.id, name: staffMembers.name }).from(staffServices).innerJoin(staffMembers, and(eq(staffMembers.id, staffServices.staffId), eq(staffMembers.businessId, business.id), eq(staffMembers.active, true))).where(and(eq(staffServices.businessId, business.id), eq(staffServices.serviceId, selected.id))).orderBy(asc(staffMembers.name)) : [];
  const selectedStaff = operators.some((operator) => operator.id === query.staff) ? query.staff : undefined;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: business.timezone }).format(new Date());
  let date = validDate(query.date) ? query.date! : today;
  let slots = selected ? await getPublicAvailability({ businessId: business.id, serviceId: selected.id, date, durationMinutes: selected.duration, timezone: business.timezone }) : [];
  if (selectedStaff) slots = slots.filter((slot) => slot.staffId === selectedStaff);
  if (selected && !slots.length) for (let offset = 1; offset <= 30 && !slots.length; offset++) { const candidate = addDays(date, offset); let found = await getPublicAvailability({ businessId: business.id, serviceId: selected.id, date: candidate, durationMinutes: selected.duration, timezone: business.timezone }); if (selectedStaff) found = found.filter((slot) => slot.staffId === selectedStaff); if (found.length) { date = candidate; slots = found; } }
  const byTime = new Map<string, typeof slots>();
  for (const slot of slots) byTime.set(slot.localStart, [...(byTime.get(slot.localStart) ?? []), slot]);
  const compactSlots = [...byTime.entries()];

  return <main className="public-shell"><header className="public-header"><div><p className="eyebrow">Prenotazione online</p><h1>{business.name}</h1></div><Link className="ghost-button link-button" href="/account/login">Area clienti</Link></header><section className="booking-layout"><div><h2>1. Scegli il servizio</h2><div className="service-grid">{catalog.map((item) => <Link scroll={false} className={`service-card ${selected?.id === item.id ? "selected" : ""}`} href={`/s/${slug}?service=${item.id}&date=${today}`} key={item.id}><span className="eyebrow">{item.category}</span><h3>{item.name}</h3><p>{item.description || "Trattamento dedicato al tuo benessere."}</p><strong>€ {Number(item.price).toFixed(2)} · {item.duration} min</strong></Link>)}</div></div>{selected ? <div className="booking-panel"><h2>2. Scegli quando e con chi</h2><form method="get" className="date-picker"><input type="hidden" name="service" value={selected.id}/><input type="date" name="date" min={today} defaultValue={date}/><select name="staff" defaultValue={selectedStaff ?? ""}><option value="">Qualsiasi operatore</option>{operators.map((operator) => <option value={operator.id} key={operator.id}>{operator.name}</option>)}</select><button className="ghost-button">Mostra disponibilità</button></form>{compactSlots.length ? <form action={createPublicAppointment} className="public-booking-form"><p className="muted">Prima data utile: <strong>{date}</strong></p><input type="hidden" name="slug" value={slug}/><input type="hidden" name="serviceId" value={selected.id}/><input type="hidden" name="idempotencyKey" value={crypto.randomUUID()}/><div className="slot-grid">{compactSlots.map(([localStart, available]) => { const chosen = available[0]; return <label className="slot" key={localStart}><input type="radio" name="selection" value={`${chosen.staffId}|${localStart}`} required/><span>{chosen.label}<small>{selectedStaff ? chosen.staffName : available.length > 1 ? `${available.length} operatori disponibili` : chosen.staffName}</small></span></label>; })}</div><h2>3. I tuoi dati</h2><input name="customerName" defaultValue={session?.user.name ?? ""} placeholder="Nome e cognome" required readOnly={!!session}/><input name="email" type="email" defaultValue={session?.user.email ?? ""} placeholder="Email" required readOnly={!!session}/><input name="phone" type="tel" placeholder="Telefono"/><button className="primary-button">Conferma prenotazione</button></form> : <p className="empty-state">Nessuna disponibilità nei prossimi 30 giorni.</p>}</div> : <aside className="booking-panel empty-prompt"><p>Seleziona un servizio.</p></aside>}</section></main>;
}
