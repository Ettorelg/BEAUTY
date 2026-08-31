"use client";

import { useState } from "react";
import { updateAppointmentPrice } from "./price-actions";

export function AppointmentPriceEditor({ appointmentId, price, onSaved }: { appointmentId: string; price: string; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(formData: FormData) {
    setSaving(true);
    setMessage("");
    const result = await updateAppointmentPrice(formData);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.error ?? "Impossibile modificare il prezzo.");
      return;
    }
    setMessage("Prezzo aggiornato.");
    await onSaved();
  }

  return <form className="agenda-price-editor compact-form stacked" action={save}>
    <input type="hidden" name="id" value={appointmentId} />
    <label>
      Prezzo appuntamento (€)
      <input name="price" type="number" inputMode="decimal" min="0" max="9999999.99" step="0.01" defaultValue={Number(price).toFixed(2)} required />
    </label>
    <button className="ghost-button" type="submit" disabled={saving}>{saving ? "Salvataggio…" : "Aggiorna prezzo"}</button>
    {message ? <small className={message === "Prezzo aggiornato." ? "agenda-price-success" : "agenda-price-error"} aria-live="polite">{message}</small> : null}
  </form>;
}
