import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { businesses, serviceCategories, services } from "@/db/schema";
import { getPublicAvailability } from "@/modules/availability/application/public-availability";
import { createPublicAppointment } from "./actions";

export default async function PublicSalonPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string; date?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [business] = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (!business) notFound();
  const catalog = await db.select({ id: services.id, name: services.name, description: services.description, duration: services.durationMinutes, price: services.price, category: serviceCategories.name })
    .from(services).innerJoin(serviceCategories, and(eq(services.categoryId, serviceCategories.id), eq(serviceCategories.businessId, business.id), eq(serviceCategories.active, true)))
    .where(and(eq(services.businessId, business.id), eq(services.active, true), eq(services.onlineBookable, true))).orderBy(asc(serviceCategories.sortOrder), asc(services.name));
  const selected = catalog.find((item) => item.id === query.service);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: business.timezone }).format(new Date());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date! : today;
  const slots = selected ? await getPublicAvailability({ businessId: business.id, serviceId: selected.id, date, durationMinutes: selected.duration, timezone: business.timezone }) : [];

  return <main className="public-shell"><header className="public-header"><div><p className="eyebrow">Prenotazione online</p><h1>{business.name}</h1></div><div className="public-account-actions"><span>Orari in {business.timezone}</span><Link className="ghost-button link-button" href="/account/login">Area clienti</Link></div></header>
    <section className="public-hero"><div><p className="eyebrow">Prenditi il tuo tempo</p><h2>Scegli il trattamento.<br/>Al resto pensiamo noi.</h2><p>Consulta disponibilità e prenota in pochi passaggi.</p></div></section>
    <section className="booking-layout"><div><h2>1. Scegli il servizio</h2><div className="service-grid">{catalog.map((item) => <Link scroll={false} className={`service-card ${selected?.id === item.id ? "selected" : ""}`} href={`/s/${slug}?service=${item.id}&date=${date}`} key={item.id}><span className="eyebrow">{item.category}</span><h3>{item.name}</h3><p>{item.description || "Un trattamento dedicato al tuo benessere."}</p><strong>€ {Number(item.price).toFixed(2)} · {item.duration} min</strong></Link>)}</div></div>
      {selected ? <div className="booking-panel"><h2>2. Scegli quando</h2><form method="get" className="date-picker"><input type="hidden" name="service" value={selected.id}/><input type="date" name="date" min={today} defaultValue={date}/><button className="ghost-button">Mostra disponibilità</button></form>
        {slots.length ? <form action={createPublicAppointment} className="public-booking-form"><input type="hidden" name="slug" value={slug}/><input type="hidden" name="serviceId" value={selected.id}/><input type="hidden" name="idempotencyKey" value={crypto.randomUUID()}/><div className="slot-grid">{slots.map((slot) => <label className="slot" key={`${slot.staffId}-${slot.localStart}`}><input type="radio" name="selection" value={`${slot.staffId}|${slot.localStart}`} required/><span>{slot.label}<small>{slot.staffName}</small></span></label>)}</div><h2>3. I tuoi dati</h2><input name="customerName" placeholder="Nome e cognome" minLength={2} required/><input name="email" type="email" placeholder="Email" required/><input name="phone" type="tel" placeholder="Telefono (opzionale)"/><button className="primary-button">Conferma prenotazione</button></form> : <p className="empty-state">Nessuna disponibilità per questa data. Prova un altro giorno.</p>}</div> : <aside className="booking-panel empty-prompt"><span>01</span><p>Seleziona un servizio per vedere gli orari disponibili.</p></aside>}</section>
  </main>;
}
