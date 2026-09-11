"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { addCalendarDays, addCalendarMonths, addCalendarYears, monthGridDates, type AgendaView } from "@/modules/agenda/domain/calendar";
import { addCustomProductToAppointment, addProductToAppointment, addServiceToAppointment, approveCustomerRescheduleRequestSafely, changeAppointmentService, changeAppointmentStatus, createAppointment, rejectCustomerRescheduleRequestSafely, rescheduleAppointment } from "./actions";
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
  productTotal: number;
  additionalServiceTotal: number;
  additionalServices: Array<{appointmentId:string;name:string;duration:number;price:string}>;
  recommendedProductIds: string[];
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
  inventoryEnabled: boolean;
  inventoryCatalog: Array<{id:string;name:string;stock:number;price:string;categoryId:string|null;categoryName:string|null}>;
  additionalServiceCatalog: Array<{id:string;name:string;duration:number;price:string}>;
  usedProducts: Array<{appointmentId:string;name:string;quantity:number;unitPrice:string}>;
  entries: Entry[];
  rescheduleRequests: Array<{ id:string;appointmentId:string;customerName:string;serviceName:string;proposedStartsAt:string;proposedStaffName:string }>;
};
type Slot = { staffId: string; staffName: string; localStart: string; label: string };
const money = (value:number) => new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(value);

function ProductPanel({data,entry,close,load,setError}:{data:Data;entry:Entry;close:()=>void;load:()=>Promise<void>;setError:(value:string)=>void}){
  const[query,setQuery]=useState("");const[custom,setCustom]=useState(false);
  const available=data.inventoryCatalog.filter(product=>product.stock>0);
  const suggested=available.filter(product=>entry.recommendedProductIds.includes(product.id));
  const results=available.filter(product=>!entry.recommendedProductIds.includes(product.id)&&(`${product.name} ${product.categoryName??""}`).toLowerCase().includes(query.toLowerCase()));
  const options=query.trim()?[...suggested,...results]:suggested;
  return <section className="agenda-action-panel agenda-products-panel"><div className="agenda-panel-heading"><div><span className="eyebrow">Magazzino</span><strong>Aggiungi prodotti</strong></div><button type="button" aria-label="Chiudi" onClick={close}>×</button></div>{data.usedProducts.filter(item=>item.appointmentId===entry.id).length?<div className="agenda-product-list">{data.usedProducts.filter(item=>item.appointmentId===entry.id).map((item,index)=><small key={index}><span>{item.name} × {item.quantity}</span><strong>{money(Number(item.unitPrice)*item.quantity)}</strong></small>)}</div>:<small className="muted">Nessun articolo ancora associato.</small>}{suggested.length?<><span className="eyebrow">Consigliati per questo servizio</span><div className="agenda-product-preview">{suggested.map(product=><button type="button" key={product.id} onClick={async()=>{const f=new FormData();f.set("appointmentId",entry.id);f.set("productId",product.id);f.set("quantity","1");try{await addProductToAppointment(f);await load();}catch{setError("Impossibile aggiungere il prodotto: controlla la giacenza.");}}}><strong>{product.name}</strong><small>{product.categoryName??"Articolo"} · {money(Number(product.price))}</small></button>)}</div></>:null}<label>Cerca in tutto il magazzino<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nome o categoria del prodotto"/></label>{options.length?<form action={async formData=>{try{await addProductToAppointment(formData);await load();}catch{setError("Impossibile aggiungere il prodotto: controlla la giacenza.");}}} className="compact-form stacked"><label>Articolo<select name="productId">{options.map(product=><option key={product.id} value={product.id}>{product.name} · {product.categoryName??"Senza categoria"} · disponibili {product.stock}</option>)}</select></label><label>Quantità<input name="quantity" type="number" min="1" defaultValue="1"/></label><input type="hidden" name="appointmentId" value={entry.id}/><button className="primary-button">Aggiungi alla prenotazione</button></form>:query.trim()?<small className="muted">Nessun articolo trovato.</small>:null}<button type="button" className="ghost-button" onClick={()=>setCustom(!custom)}>＋ Articolo vario</button>{custom?<form action={async formData=>{try{await addCustomProductToAppointment(formData);await load();setCustom(false);}catch{setError("Controlla descrizione e importo dell’articolo vario.");}}} className="compact-form stacked"><input type="hidden" name="appointmentId" value={entry.id}/><label>Descrizione<input name="description" placeholder="Es. Accessorio o prodotto non catalogato" required/></label><div className="form-row"><label>Quantità<input name="quantity" type="number" min="1" defaultValue="1" required/></label><label>Importo unitario (€)<input name="unitPrice" type="number" min="0" step=".01" required/></label></div><button className="primary-button">Aggiungi articolo vario</button></form>:null}{!available.length?<div className="agenda-stock-empty"><strong>Articoli di magazzino non disponibili</strong><p>{data.inventoryCatalog.length?"Gli articoli presenti hanno giacenza zero.":"Non hai ancora creato articoli."}</p><a className="ghost-button link-button" href="/app/inventory">Vai al Magazzino e registra un carico</a></div>:null}</section>;
}

function AdditionalServiceForm({data,entry,load,setError}:{data:Data;entry:Entry;load:()=>Promise<void>;setError:(value:string)=>void}){
  const first=data.additionalServiceCatalog[0];const[serviceId,setServiceId]=useState(first?.id??"");const[duration,setDuration]=useState(first?.duration??30);const[price,setPrice]=useState(first?.price??"0");
  if(!first)return <p className="muted">Nessun altro servizio disponibile.</p>;
  return <div className="agenda-extra-service"><h4>Aggiungi un servizio</h4>{entry.additionalServices.length?<div className="agenda-product-list">{entry.additionalServices.map((service,index)=><small key={index}><span>{service.name} · +{service.duration} min</span><strong>{money(Number(service.price))}</strong></small>)}</div>:null}<form action={async formData=>{try{await addServiceToAppointment(formData);await load();}catch(error){setError(error instanceof Error?error.message:"Impossibile aggiungere il servizio.");}}} className="compact-form stacked"><input type="hidden" name="appointmentId" value={entry.id}/><label>Servizio<select name="serviceId" value={serviceId} onChange={event=>{const selected=data.additionalServiceCatalog.find(service=>service.id===event.target.value);setServiceId(event.target.value);if(selected){setDuration(selected.duration);setPrice(selected.price);}}}>{data.additionalServiceCatalog.map(service=><option key={service.id} value={service.id}>{service.name}</option>)}</select></label><div className="form-row"><label>Tempo aggiuntivo (minuti)<input name="durationMinutes" type="number" min="5" max="480" step="5" value={duration} onChange={event=>setDuration(Number(event.target.value))}/></label><label>Costo aggiuntivo (€)<input name="price" type="number" min="0" step=".01" value={price} onChange={event=>setPrice(event.target.value)}/></label></div><p className="muted">Puoi modificare subito durata e prezzo rispetto ai valori del listino.</p><button className="primary-button">Aggiungi servizio e prolunga l’appuntamento</button></form></div>;
}

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
  const [editFor, setEditFor] = useState("");
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
          return <div className="calendar-row" key={slotTime} style={{ gridColumn: "1 / -1", gridTemplateColumns: `76px repeat(${Math.max(data.staff.length, 1)}, minmax(0,1fr))` }}>
            <time>{slotTime}</time>
            {data.staff.map((member) => <div className="calendar-cell" key={member.id}>
              {data.entries.filter((entry) => entry.staffId === member.id && time(entry.startsAt) === slotTime).map((entry) => <article className={`agenda-appointment status-${entry.status.toLowerCase()}`} key={entry.id} role="button" tabIndex={0} onClick={()=>setEditFor(entry.id)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" ")setEditFor(entry.id)}}>
                <span>{slotTime}</span>
                <strong>{entry.customerName}</strong>
                <small>{entry.serviceName} · {entry.staffName}</small>
                <div className="agenda-total"><span>Totale</span><strong>{money(Number(entry.price)+entry.productTotal+entry.additionalServiceTotal)}</strong>{entry.productTotal+entry.additionalServiceTotal>0?<small>Base {money(Number(entry.price))}{entry.additionalServiceTotal>0?` + servizi ${money(entry.additionalServiceTotal)}`:""}{entry.productTotal>0?` + prodotti ${money(entry.productTotal)}`:""}</small>:null}</div>
                {entry.previousOutstanding > 0 ? <small className="agenda-outstanding-badge">Sospeso {money(entry.previousOutstanding)} · Totale {money(entry.previousOutstanding + Number(entry.price))}</small> : null}
                <em>{statusLabels[entry.status]}</em>
                {entry.absenceConflict ? <strong className="agenda-absence-warning">⚠ Conflitto con assenza</strong> : null}
                {entry.rememberedNote ? <p className="agenda-remembered-note"><strong>Nota precedente:</strong> {entry.rememberedNote}</p> : null}
                <div className="agenda-action-buttons">
                  <button type="button" className="ghost-button" aria-label="Apri prenotazione" title="Apri prenotazione" onClick={event=>{event.stopPropagation();setEditFor(entry.id);}}>✎</button>
                  {editableStatuses.includes(entry.status)?<button type="button" className="agenda-complete-action" aria-label="Chiudi prenotazione" title="Chiudi prenotazione" onClick={event => {event.stopPropagation();setCompletionFor(entry.id);setCompletionNote(entry.rememberedNote ?? "");setCompletionPayment("PAID");setFailureFor("");}}>✓</button>:null}
                </div>
                {editFor===entry.id ? <section className="agenda-action-panel agenda-booking-modal" onClick={event=>event.stopPropagation()}><div className="agenda-panel-heading"><div><span className="eyebrow">Prenotazione</span><strong>{entry.customerName} · {entry.serviceName}</strong></div><button type="button" aria-label="Chiudi" onClick={()=>setEditFor("")}>×</button></div>
                  {data.canManage && editableStatuses.includes(entry.status) ? <details className="agenda-modal-section"><summary>Modifica servizio</summary><form action={changeAppointmentService} className="compact-form stacked"><input type="hidden" name="id" value={entry.id}/><label>Servizio<select name="serviceId" defaultValue={entry.serviceId}>{data.catalog.filter((option, index, all) => all.findIndex((item) => item.id === option.id) === index).map((option) => <option value={option.id} key={option.id}>{option.name} · {option.duration} min</option>)}</select></label><button className="ghost-button">Cambia servizio</button></form></details> : null}
                  <details className="agenda-modal-section"><summary>Sposta data o operatore</summary><form action={rescheduleAppointment}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input name="startsAt" type="datetime-local" required />
                    {data.canManage ? <label>Operatore<select name="staffId" defaultValue={entry.staffId}>
                      {data.staff.filter((memberOption) => data.catalog.some((catalogItem) => catalogItem.id === entry.serviceId && catalogItem.staffId === memberOption.id)).map((memberOption) => <option key={memberOption.id} value={memberOption.id}>{memberOption.name}</option>)}
                    </select></label> : null}
                    <button className="ghost-button">Invia proposta al cliente</button>
                  </form></details>
                  {data.canManage ? <details className="agenda-modal-section"><summary>Modifica prezzo</summary><AppointmentPriceEditor appointmentId={entry.id} price={entry.price} onSaved={load} /></details> : null}
                  {editableStatuses.includes(entry.status)?<details className="agenda-modal-section"><summary>Servizi aggiuntivi</summary><AdditionalServiceForm data={data} entry={entry} load={load} setError={setError}/></details>:null}
                  {data.inventoryEnabled&&! ["CANCELLED","NO_SHOW"].includes(entry.status)?<details className="agenda-modal-section"><summary>Prodotti e articoli</summary><ProductPanel data={data} entry={entry} close={()=>setEditFor("")} load={load} setError={setError}/></details>:null}
                  {editableStatuses.includes(entry.status)?<div className="agenda-modal-status"><button type="button" className="agenda-complete-action" onClick={()=>{setEditFor("");setCompletionFor(entry.id);setCompletionNote(entry.rememberedNote??"");}}>✓ Completa</button><button type="button" className="agenda-failure-action" onClick={()=>setFailureFor(failureFor===entry.id?"":entry.id)}>× Non concluso</button></div>:null}
                  {failureFor===entry.id?<div className="agenda-failure-reasons agenda-inline-panel"><button type="button" onClick={()=>void updateStatus(entry.id,"CANCELLED")}>Cancellato</button><button type="button" onClick={()=>void updateStatus(entry.id,"NO_SHOW")}>Non presentato</button></div>:null}
                </section> : null}
                {completionFor === entry.id ? <div className="agenda-completion-note agenda-inline-panel">
                    <label>Note del trattamento<textarea value={completionNote} maxLength={500} placeholder="Prodotti usati, preferenze, risultato…" onChange={(event) => setCompletionNote(event.target.value)} /></label>
                    {entry.rememberedNote ? <small>È stata precaricata la nota precedente di questo cliente per {entry.serviceName}.</small> : null}
                    {entry.previousOutstanding > 0 ? <div className="agenda-payment-summary"><span>Sospeso precedente</span><strong>{money(entry.previousOutstanding)}</strong><span>Servizio corrente</span><strong>{money(Number(entry.price))}</strong><span>Totale cliente</span><strong>{money(entry.previousOutstanding + Number(entry.price))}</strong></div> : null}
                    {data.canManage ? <label>Pagamento<select value={completionPayment} onChange={(event) => setCompletionPayment(event.target.value as "PAID" | "UNPAID")}><option value="PAID">Pagato</option><option value="UNPAID">In sospeso</option></select></label> : <small>Il pagamento sarà registrato come in sospeso e potrà essere verificato dal titolare.</small>}
                    <div><button type="button" className="agenda-note-confirm" onClick={() => void updateStatus(entry.id, "COMPLETED", completionNote, data.canManage ? completionPayment : "UNPAID")}>Conferma eseguito</button><button type="button" onClick={() => { setCompletionFor(""); setCompletionNote(""); setCompletionPayment("PAID"); }}>Annulla</button></div>
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




