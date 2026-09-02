"use client";

import { useActionState } from "react";

type StaffOption = { id: string; name: string };
type State = { ok: boolean; error?: string };

export function WorkingDayForm({ action, staff, weekdays }: {
  action: (state: State, formData: FormData) => Promise<State>;
  staff: StaffOption[];
  weekdays: string[];
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  return <form action={formAction} className="compact-form stacked">
    <label>Operatore<select name="staffId">{staff.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
    <label>Giorno<select name="weekday">{weekdays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label>
    <fieldset><legend>Primo turno</legend><div className="form-row"><label>Inizio<input name="firstStart" type="time" defaultValue="09:00" required/></label><label>Fine<input name="firstEnd" type="time" defaultValue="13:00" required/></label></div></fieldset>
    <fieldset><legend>Secondo turno (facoltativo)</legend><div className="form-row"><label>Inizio<input name="secondStart" type="time"/></label><label>Fine<input name="secondEnd" type="time"/></label></div></fieldset>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    {state.ok ? <p className="status-pill" role="status">Turni salvati correttamente.</p> : null}
    <button className="primary-button" disabled={pending}>{pending ? "Salvataggio…" : "Salva giornata"}</button>
  </form>;
}
