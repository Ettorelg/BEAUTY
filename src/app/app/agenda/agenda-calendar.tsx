"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { addCalendarDays, addCalendarMonths, addCalendarYears, monthGridDates, type AgendaView } from "@/modules/agenda/domain/calendar";
import { approveCustomerRescheduleRequestSafely, changeAppointmentStatus, createAppointment, rejectCustomerRescheduleRequestSafely, rescheduleAppointment } from "./actions";
import { CustomerAutofill } from "./customer-autofill";
import { AppointmentPriceEditor } from "./appointment-price-editor";

type Staff = { id: string; name: string };
type Service = { staffId: string; id: string; name: string; duration: number };
type Entry = {
  id: string;
  startsAt: string;
  status: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  staffId: string;
  staffName: string;
  price: string;
  paymentStatus: string;
  previousOutstanding: number;
  rememberedNote?: string | null;
  absenceConflict?: boolean;
};
type Data = {
  date: string;
  startDate: string;
  view: AgendaView;
  timezone: string;
  canManage: boolean;
  staff: Staff[];
  catalog: Service[];
  entries: Entry[];
  rescheduleRequests: Array<{ id:string;appointmentId:string;customerName:string;serviceName:string;proposedStartsAt:string;proposedStaffName:string }>;
};
type Slot = { staffId: string; staffName: string; localStart: string; label: string };

const statusLabels: Record<string, string> = {
  BOOKED: "Prenotato",
  CONFIRMED: "Confermato",
  ARRIVED: "Arrivato",
  COMPLETED: "Eseguito",
  CANCELLED: "Cancellato",
  NO_SHOW: "Non presentato",
};
const editableStatuses = ["BOOKED", "CONFIRMED", "ARRIVED"];
const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function Booking({ data, date, close, done }: { data: Data; date: string; close: () => void; done: () => void }) {
  const [service, setService] = useState(data.catalog[0]?.id ?? "");
  const [staff, setStaff] = useState("");
  const [day, setDay] = useState(date);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot>();
  const [loading, setLoading] = useState(false);
  const eligible = data.staff.filter((member) => data.catalog.some((item) => item.id === service && item.staffId === member.id));

  useEffect(() => {
    setSelected(undefined);
    if (!service) return;
    setLoading(true);
    fetch(`/api/agenda/availability?serviceId=${service}&date=${day}&staffId=${staff}`)
      .then((response) => response.json())
      .then((payload) => setSlots(payload.slots ?? []))
      .finally(() => setLoading(false));
  }, [service, staff, day]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formData = new FormData(event.currentTarget);
    formData.set("staffId", selected.staffId);
    formData.set("serviceId", service);
    formData.set("startsAt", selected.localStart);
    const result = await createAppointment(formData);
    if (!result.ok) {
      alert(result.error ?? "Creazione appuntamento non riuscita.");
      return;
    }
    done();
    close();
  }

  return (
    <div className="booking-modal-backdrop" onMouseDown={close}>
      <section className="booking-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={close}>×</button>
        <p className="eyebrow">Nuova prenotazione</p>
        <h2>Scegli disponibilità</h2>
        <form className="compact-form stacked" onSubmit={submit}>
          <label>
            Servizio
            <select value={service} onChange={(event) => { setService(event.target.value); setStaff(""); }}>
              {Array.from(new Map(data.catalog.map((item) => [item.id, item])).values()).map((item) => (
                <option value={item.id} key={item.id}>{item.name} · {item.duration} min</option>
              ))}
            </select>
          </label>
          <label>
            Operatore (facoltativo)
            <select value={staff} onChange={(event) => setStaff(event.target.value)}>
              <option value="">Primo disponibile</option>
              {eligible.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
            </select>
          </label>
          <label>Data<input type="date" value={day} min={date} onChange={(event) => setDay(event.target.value)} /></label>
          <div className="slot-picker">
            {loading ? <p className="muted">Cerco disponibilità…</p> : slots.length ? slots.map((slot) => (
              <button
                type="button"
                className={selected?.localStart === slot.localStart && selected?.staffId === slot.staffId ? "active" : ""}
                onClick={() => setSelected(slot)}
                key={`${slot.staffId}-${slot.localStart}`}
              >
                {slot.label}{!staff ? <small> · {slot.staffName}</small> : null}
              </button>
            )) : <p className="muted">Nessun orario disponibile.</p>}
          </div>
          {selected ? <>
            <p className="status-pill">{selected.label} · {selected.staffName}</p>
            <CustomerAutofill />
            <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
            <textarea name="notes" placeholder="Note (opzionali)" />
            <button className="primary-button">Conferma prenotazione</button>
          </> : null}
        </form>
      </section>
    </div>
  );
}

export function AgendaCalendar({ today }: { today: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date") ?? "") ? searchParams.get("date")! : today);
  const [view, setView] = useState<AgendaView>(requestedView === "week" || requestedView === "month" || requestedView === "year" ? requestedView : "day");
  const [data, setData] = useState<Data>();
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [showRevenue, setShowRevenue] = useState(false);
  const [failureFor, setFailureFor] = useState("");
  const [completionFor, setCompletionFor] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [completionPayment, setCompletionPayment] = useState<"PAID" | "UNPAID">("PAID");
  const [error, setError] = useState("");
  const [reschedulePending, setReschedulePending] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/agenda?date=${date}&view=${view}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Impossibile caricare l’agenda.");
      const payload = await response.json() as Data;
      setData(payload);
      setError("");
      if (payload.view !== view) setView(payload.view);
    } catch {
      setError("Impossibile caricare l’agenda. Riprova.");
    }
  }, [date, view]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { router.replace(`/app/agenda?date=${date}&view=${view}`, { scroll: false }); }, [date, view, router]);

  const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
  const time = (value: string) => new Intl.DateTimeFormat("it-IT", { timeZone: data?.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  const dayForEntry = (entry: Entry) => new Intl.DateTimeFormat("en-CA", { timeZone: data?.timezone }).format(new Date(entry.startsAt));
  const expected = useMemo(() => {
    const visibleStaffIds = new Set((data?.staff ?? []).map((member) => member.id));
    const rows = data?.entries.filter((entry) => visibleStaffIds.has(entry.staffId) && !["CANCELLED", "NO_SHOW"].includes(entry.status)) ?? [];
    const amount = (value: string) => Number(String(value).replace(",", ".")) || 0;
    return {
      total: rows.reduce((sum, entry) => sum + amount(entry.price), 0),
      byStaff: (data?.staff ?? []).map((member) => ({
        name: member.name,
        total: rows.filter((entry) => entry.staffId === member.id).reduce((sum, entry) => sum + amount(entry.price), 0),
      })),
    };
  }, [data]);

  if (!data) return <div className="empty-state">Caricamento agenda…</div>;

  const dateLabel = data.view === "year"
    ? data.startDate.slice(0, 4)
    : data.view === "month"
      ? new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${data.startDate}T12:00:00Z`))
      : new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const dayTimes = Array.from(new Set(
    data.entries
      .filter((entry) => dayForEntry(entry) === date)
      .map((entry) => time(entry.startsAt)),
  )).sort((left, right) => left.localeCompare(right));

  function movePeriod(direction: -1 | 1) {
    if (view === "year") setDate(addCalendarYears(date, direction));
    else if (view === "month") setDate(addCalendarMonths(date, direction));
    else setDate(addCalendarDays(date, direction * (view === "week" ? 7 : 1)));
  }

  function openDay(day: string) {
    setDate(day);
    setView("day");
  }

  async function updateStatus(id: string, status: "COMPLETED" | "CANCELLED" | "NO_SHOW", note?: string, paymentStatus?: "PAID" | "UNPAID") {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("status", status);
    if (note?.trim()) formData.set("completionNote", note.trim());
    if (paymentStatus) formData.set("paymentStatus", paymentStatus);
    try {
      await changeAppointmentStatus(formData);
      setFailureFor("");
      setCompletionFor("");
      setCompletionNote("");
      await load();
    } catch {
      setError("Impossibile aggiornare l’appuntamento.");
    }
  }

  async function decideReschedule(id: string, decision: "approve" | "reject") {
    const formData = new FormData();
    formData.set("id", id);
    setReschedulePending(id);
    setError("");
    const result = decision === "approve"
      ? await approveCustomerRescheduleRequestSafely(formData)
      : await rejectCustomerRescheduleRequestSafely(formData);
    setReschedulePending("");
    if (!result.ok) {
      setError(result.error ?? "Impossibile gestire la richiesta di modifica.");
      return;
    }
    await load();
  }
  return <>
    <div className="agenda-toolbar">
      <div className="agenda-navigation">
        <button className="agenda-icon-button" type="button" aria-label="Periodo precedente" onClick={() => movePeriod(-1)}>←</button>
        <button className="ghost-button" type="button" onClick={() => setDate(today)}>Torna a oggi</button>
        <button className="agenda-icon-button" type="button" aria-label="Periodo successivo" onClick={() => movePeriod(1)}>→</button>
      </div>
      <h2>{dateLabel}</h2>
      <div className="agenda-view-switch">
        {data.canManage ? <button type="button" onClick={() => setShowRevenue((current) => !current)}>{showRevenue ? "Nascondi incasso" : "Incasso previsto"}</button> : null}
        <button className={view === "day" ? "active" : ""} type="button" onClick={() => setView("day")}>Giorno</button>
        <button className={view === "week" ? "active" : ""} type="button" onClick={() => setView("week")}>Settimana</button>
        <button className={view === "month" ? "active" : ""} type="button" onClick={() => setView("month")}>Mese</button>
        {data.canManage ? <button className={view === "year" ? "active" : ""} type="button" onClick={() => setView("year")}>Anno</button> : null}
      </div>
    </div>

    {error ? <p className="agenda-error" role="alert">{error}</p> : null}
    {data.rescheduleRequests?.length ? <section className="panel"><h2>Richieste di modifica dei clienti</h2>{data.rescheduleRequests.map(request => <article className="data-row" key={request.id}><div><strong>{request.customerName} · {request.serviceName}</strong><p>Propone: {new Date(request.proposedStartsAt).toLocaleString("it-IT", { timeZone: data.timezone })} · {request.proposedStaffName}</p></div><div className="button-row"><button className="primary-button" type="button" disabled={reschedulePending === request.id} onClick={() => void decideReschedule(request.id, "approve")}>{reschedulePending === request.id ? "Verifica…" : "Accetta"}</button><button className="danger-button" type="button" disabled={reschedulePending === request.id} onClick={() => void decideReschedule(request.id, "reject")}>Rifiuta</button></div></article>)}</section> : null}

    {data.canManage && showRevenue ? <section className="agenda-revenue-card">
      <div>
        <p className="eyebrow">Incasso previsto</p>
        <strong>{money(expected.total)}</strong>
        <p className="muted">Esclude appuntamenti cancellati e non presentati.</p>
      </div>
      <div className="agenda-revenue-by-staff">
        {expected.byStaff.map((item) => <p key={item.name}><span>{item.name}</span><strong>{money(item.total)}</strong></p>)}
      </div>
    </section> : null}

    {data.view === "year" ? <div className="year-calendar">
      {Array.from({ length: 12 }, (_, index) => {
        const monthStart = `${data.startDate.slice(0, 4)}-${String(index + 1).padStart(2, "0")}-01`;
        const monthKey = monthStart.slice(0, 7);
        const monthEntries = data.entries.filter((entry) => dayForEntry(entry).startsWith(monthKey));
        const activeEntries = monthEntries.filter((entry) => !["CANCELLED", "NO_SHOW"].includes(entry.status));
        const total = activeEntries.reduce((sum, entry) => sum + (Number(entry.price) || 0), 0);
        return <button className="year-month" type="button" key={monthStart} onClick={() => { setDate(monthStart); setView("month"); }}>
          <span>{new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" }).format(new Date(`${monthStart}T12:00:00Z`))}</span>
          <strong>{monthEntries.length}</strong>
          <small>appuntament{monthEntries.length === 1 ? "o" : "i"}</small>
          <em>{money(total)}</em>
        </button>;
      })}
    </div> : data.view === "month" ? <div className="month-calendar">
      {weekDays.map((weekDay) => <div className="month-weekday" key={weekDay}>{weekDay}</div>)}
      {monthGridDates(data.startDate).map((day, index) => {
        if (!day) return <div className="month-day month-day-empty" aria-hidden="true" key={`empty-${index}`} />;
        const entries = data.entries.filter((entry) => dayForEntry(entry) === day);
        return <button
          className={`month-day${day === today ? " today" : ""}`}
          type="button"
          key={day}
          onClick={() => openDay(day)}
          aria-label={`${day}: ${entries.length} appuntamenti. Apri la giornata.`}
        >
          <span className="month-day-number">{Number(day.slice(8))}</span>
          <span className="month-day-count">{entries.length ? `${entries.length} appuntament${entries.length === 1 ? "o" : "i"}` : "Nessun appuntamento"}</span>
          <span className="month-day-entries">
            {entries.slice(0, 3).map((entry) => <span className={`month-entry status-${entry.status.toLowerCase()}`} key={entry.id}>
              <strong>{time(entry.startsAt)}</strong> {entry.customerName}<small>{entry.staffName}</small>
            </span>)}
            {entries.length > 3 ? <span className="month-more">+ {entries.length - 3} altri</span> : null}
          </span>
        </button>;
      })}
    </div> : data.view === "week" ? <div className="week-calendar">
      {Array.from({ length: 7 }, (_, index) => addCalendarDays(data.startDate, index)).map((day) => <section className={`week-day${day === today ? " today" : ""}`} key={day}>
        <header>
          <span>{new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))}</span>
          <strong>{day.slice(8)}</strong>
        </header>
        {data.entries.filter((entry) => dayForEntry(entry) === day).map((entry) => <article className={`agenda-appointment status-${entry.status.toLowerCase()}`} key={entry.id}>
          <span>{time(entry.startsAt)}</span><strong>{entry.customerName}</strong><small>{entry.serviceName} · {entry.staffName}</small><small className="agenda-price">{money(Number(entry.price))}</small><em>{statusLabels[entry.status]}</em>{entry.absenceConflict ? <strong className="agenda-absence-warning">⚠ Conflitto assenza</strong> : null}
        </article>)}
      </section>)}
    </div> : <div className="agenda-scroll">
      <div className="day-calendar" style={{ gridTemplateColumns: `76px repeat(${Math.max(data.staff.length, 1)}, minmax(190px,1fr))` }}>
        <div className="calendar-corner">Ora</div>
        {data.staff.map((member) => <div className="staff-heading" key={member.id}>{member.name}</div>)}
        {dayTimes.length === 0 ? <div className="empty-state" style={{ gridColumn: "1 / -1" }}>Nessun appuntamento per questa giornata.</div> : null}
        {dayTimes.map((slotTime) => {
          return <div className="calendar-row" key={slotTime} style={{ gridColumn: "1 / -1", gridTemplateColumns: `76px repeat(${Math.max(data.staff.length, 1)}, minmax(190px,1fr))` }}>
            <time>{slotTime}</time>
            {data.staff.map((member) => <div className="calendar-cell" key={member.id}>
              {data.entries.filter((entry) => entry.staffId === member.id && time(entry.startsAt) === slotTime).map((entry) => <article className={`agenda-appointment status-${entry.status.toLowerCase()}`} key={entry.id}>
                <span>{slotTime}</span>
                <strong>{entry.customerName}</strong>
                <small>{entry.serviceName} · {entry.staffName}</small>
                <small className="agenda-price">{money(Number(entry.price))}</small>
                {entry.previousOutstanding > 0 ? <small className="agenda-outstanding-badge">Sospeso {money(entry.previousOutstanding)} · Totale {money(entry.previousOutstanding + Number(entry.price))}</small> : null}
                <em>{statusLabels[entry.status]}</em>
                {entry.absenceConflict ? <strong className="agenda-absence-warning">⚠ Conflitto con assenza</strong> : null}
                {entry.rememberedNote ? <p className="agenda-remembered-note"><strong>Nota precedente:</strong> {entry.rememberedNote}</p> : null}
                {data.canManage || !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(entry.status) ? <details className="agenda-reschedule">
                  <summary>Modifica</summary>
                  <form action={rescheduleAppointment}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input name="startsAt" type="datetime-local" required />
                    {data.canManage ? <label>Operatore<select name="staffId" defaultValue={entry.staffId}>
                      {data.staff.filter((memberOption) => data.catalog.some((catalogItem) => catalogItem.id === entry.serviceId && catalogItem.staffId === memberOption.id)).map((memberOption) => <option key={memberOption.id} value={memberOption.id}>{memberOption.name}</option>)}
                    </select></label> : null}
                    <button className="ghost-button">Invia proposta al cliente</button>
                  </form>
                  {data.canManage ? <AppointmentPriceEditor appointmentId={entry.id} price={entry.price} onSaved={load} /> : null}
                </details> : null}
                {editableStatuses.includes(entry.status) ? <div className="agenda-quick-actions">
                  <button type="button" className="agenda-complete-button" aria-label="Aggiungi note e segna come eseguito" title="Aggiungi note e completa" onClick={() => { setCompletionFor(completionFor === entry.id ? "" : entry.id); setCompletionNote(entry.rememberedNote ?? ""); setCompletionPayment("PAID"); setFailureFor(""); }}>&#10003;</button>
                  {completionFor === entry.id ? <div className="agenda-completion-note">
                    <label>Note del trattamento<textarea value={completionNote} maxLength={500} placeholder="Prodotti usati, preferenze, risultato…" onChange={(event) => setCompletionNote(event.target.value)} /></label>
                    {entry.rememberedNote ? <small>È stata precaricata la nota precedente di questo cliente per {entry.serviceName}.</small> : null}
                    {entry.previousOutstanding > 0 ? <div className="agenda-payment-summary"><span>Sospeso precedente</span><strong>{money(entry.previousOutstanding)}</strong><span>Servizio corrente</span><strong>{money(Number(entry.price))}</strong><span>Totale cliente</span><strong>{money(entry.previousOutstanding + Number(entry.price))}</strong></div> : null}
                    {data.canManage ? <label>Pagamento<select value={completionPayment} onChange={(event) => setCompletionPayment(event.target.value as "PAID" | "UNPAID")}><option value="PAID">Pagato</option><option value="UNPAID">In sospeso</option></select></label> : <small>Il pagamento sarà registrato come in sospeso e potrà essere verificato dal titolare.</small>}
                    <div><button type="button" className="agenda-note-confirm" onClick={() => void updateStatus(entry.id, "COMPLETED", completionNote, data.canManage ? completionPayment : "UNPAID")}>Conferma eseguito</button><button type="button" onClick={() => { setCompletionFor(""); setCompletionNote(""); setCompletionPayment("PAID"); }}>Annulla</button></div>
                  </div> : null}
                  <button type="button" className="agenda-failure-button" aria-label="Segna come non concluso" title="Non concluso" onClick={() => setFailureFor(failureFor === entry.id ? "" : entry.id)}>&#10005;</button>
                  {failureFor === entry.id ? <div className="agenda-failure-reasons">
                    <button type="button" onClick={() => void updateStatus(entry.id, "CANCELLED")}>Cancellato</button>
                    <button type="button" onClick={() => void updateStatus(entry.id, "NO_SHOW")}>Non presentato</button>
                  </div> : null}
                </div> : null}
              </article>)}
            </div>)}
          </div>;
        })}
      </div>
    </div>}

    {data.canManage ? <button className="new-booking-fab" type="button" onClick={() => setOpen(true)}><span>＋</span> Nuova prenotazione</button> : null}
    {open ? <Booking data={data} date={date} close={() => setOpen(false)} done={load} /> : null}
  </>;
}



