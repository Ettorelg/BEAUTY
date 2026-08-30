import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { appointments, staffMembers } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { AppNav } from "../app-nav";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";

type Ranked = { name: string; count: number; amount: number };

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
const percentage = (value: number, total: number) => total ? Math.round(value / total * 100) : 0;

export default async function StatisticsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") redirect("/app/agenda");
  const query = await searchParams;
  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: context.timezone }).format(now);
  const validDate = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
  let from = validDate(query.from) ? query.from! : `${todayKey.slice(0, 7)}-01`;
  let to = validDate(query.to) ? query.to! : todayKey;
  if (from > to) { from = `${todayKey.slice(0, 7)}-01`; to = todayKey; }
  const addDay = (value: string) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); };
  const periodStart = zonedLocalToUtc(`${from}T00:00`, context.timezone);
  const periodEnd = zonedLocalToUtc(`${addDay(to)}T00:00`, context.timezone);
  const duration = periodEnd.getTime() - periodStart.getTime();
  const previousStart = new Date(periodStart.getTime() - duration);

  const allRows = await db.select({
    id: appointments.id,
    customerId: appointments.customerRelationId,
    price: appointments.price,
    startsAt: appointments.startsAt,
    status: appointments.status,
    service: appointments.serviceName,
    staff: staffMembers.name,
    staffId: staffMembers.id,
  }).from(appointments)
    .innerJoin(staffMembers, and(eq(appointments.staffId, staffMembers.id), eq(staffMembers.businessId, context.businessId)))
    .where(eq(appointments.businessId, context.businessId))
    .orderBy(asc(appointments.startsAt));
  const rows = allRows.filter((row) => row.startsAt >= periodStart && row.startsAt < periodEnd);
  const previousRows = allRows.filter((row) => row.startsAt >= previousStart && row.startsAt < periodStart);
  const monthFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: context.timezone, year: "numeric", month: "2-digit" });
  const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: context.timezone });
  const weekdayFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: context.timezone, weekday: "long" });
  const hourFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: context.timezone, hour: "2-digit", hour12: false });

  const completed = rows.filter((row) => row.status === "COMPLETED");
  const past = rows.filter((row) => row.startsAt <= now);

  const totalRevenue = completed.reduce((sum, row) => sum + Number(row.price), 0);
  const currentRevenue = totalRevenue;
  const previousRevenue = previousRows.filter((row) => row.status === "COMPLETED").reduce((sum, row) => sum + Number(row.price), 0);
  const growth = previousRevenue ? Math.round((currentRevenue - previousRevenue) / previousRevenue * 100) : currentRevenue ? 100 : 0;

  const byStaff = Object.values(completed.reduce<Record<string, Ranked>>((map, row) => {
    map[row.staffId] ??= { name: row.staff, count: 0, amount: 0 };
    map[row.staffId].count++;
    map[row.staffId].amount += Number(row.price);
    return map;
  }, {})).sort((a, b) => b.amount - a.amount);
  const byService = Object.values(completed.reduce<Record<string, Ranked>>((map, row) => {
    map[row.service] ??= { name: row.service, count: 0, amount: 0 };
    map[row.service].count++;
    map[row.service].amount += Number(row.price);
    return map;
  }, {})).sort((a, b) => b.count - a.count);

  const customerVisits = completed.reduce<Record<string, { count: number; last: Date; first: Date }>>((map, row) => {
    const current = map[row.customerId];
    if (!current) map[row.customerId] = { count: 1, first: row.startsAt, last: row.startsAt };
    else { current.count++; current.last = row.startsAt; }
    return map;
  }, {});
  const customers = Object.values(customerVisits);
  const recurringCustomers = customers.filter((customer) => customer.count >= 2).length;
  const periodMonths: string[] = [];
  const monthCursor = new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
  const finalMonth = new Date(`${to.slice(0, 7)}-01T12:00:00Z`);
  while (monthCursor <= finalMonth) { periodMonths.push(monthCursor.toISOString().slice(0, 7)); monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1); }
  const lastSixMonths = periodMonths.slice(-12).map((key) => {
    const date = new Date(`${key}-15T12:00:00Z`);
    return { key, label: date.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }), amount: completed.filter((row) => monthFormatter.format(row.startsAt) === key).reduce((sum, row) => sum + Number(row.price), 0) };
  });
  const maxMonth = Math.max(...lastSixMonths.map((month) => month.amount), 1);
  const weekdays = completed.reduce<Record<string, number>>((map, row) => { const day = weekdayFormatter.format(row.startsAt); map[day] = (map[day] ?? 0) + 1; return map; }, {});
  const timeBands = completed.reduce<Record<string, number>>((map, row) => { const hour = Number(hourFormatter.format(row.startsAt)); const band = hour < 12 ? "Mattina" : hour < 18 ? "Pomeriggio" : "Sera"; map[band] = (map[band] ?? 0) + 1; return map; }, {});
  const statusRows = [
    { label: "Eseguiti", value: past.filter((row) => row.status === "COMPLETED").length },
    { label: "Cancellati", value: past.filter((row) => row.status === "CANCELLED").length },
    { label: "Non presentati", value: past.filter((row) => row.status === "NO_SHOW").length },
  ];

  return <main className="dashboard-shell">
    <AppNav businessName={context.businessName} role={context.role}/>
    <div className="page-heading"><div><p className="eyebrow">Titolare</p><h1>Statistiche e incassi</h1><p className="muted">Ricavi calcolati esclusivamente sugli appuntamenti eseguiti.</p></div><form method="get" className="statistics-filter"><label>Da<input type="date" name="from" defaultValue={from}/></label><label>A<input type="date" name="to" defaultValue={to}/></label><button className="primary-button">Applica periodo</button></form></div>
    <section className="module-grid statistics-kpis">
      <article className="module-card"><h2>{money(totalRevenue)}</h2><p>Incasso nel periodo selezionato</p></article>
      <article className="module-card"><h2>{money(previousRevenue)}</h2><p>Periodo precedente · il periodo scelto è {growth >= 0 ? "+" : ""}{growth}%</p></article>
      <article className="module-card"><h2>{money(completed.length ? totalRevenue / completed.length : 0)}</h2><p>Scontrino medio</p></article>
      <article className="module-card"><h2>{percentage(past.filter((row) => row.status === "COMPLETED").length, past.length)}%</h2><p>Tasso di completamento</p></article>
      <article className="module-card"><h2>{rows.length}</h2><p>Appuntamenti nel periodo</p></article>
      <article className="module-card"><h2>{completed.length}</h2><p>Servizi eseguiti nel periodo</p></article>
    </section>

    <section className="management-grid">
      <article className="panel"><h2>Andamento del periodo (massimo 12 mesi)</h2><div className="statistics-bars">{lastSixMonths.map((month) => <div className="statistics-bar-row" key={month.key}><span>{month.label}</span><div><i style={{ width: `${month.amount / maxMonth * 100}%` }}/></div><strong>{money(month.amount)}</strong></div>)}</div></article>
      <article className="panel"><h2>Esito appuntamenti</h2>{statusRows.map((status) => <div className="statistics-line" key={status.label}><span>{status.label}</span><strong>{status.value} · {percentage(status.value, past.length)}%</strong></div>)}<div className="statistics-line"><span>Assenze + cancellazioni</span><strong>{percentage(statusRows[1].value + statusRows[2].value, past.length)}%</strong></div></article>
    </section>

    <section className="module-grid">
      <article className="module-card"><h2>{customers.length}</h2><p>Clienti serviti</p></article>
      <article className="module-card"><h2>{recurringCustomers}</h2><p>Clienti ricorrenti · {percentage(recurringCustomers, customers.length)}%</p></article>
      <article className="module-card"><h2>{customers.filter((customer) => customer.count === 1).length}</h2><p>Clienti con una visita nel periodo</p></article>
      <article className="module-card"><h2>{completed.length && customers.length ? (completed.length / customers.length).toFixed(1) : "0"}</h2><p>Servizi medi per cliente</p></article>
    </section>

    <section className="management-grid">
      <article className="panel"><h2>Incassi per operatore</h2>{byStaff.length ? byStaff.map((row) => <div className="statistics-line" key={row.name}><span><strong>{row.name}</strong><small>{row.count} servizi</small></span><strong>{money(row.amount)}</strong></div>) : <p className="muted">Nessun incasso ancora.</p>}</article>
      <article className="panel"><h2>Servizi più richiesti</h2>{byService.slice(0, 8).map((row) => <div className="statistics-line" key={row.name}><span><strong>{row.name}</strong><small>{percentage(row.count, completed.length)}% degli eseguiti</small></span><strong>{row.count} · {money(row.amount)}</strong></div>)}</article>
    </section>

    <section className="management-grid">
      <article className="panel"><h2>Giorni più richiesti</h2>{Object.entries(weekdays).sort((a, b) => b[1] - a[1]).map(([day, count]) => <div className="statistics-line" key={day}><span className="capitalize">{day}</span><strong>{count} · {percentage(count, completed.length)}%</strong></div>)}</article>
      <article className="panel"><h2>Fasce orarie</h2>{["Mattina", "Pomeriggio", "Sera"].map((band) => <div className="statistics-line" key={band}><span>{band}</span><strong>{timeBands[band] ?? 0} · {percentage(timeBands[band] ?? 0, completed.length)}%</strong></div>)}</article>
    </section>
  </main>;
}
