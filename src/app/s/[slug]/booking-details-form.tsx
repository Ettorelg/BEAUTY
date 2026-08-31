"use client";

import { useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { calculateBookingPriceCents } from "@/modules/fidelity/domain/booking-price";

type Reward = { id: string; points: number; type: string; value: number; serviceId: string | null };
type Slot = { staffId: string; localStart: string; label: string; operatorsLabel: string };

const inputStyle = { minHeight: 46, padding: "10px 12px", border: "1px solid #d8cec8", borderRadius: 11, width: "100%" };
const euro = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);

function rewardLabel(reward: Reward) {
  if (reward.type === "FREE_SERVICE") return `${reward.points} punti · servizio omaggio`;
  if (reward.type === "DISCOUNT_PERCENT") return `${reward.points} punti · ${reward.value}% di sconto`;
  return `${reward.points} punti · ${euro(reward.value / 100)} di sconto`;
}

export function BookingDetailsForm({ action, slug, serviceId, slots, name, email, phone, rewards, basePrice, promotionDiscount, allowRewardStacking }: {
  action: (formData: FormData) => void | Promise<void>;
  slug: string;
  serviceId: string;
  slots: Slot[];
  name: string;
  email: string;
  phone: string;
  rewards: Reward[];
  basePrice: number;
  promotionDiscount: number;
  allowRewardStacking: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [guest, setGuest] = useState(false);
  const [rewardId, setRewardId] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  const logged = Boolean(email);
  const canAuto = logged && phone.trim().length >= 6;
  const accountName = name.trim() || email.split("@")[0] || "Cliente";
  const reward = rewards.find((item) => item.id === rewardId);
  const price = useMemo(() => calculateBookingPriceCents(Math.round(basePrice * 100), promotionDiscount, reward, allowRewardStacking) / 100, [basePrice, promotionDiscount, reward, allowRewardStacking]);
  const selectedSlot = slots.find((slot) => slot.localStart === selected);

  async function google() {
    await authClient.signIn.social({ provider: "google", callbackURL: window.location.href });
  }

  return <form ref={ref} action={action} className="public-booking-form">
    <input type="hidden" name="slug" value={slug}/>
    <input type="hidden" name="serviceId" value={serviceId}/>
    <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()}/>
    {canAuto ? <><input type="hidden" name="customerName" value={accountName}/><input type="hidden" name="email" value={email}/><input type="hidden" name="phone" value={phone}/></> : null}

    <div className="booking-times-column">
      <p className="eyebrow">Orari disponibili</p>
      <div className="slot-grid">{slots.map((slot) => <label className="slot" key={slot.localStart}>
        <input type="radio" name="selection" value={`${slot.staffId}|${slot.localStart}`} required onChange={() => { setSelected(slot.localStart); setGuest(false); }}/>
        <span>{slot.label}<small>{slot.operatorsLabel}</small></span>
      </label>)}</div>
    </div>

    <aside className="booking-confirmation-panel">
      <p className="eyebrow">Riepilogo</p>
      <h3>{selectedSlot ? `Appuntamento alle ${selectedSlot.label}` : "Scegli un orario"}</h3>
      {!selectedSlot ? <p className="muted">Seleziona una disponibilità a sinistra per confermare.</p> : null}

      {selected && logged && rewards.length ? <section className="booking-reward-picker">
        <div><strong>Usa i tuoi punti</strong><p className="muted">Saranno scalati soltanto dopo la conferma.</p></div>
        <select name="rewardRuleId" value={rewardId} onChange={(event) => setRewardId(event.target.value)}><option value="">Non usare punti</option>{rewards.map((item) => <option value={item.id} key={item.id}>{rewardLabel(item)}</option>)}</select>
      </section> : null}
      {selected ? <p className="booking-final-price"><span>Totale prenotazione</span><strong>{euro(price)}</strong></p> : null}

      {selected && !guest ? <section className="booking-confirm-actions">
        {canAuto ? <><p className="muted">Prenoti come <strong>{accountName}</strong>.</p><button className="primary-button">Conferma prenotazione</button></> : <>
          <button type="button" className="primary-button" onClick={() => setGuest(true)}>{logged ? "Inserisci telefono e conferma" : "Prenota come ospite"}</button>
          {!logged ? <button type="button" className="ghost-button" onClick={google}>Accedi con Google</button> : null}
        </>}
      </section> : null}

      {guest ? <section className="booking-guest-fields">
        <h3>I tuoi dati</h3>
        <input style={inputStyle} name="customerName" defaultValue={logged ? accountName : ""} placeholder="Nome e cognome" required readOnly={logged}/>
        <input style={inputStyle} name="email" type="email" defaultValue={email} placeholder="Email" required readOnly={logged}/>
        <input style={inputStyle} name="phone" type="tel" defaultValue={phone} placeholder="Telefono" required/>
        <button className="primary-button">Conferma prenotazione</button>
        {!logged ? <button type="button" className="ghost-button" onClick={google}>Accedi con Google e conferma</button> : null}
      </section> : null}
    </aside>
  </form>;
}
