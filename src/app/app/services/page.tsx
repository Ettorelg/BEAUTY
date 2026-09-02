import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { serviceCategories, services } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensureServicePricingSchema } from "@/lib/ensure-service-pricing-schema";
import { AppNav } from "../app-nav";
import { ConfirmSubmitButton } from "../confirm-submit-button";
import { createCategory, createService, deleteService, updateService } from "./actions";

export default async function ServicesPage() {
  const context = await requireBusinessContext();
  await ensureServicePricingSchema();
  const categories = await db.select().from(serviceCategories)
    .where(and(eq(serviceCategories.businessId, context.businessId), eq(serviceCategories.active, true))).orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
  const catalog = await db.select({
    id: services.id, categoryId: services.categoryId, name: services.name, description: services.description, durationMinutes: services.durationMinutes,
    price: services.price, repeatPrice: services.repeatPrice, onlineBookable: services.onlineBookable, categoryName: serviceCategories.name,
  }).from(services).innerJoin(serviceCategories, and(eq(services.categoryId, serviceCategories.id), eq(serviceCategories.businessId, context.businessId)))
    .where(and(eq(services.businessId, context.businessId), eq(services.active, true))).orderBy(asc(serviceCategories.name), asc(services.name));
  const categorizedCatalog = categories.map((category) => ({
    ...category,
    services: catalog.filter((service) => service.categoryId === category.id),
  }));

  return <main className="dashboard-shell">
    <AppNav businessName={context.businessName} role={context.role} />
    <div className="page-heading"><div><p className="eyebrow">Catalogo</p><h1>Servizi</h1></div><p className="muted">Il listino alimenterà sito pubblico e prenotazioni.</p></div>
    <section className="management-grid">
      <article className="panel"><h2>Nuova categoria</h2><form action={createCategory} className="compact-form"><input name="name" placeholder="Es. Capelli" required minLength={2}/><button className="primary-button">Aggiungi</button></form><div className="category-list"><p className="eyebrow">Categorie inserite</p>{categories.length ? <div className="category-chips">{categories.map(category => <span className="category-chip" key={category.id}>{category.name}</span>)}</div> : <p className="muted">Nessuna categoria ancora.</p>}</div></article>
      <article className="panel"><h2>Nuovo servizio</h2>{categories.length ? <form action={createService} className="compact-form stacked">
        <select name="categoryId" required>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
        <input name="name" placeholder="Nome servizio" required minLength={2}/><input name="description" placeholder="Descrizione breve" maxLength={180}/>
        <div className="form-row"><label>Durata (min)<input name="durationMinutes" type="number" min={5} step={5} defaultValue={30} required/></label><label>Prezzo prima prenotazione (€)<input name="price" type="number" min={0} step="0.01" required/></label><label>Prezzo dalla seconda (€)<input name="repeatPrice" type="number" min={0} step="0.01" placeholder="Uguale al primo"/></label></div>
        <label className="checkbox-row"><input name="onlineBookable" type="checkbox" defaultChecked/> Prenotabile online</label><button className="primary-button">Crea servizio</button>
      </form> : <p className="muted">Crea prima una categoria.</p>}</article>
    </section>
    <section className="list-section"><h2>Listino per categoria</h2>{categorizedCatalog.length ? <div className="data-list">{categorizedCatalog.map((category) => <section className="panel" key={category.id}><p className="eyebrow">Categoria</p><h2>{category.name}</h2>{category.services.length ? <div className="data-list">{category.services.map(item => <article className="data-row" key={item.id}><div><h3>{item.name}</h3><p className="muted">{item.durationMinutes} min · prima € {Number(item.price).toFixed(2)}{item.repeatPrice != null ? ` · successive € ${Number(item.repeatPrice).toFixed(2)}` : " · stesso prezzo successive"} · {item.onlineBookable ? "Online" : "Solo interno"}</p>{item.description ? <p>{item.description}</p> : null}<details className="edit-disclosure"><summary>Modifica servizio</summary><form action={updateService} className="compact-form stacked"><input type="hidden" name="id" value={item.id}/><input type="hidden" name="categoryId" value={item.categoryId}/><input name="name" defaultValue={item.name} required/><input name="description" defaultValue={item.description ?? ""}/><div className="form-row"><label>Durata<input name="durationMinutes" type="number" min="5" max="480" defaultValue={item.durationMinutes} required/></label><label>Prima prenotazione<input name="price" type="number" min="0" step="0.01" defaultValue={item.price} required/></label><label>Dalla seconda<input name="repeatPrice" type="number" min="0" step="0.01" defaultValue={item.repeatPrice ?? ""} placeholder="Uguale"/></label></div><label className="checkbox-row"><input name="onlineBookable" type="checkbox" defaultChecked={item.onlineBookable}/> Prenotabile online</label><button className="ghost-button">Salva modifiche</button></form></details></div><form action={deleteService} className="delete-form"><input type="hidden" name="id" value={item.id}/><details><summary className="danger-button">Elimina servizio</summary><p className="muted">Confermi la rimozione di {item.name}?</p><button className="danger-button" type="submit">Conferma eliminazione</button></details></form></article>)}</div> : <div className="empty-state">Nessun servizio in questa categoria.</div>}</section>)}</div> : <div className="empty-state">Nessuna categoria ancora.</div>}</section>
  </main>;
}





