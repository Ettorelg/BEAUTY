import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  fidelityCards,
  fidelityPromotions,
  fidelityRules,
  fidelitySettings,
  services,
} from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensureFidelitySchema } from "@/lib/ensure-fidelity-schema";
import { AppNav } from "../app-nav";
import { ConfirmSubmitButton } from "../confirm-submit-button";
import {
  addFidelityRule,
  addPromotion,
  deleteFidelityRule,
  deletePromotion,
  saveFidelitySettings,
  sendPromotionToAllCustomers,
} from "./actions";

const reward = (type: string, value: number, service?: string | null) =>
  type === "FREE_SERVICE"
    ? `Servizio omaggio: ${service ?? "servizio"}`
    : type === "DISCOUNT_PERCENT"
      ? `${value}% di sconto`
      : `€ ${(value / 100).toFixed(2)} di sconto`;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; rule?: string; promo?: string; sent?: string; failed?: string }>;
}) {
  const c = await requireBusinessContext();
  const q = await searchParams;
  await ensureFidelitySchema();
  const [[settings], catalog, cards, rules, promotions] = await Promise.all([
    db
      .select()
      .from(fidelitySettings)
      .where(eq(fidelitySettings.businessId, c.businessId)),
    db
      .select({ id: services.id, name: services.name })
      .from(services)
      .where(
        and(eq(services.businessId, c.businessId), eq(services.active, true)),
      )
      .orderBy(asc(services.name)),
    db
      .select({ id: fidelityCards.id })
      .from(fidelityCards)
      .where(eq(fidelityCards.businessId, c.businessId)),
    db
      .select({
        id: fidelityRules.id,
        points: fidelityRules.points,
        type: fidelityRules.type,
        value: fidelityRules.value,
        serviceId: fidelityRules.serviceId,
      })
      .from(fidelityRules)
      .where(eq(fidelityRules.businessId, c.businessId))
      .orderBy(asc(fidelityRules.points)),
    db
      .select({
        id: fidelityPromotions.id,
        discount: fidelityPromotions.discountPercent,
        startsAt: fidelityPromotions.startsAt,
        endsAt: fidelityPromotions.endsAt,
        serviceName: services.name,
      })
      .from(fidelityPromotions)
      .innerJoin(services, eq(services.id, fidelityPromotions.serviceId))
      .where(eq(fidelityPromotions.businessId, c.businessId))
      .orderBy(asc(fidelityPromotions.startsAt)),
  ]);
  const names = new Map(catalog.map((x) => [x.id, x.name]));
  return (
    <main className="dashboard-shell">
      <AppNav businessName={c.businessName} role={c.role} />
      <section className="page-heading">
        <div>
          <p className="eyebrow">Clienti</p>
          <h1>Fidelity e promozioni</h1>
        </div>
      </section>
      {q.saved || q.rule || q.promo ? (
        <p className="success-message">Modifiche salvate correttamente.</p>
      ) : null}
      {q.sent ? <p className="success-message">Promozione inviata a {q.sent} clienti{q.failed && q.failed!=="0"?` · ${q.failed} invii non riusciti`:""}.</p>:null}
      <section className="management-grid">
        <article className="panel">
          <h2>Assegnazione punti</h2>
          <form action={saveFidelitySettings} className="compact-form stacked">
            <label>
              Modalità di assegnazione
              <select
                name="awardMode"
                defaultValue={settings?.awardMode ?? "BY_SPEND"}
              >
                <option value="BY_SPEND">In base alla spesa</option>
                <option value="PER_SERVICE">
                  Per ogni servizio effettuato
                </option>
                <option value="PER_APPOINTMENT">
                  Per ogni prenotazione completata
                </option>
              </select>
            </label>
            <label>
              Ogni € spesi (usato solo per la modalità spesa)
              <input
                name="spendEuros"
                type="number"
                min="1"
                step=".01"
                defaultValue={(settings?.spendCents ?? 1000) / 100}
              />
            </label>
            <label>
              Punti assegnati
              <input
                name="pointsAward"
                type="number"
                min="1"
                defaultValue={settings?.pointsAward ?? 1}
              />
            </label>
            <label>
              Validità punti (mesi)
              <input
                name="pointsValidityMonths"
                type="number"
                min="1"
                max="60"
                defaultValue={settings?.pointsValidityMonths ?? 12}
              />
            </label>
            <label className="checkbox-row">
              <input
                name="allowRewardStacking"
                type="checkbox"
                defaultChecked={settings?.allowRewardStacking ?? false}
              />{" "}
              Consenti cumulo tra promozione e premio Fidelity
            </label>
            <p className="muted">
              Se il cumulo è disattivato, viene applicato automaticamente lo
              sconto più conveniente.
            </p>
            <button className="primary-button">Salva assegnazione</button>
          </form>
          <h2>Nuovo obiettivo bonus</h2>
          <form action={addFidelityRule} className="compact-form stacked">
            <label>
              Soglia punti
              <input name="points" type="number" min="1" required />
            </label>
            <label>
              Premio
              <select name="type">
                <option value="DISCOUNT_PERCENT">Sconto percentuale</option>
                <option value="DISCOUNT_EUR">Sconto in euro</option>
                <option value="FREE_SERVICE">Servizio omaggio</option>
              </select>
            </label>
            <label>
              Valore sconto
              <input
                name="value"
                type="number"
                min="0"
                step=".01"
                defaultValue="0"
              />
            </label>
            <label>
              Servizio omaggio
              <select name="serviceId">
                <option value="">Seleziona</option>
                {catalog.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button">Aggiungi regola</button>
          </form>
        </article>
        <article className="panel">
          <h2>Regole attive</h2>
          {rules.length ? (
            rules.map((x) => (
              <div className="data-row" key={x.id}>
                <div>
                  <strong>{x.points} punti</strong>
                  <p>
                    {reward(
                      x.type,
                      x.value,
                      x.serviceId ? names.get(x.serviceId) : null,
                    )}
                  </p>
                </div>
                <form action={deleteFidelityRule}>
                  <input type="hidden" name="id" value={x.id} />
                  <button className="danger-button">Elimina</button>
                </form>
              </div>
            ))
          ) : (
            <p className="muted">Nessuna regola inserita.</p>
          )}
          <p>
            <strong>{cards.length}</strong> Fidelity Card attive.
          </p>
        </article>
      </section>
      <section className="management-grid">
        <article className="panel">
          <h2>Nuova promozione a tempo</h2>
          <form action={addPromotion} className="compact-form stacked">
            <label>
              Servizio
              <select name="serviceId" required>
                <option value="">Seleziona</option>
                {catalog.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sconto %
              <input
                name="discountPercent"
                type="number"
                min="1"
                max="100"
                required
              />
            </label>
            <label>
              Inizio
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label>
              Fine
              <input name="endsAt" type="datetime-local" required />
            </label>
            <button className="primary-button">Attiva promozione</button>
          </form>
        </article>
        <article className="panel">
          <h2>Promozioni</h2>
          {promotions.length ? (
            promotions.map((x) => (
              <div className="data-row" key={x.id}>
                <div>
                  <strong>
                    {x.serviceName} · -{x.discount}%
                  </strong>
                  <p className="muted">
                    {x.startsAt.toLocaleString("it-IT", {
                      timeZone: c.timezone,
                    })}{" "}
                    –{" "}
                    {x.endsAt.toLocaleString("it-IT", { timeZone: c.timezone })}
                  </p>
                  <span className="status-pill">
                    {x.startsAt > new Date()
                      ? "Programmata"
                      : x.endsAt < new Date()
                        ? "Scaduta"
                        : "Attiva"}
                  </span>
                </div>
                <div className="promotion-actions"><form action={sendPromotionToAllCustomers}><input type="hidden" name="id" value={x.id}/><ConfirmSubmitButton className="primary-button" message={`Inviare la promozione ${x.serviceName} a tutti i clienti con un indirizzo email?`}>✉ Invia a tutti</ConfirmSubmitButton></form><form action={deletePromotion}><input type="hidden" name="id" value={x.id}/><button className="danger-button">Elimina</button></form></div>
              </div>
            ))
          ) : (
            <p className="muted">Nessuna promozione programmata.</p>
          )}
        </article>
      </section>
    </main>
  );
}
