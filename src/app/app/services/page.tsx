import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { serviceCategories, serviceWaitlist, services, staffMembers } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensureServicePricingSchema } from "@/lib/ensure-service-pricing-schema";
import { AppNav } from "../app-nav";
import { ConfirmSubmitButton } from "../confirm-submit-button";
import {
  createCategory,
  createService,
  deleteService,
  removeWaitlistEntry,
  updateService,
} from "./actions";

export default async function ServicesPage() {
  const context = await requireBusinessContext();
  await ensureServicePricingSchema();
  const categories = await db
    .select()
    .from(serviceCategories)
    .where(
      and(
        eq(serviceCategories.businessId, context.businessId),
        eq(serviceCategories.active, true),
      ),
    )
    .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
  const catalog = await db
    .select({
      id: services.id,
      categoryId: services.categoryId,
      name: services.name,
      description: services.description,
      durationMinutes: services.durationMinutes,
      price: services.price,
      repeatPrice: services.repeatPrice,
      repeatPriceEnabled: services.repeatPriceEnabled,
      repeatDurationMinutes: services.repeatDurationMinutes,
      onlineBookable: services.onlineBookable,
      capacity: services.capacity,
      waitlistEnabled: services.waitlistEnabled,
      waitlistConfirmationMinutes: services.waitlistConfirmationMinutes,
      categoryName: serviceCategories.name,
    })
    .from(services)
    .innerJoin(
      serviceCategories,
      and(
        eq(services.categoryId, serviceCategories.id),
        eq(serviceCategories.businessId, context.businessId),
      ),
    )
    .where(
      and(
        eq(services.businessId, context.businessId),
        eq(services.active, true),
      ),
    )
    .orderBy(asc(serviceCategories.name), asc(services.name));
  const categorizedCatalog = categories.map((category) => ({
    ...category,
    services: catalog.filter((service) => service.categoryId === category.id),
  }));
  const waitlist = context.role === "OWNER" ? await db.select({ id: serviceWaitlist.id, customerName: serviceWaitlist.customerName, email: serviceWaitlist.email, phone: serviceWaitlist.phone, startsAt: serviceWaitlist.startsAt, requestedDay: serviceWaitlist.requestedDay, status: serviceWaitlist.status, offeredAt: serviceWaitlist.offeredAt, expiresAt: serviceWaitlist.offerExpiresAt, createdAt: serviceWaitlist.createdAt, serviceName: services.name, staffName: staffMembers.name }).from(serviceWaitlist).innerJoin(services, eq(services.id, serviceWaitlist.serviceId)).innerJoin(staffMembers, eq(staffMembers.id, serviceWaitlist.staffId)).where(and(eq(serviceWaitlist.businessId, context.businessId), inArray(serviceWaitlist.status, ["WAITING", "OFFERED"]))).orderBy(asc(serviceWaitlist.createdAt)).limit(100) : [];

  return (
    <main className="dashboard-shell">
      <AppNav businessName={context.businessName} role={context.role} />
      <div className="page-heading">
        <div>
          <p className="eyebrow">Catalogo</p>
          <h1>Servizi</h1>
        </div>
        <p className="muted">
          Il listino alimenterà sito pubblico e prenotazioni.
        </p>
      </div>
      <section className="management-grid compact-management-grid">
        <details className="panel action-disclosure">
          <summary>
            <span>
              <b>Nuova categoria</b>
              <small>Crea e organizza le categorie</small>
            </span>
            <i>＋</i>
          </summary>
          <div className="action-disclosure-body">
            <form action={createCategory} className="compact-form">
              <input
                name="name"
                placeholder="Es. Capelli"
                required
                minLength={2}
              />
              <button className="primary-button">Aggiungi</button>
            </form>
            <div className="category-list">
              <p className="eyebrow">Categorie inserite</p>
              {categories.length ? (
                <div className="category-chips">
                  {categories.map((category) => (
                    <span className="category-chip" key={category.id}>
                      {category.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">Nessuna categoria ancora.</p>
              )}
            </div>
          </div>
        </details>
        <details className="panel action-disclosure">
          <summary>
            <span>
              <b>Nuovo servizio</b>
              <small>Aggiungi una voce al listino</small>
            </span>
            <i>＋</i>
          </summary>
          <div className="action-disclosure-body">
            {categories.length ? (
              <form action={createService} className="compact-form stacked">
                <select name="categoryId" required>
                  {categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  name="name"
                  placeholder="Nome servizio"
                  required
                  minLength={2}
                />
                <input
                  name="description"
                  placeholder="Descrizione breve"
                  maxLength={180}
                />
                <div className="form-row">
                  <label>
                    Durata (min)
                    <input
                      name="durationMinutes"
                      type="number"
                      min={5}
                      step={5}
                      defaultValue={30}
                      required
                    />
                  </label>
                  <label>
                    Prezzo prima prenotazione (€)
                    <input
                      name="price"
                      type="number"
                      min={0}
                      step="0.01"
                      required
                    />
                  </label>
                  <label>
                    Prezzo dalla seconda (€)
                    <input
                      name="repeatPrice"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Prezzo scontato"
                    />
                  </label>
                  <label>
                    Durata dalla seconda (min)
                    <input
                      name="repeatDurationMinutes"
                      type="number"
                      min={5}
                      max={480}
                      step={5}
                      placeholder="Uguale alla prima"
                    />
                  </label>
                </div>
                <label className="checkbox-row">
                  <input name="repeatPriceEnabled" type="checkbox" /> Abilita
                  prezzo diverso dalla seconda prenotazione
                </label>
                <label>
                  Posti disponibili
                  <input
                    name="capacity"
                    type="number"
                    min="1"
                    max="500"
                    defaultValue="1"
                  />
                </label>
                <label className="checkbox-row">
                  <input name="waitlistEnabled" type="checkbox" /> Attiva lista
                  d’attesa quando i posti terminano
                </label>
                <label>
                  Tempo per confermare il posto offerto (minuti)
                  <input
                    name="waitlistConfirmationMinutes"
                    type="number"
                    min="15"
                    max="10080"
                    defaultValue="120"
                  />
                </label>
                <label className="checkbox-row">
                  <input name="onlineBookable" type="checkbox" defaultChecked />{" "}
                  Prenotabile online
                </label>
                <button className="primary-button">Crea servizio</button>
              </form>
            ) : (
              <p className="muted">Crea prima una categoria.</p>
            )}
          </div>
        </details>
      </section>
      {context.role === "OWNER" ? <details className="panel action-disclosure">
        <summary><span><b>Lista d’attesa</b><small>{waitlist.length ? `${waitlist.length} richieste attive` : "Nessuna richiesta attiva"}</small></span><i>＋</i></summary>
        <div className="action-disclosure-body">
          {waitlist.length ? <div className="data-list">{waitlist.map(entry => <article className="data-row" key={entry.id}><div><h3>{entry.customerName}</h3><p><strong>{entry.serviceName}</strong> · {entry.requestedDay ? `giornata ${new Date(`${entry.requestedDay}T12:00:00Z`).toLocaleDateString("it-IT")}` : entry.startsAt.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: context.timezone })} · {entry.staffName}</p><p className="muted">{entry.email}{entry.phone ? ` · ${entry.phone}` : ""} · {entry.status === "OFFERED" ? `offerta inviata${entry.expiresAt ? `, scade ${entry.expiresAt.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: context.timezone })}` : ""}` : "in attesa"}</p></div><form action={removeWaitlistEntry}><input type="hidden" name="id" value={entry.id}/><ConfirmSubmitButton message={`Rimuovere ${entry.customerName} dalla lista d’attesa?`} className="danger-button">Rimuovi</ConfirmSubmitButton></form></article>)}</div> : <div className="empty-state">Quando un cliente si iscrive alla lista d’attesa, comparirà qui.</div>}
        </div>
      </details> : null}
      <section className="list-section">
        <h2>Listino per categoria</h2>
        {categorizedCatalog.length ? (
          <div className="data-list">
            {categorizedCatalog.map((category) => (
              <section className="panel" key={category.id}>
                <p className="eyebrow">Categoria</p>
                <h2>{category.name}</h2>
                {category.services.length ? (
                  <div className="data-list">
                    {category.services.map((item) => (
                      <article className="data-row" key={item.id}>
                        <div>
                          <h3>{item.name}</h3>
                          <p className="muted">
                            {item.durationMinutes} min
                            {item.repeatDurationMinutes != null
                              ? ` · dalla seconda ${item.repeatDurationMinutes} min`
                              : ""}{" "}
                            · prima € {Number(item.price).toFixed(2)}
                            {item.repeatPriceEnabled && item.repeatPrice != null
                              ? ` · successive € ${Number(item.repeatPrice).toFixed(2)}`
                              : " · prezzo pieno successive"}{" "}
                            · {item.onlineBookable ? "Online" : "Solo interno"}
                            {item.capacity > 1 ? ` · ${item.capacity} posti${item.waitlistEnabled ? " · lista d’attesa attiva" : ""}` : ""}
                          </p>
                          {item.description ? <p>{item.description}</p> : null}
                          <details className="edit-disclosure">
                            <summary>Modifica servizio</summary>
                            <form
                              action={updateService}
                              className="compact-form stacked"
                            >
                              <input type="hidden" name="id" value={item.id} />
                              <input
                                type="hidden"
                                name="categoryId"
                                value={item.categoryId}
                              />
                              <input
                                name="name"
                                defaultValue={item.name}
                                required
                              />
                              <input
                                name="description"
                                defaultValue={item.description ?? ""}
                              />
                              <div className="form-row">
                                <label>
                                  Durata
                                  <input
                                    name="durationMinutes"
                                    type="number"
                                    min="5"
                                    max="480"
                                    defaultValue={item.durationMinutes}
                                    required
                                  />
                                </label>
                                <label>
                                  Prima prenotazione
                                  <input
                                    name="price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={item.price}
                                    required
                                  />
                                </label>
                                <label>
                                  Dalla seconda
                                  <input
                                    name="repeatPrice"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={item.repeatPrice ?? ""}
                                    placeholder="Prezzo scontato"
                                  />
                                </label>
                                <label>
                                  Durata dalla seconda
                                  <input
                                    name="repeatDurationMinutes"
                                    type="number"
                                    min="5"
                                    max="480"
                                    step="5"
                                    defaultValue={
                                      item.repeatDurationMinutes ?? ""
                                    }
                                    placeholder="Uguale alla prima"
                                  />
                                </label>
                              </div>
                              <label className="checkbox-row">
                                <input
                                  name="repeatPriceEnabled"
                                  type="checkbox"
                                  defaultChecked={item.repeatPriceEnabled}
                                />{" "}
                                Abilita prezzo diverso dalla seconda
                                prenotazione
                              </label>
                              <label className="checkbox-row">
                                <input
                                  name="onlineBookable"
                                  type="checkbox"
                                  defaultChecked={item.onlineBookable}
                                />{" "}
                                Prenotabile online
                              </label>
                              <label>Posti disponibili<input name="capacity" type="number" min="1" max="500" defaultValue={item.capacity}/></label>
                              <label className="checkbox-row"><input name="waitlistEnabled" type="checkbox" defaultChecked={item.waitlistEnabled}/> Attiva lista d’attesa quando i posti terminano</label>
                              <label>Tempo per confermare il posto (minuti)<input name="waitlistConfirmationMinutes" type="number" min="15" max="10080" defaultValue={item.waitlistConfirmationMinutes}/></label>
                              <button className="ghost-button">
                                Salva modifiche
                              </button>
                            </form>
                          </details>
                        </div>
                        <form action={deleteService} className="delete-form">
                          <input type="hidden" name="id" value={item.id} />
                          <details>
                            <summary className="danger-button">
                              Elimina servizio
                            </summary>
                            <p className="muted">
                              Confermi la rimozione di {item.name}?
                            </p>
                            <button className="danger-button" type="submit">
                              Conferma eliminazione
                            </button>
                          </details>
                        </form>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    Nessun servizio in questa categoria.
                  </div>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="empty-state">Nessuna categoria ancora.</div>
        )}
      </section>
    </main>
  );
}
