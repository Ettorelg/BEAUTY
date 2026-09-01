"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";

type StaffOption = { id: string; name: string };
type Conflict = {
  id: string;
  customerName: string;
  customerEmail: string | null;
  serviceName: string;
  startsAtLabel: string;
  agendaDate: string;
  suggestions: Array<{ label: string; staffName: string; date: string }>;
};

export function AbsenceForm({ action, staff, ownName }: {
  action: (formData: FormData) => void | Promise<void>;
  staff?: StaffOption[];
  ownName?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const approved = useRef(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (approved.current) return;
    event.preventDefault();
    setChecking(true);
    setError("");
    setConflicts([]);
    try {
      const form = new FormData(event.currentTarget);
      const query = new URLSearchParams({
        startsAt: String(form.get("startsAt") ?? ""),
        endsAt: String(form.get("endsAt") ?? ""),
      });
      const staffId = form.get("staffId");
      if (staffId) query.set("staffId", String(staffId));
      const response = await fetch(`/api/staff/absence-conflicts?${query}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossibile controllare gli appuntamenti.");
      if (result.conflicts.length) {
        setConflicts(result.conflicts);
        return;
      }
      approved.current = true;
      event.currentTarget.requestSubmit();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossibile controllare gli appuntamenti.");
    } finally {
      setChecking(false);
    }
  }

  function forceSave() {
    const form = formRef.current;
    if (!form) return;
    const force = form.elements.namedItem("force") as HTMLInputElement;
    force.value = "1";
    approved.current = true;
    form.requestSubmit();
  }

  return <form ref={formRef} action={action} onSubmit={submit} className="compact-form stacked">
    {staff?.length ? <label>Operatore<select name="staffId">{staff.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label> : null}
    {ownName ? <p className="muted">Operatore: <strong>{ownName}</strong></p> : null}
    <div className="form-row"><label>Da<input name="startsAt" type="datetime-local" required onChange={() => setConflicts([])}/></label><label>A<input name="endsAt" type="datetime-local" required onChange={() => setConflicts([])}/></label></div>
    <input name="reason" placeholder="Motivo (opzionale)"/>
    <input name="force" type="hidden" defaultValue="0"/>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {conflicts.length ? <div className="absence-conflicts" role="alert"><h3>Appuntamenti da sistemare</h3><p>Prima di registrare l’assenza, sposta o cancella questi appuntamenti per non lasciare i clienti senza servizio.</p>{conflicts.map(item => <article className="data-row" key={item.id}><div><strong>{item.customerName}</strong><p>{item.serviceName} · {item.startsAtLabel}</p>{item.customerEmail ? <p className="muted">Email: {item.customerEmail}</p> : <p className="form-error">Cliente senza email</p>}{item.suggestions.length ? <div><strong>Prime alternative:</strong><ul>{item.suggestions.map(slot => <li key={`${slot.date}-${slot.label}-${slot.staffName}`}>{slot.date} alle {slot.label} · {slot.staffName}</li>)}</ul></div> : <p className="muted">Nessuna alternativa trovata nei prossimi 14 giorni.</p>}</div><Link className="ghost-button link-button" href={`/app/agenda?date=${item.agendaDate}&view=day`}>Sposta in agenda</Link></article>)}<button className="danger-button" type="button" onClick={forceSave}>Registra comunque e avvisa i clienti</button><p className="muted">Gli appuntamenti resteranno in agenda con un avviso evidente finché non verranno spostati o cancellati.</p></div> : <button className="primary-button" disabled={checking}>{checking ? "Controllo appuntamenti…" : "Controlla e registra assenza"}</button>}
  </form>;
}
