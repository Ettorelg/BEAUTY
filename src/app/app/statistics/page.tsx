import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { appointments, staffMembers } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { AppNav } from "../app-nav";

type Ranked = { name: string; count: number; amount: number };

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
const percentage = (value: number, total: number) => total ? Math.round(value / total * 100) : 0;

export default async function StatisticsPage() {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") redirect("/app/agenda");

  const rows = await db.select({
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

  const now = new Date();
  const monthFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: context.timezone, year: "numeric", month: "2-digit" });
  const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: context.timezone });
  const weekdayFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: context.timezone, weekday: "long" });
  const hourFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: context.timezone, hour: "2-digit", hour12: false });
  const currentMonth = monthFormatter.format(now);
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const previousMonth = monthFormatter.format(previousMonthDate);
  const today = dayFormatter.format(now);
  const sevenDaysLater = new Date(now.getTime() + 7 * 86_400_000);

  const completed = rows.filter((row) => row.status === "COMPLETED");
  const past = rows.filter((row) => row.startsAt <= now);
  const activeUpcoming = rows.filter((row) => row.startsAt > now && row.startsAt <= sevenDaysLater && !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(row.status));
  const totalRevenue = completed.reduce((sum, row) => sum + Number(row.price), 0);
  const currentMonthRows = completed.filter((row) => monthFormatter.format(row.startsAt) === currentMonth);
  const previousMonthRows = completed.filter((row) => monthFormatter.format(row.startsAt) === previousMonth);
  const currentRevenue = currentMonthRows.reduce((sum, row) => sum + Number(row.price), 0);
  const previousRevenue = previousMonthRows.reduce((sum, row) => sum + Number(row.price), 0);
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
  const newCustomersThisMonth = customers.filter((customer) => monthFormatter.format(customer.first) === currentMonth).length;
  const inactiveCustomers = customers.filter((customer) => now.getTime() - customer.last.getTime() > 90 * 86_400_000).length;

  const lastSixMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 15);
    const key = monthFormatter.format(date);
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
    <div className="page-heading"><div><p className="eyebrow">Titolare</p><h1>Statistiche e incassi</h1></div><p className="muted">Ricavi calcolati esclusivamente sugli appuntamenti eseguiti.</p></div>
    <section className="module-grid statistics-kpis">
      <article className="module-card"><h2>{money(totalRevenue)}</h2><p>Incasso totale</p></article>
      <article className="module-card"><h2>{money(currentRevenue)}</h2><p>Mese corrente · {growth >= 0 ? "+" : ""}{growth}% sul precedente</p></article>
      <article className="module-card"><h2>{money(completed.length ? totalRevenue / completed.length : 0)}</h2><p>Scontrino medio</p></article>
      <article className="module-card"><h2>{percentage(past.filter((row) => row.status === "COMPLETED").length, past.length)}%</h2><p>Tasso di completamento</p></article>
      <article className="module-card"><h2>{activeUpcoming.length}</h2><p>Appuntamenti nei prossimi 7 giorni</p></article>
      <article className="module-card"><h2>{rows.filter((row) => dayFormatter.format(row.startsAt) === today).length}</h2><p>Appuntamenti di oggi</p></article>
    </section>

    <section className="management-grid">
      <article className="panel"><h2>Andamento ultimi 6 mesi</h2><div className="statistics-bars">{lastSixMonths.map((month) => <div className="statistics-bar-row" key={month.key}><span>{month.label}</span><div><i style={{ width: `${month.amount / maxMonth * 100}%` }}/></div><strong>{money(month.amount)}</strong></div>)}</div></article>
      <article className="panel"><h2>Esito appuntamenti</h2>{statusRows.map((status) => <div className="statistics-line" key={status.label}><span>{status.label}</span><strong>{status.value} · {percentage(status.value, past.length)}%</strong></div>)}<div className="statistics-line"><span>Assenze + cancellazioni</span><strong>{percentage(statusRows[1].value + statusRows[2].value, past.length)}%</strong></div></article>
    </section>

    <section className="module-grid">
      <article className="module-card"><h2>{customers.length}</h2><p>Clienti serviti</p></article>
      <article className="module-card"><h2>{recurringCustomers}</h2><p>Clienti ricorrenti · {percentage(recurringCustomers, customers.length)}%</p></article>
      <article className="module-card"><h2>{newCustomersThisMonth}</h2><p>Nuovi clienti nel mese</p></article>
      <article className="module-card"><h2>{inactiveCustomers}</h2><p>Clienti inattivi da oltre 90 giorni</p></article>
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
