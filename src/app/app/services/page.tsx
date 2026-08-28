import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { serviceCategories, services } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { AppNav } from "../app-nav";
import { createCategory, createService, toggleService } from "./actions";

export default async function ServicesPage() {
  const context = await requireBusinessContext();
  const categories = await db.select().from(serviceCategories)
    .where(eq(serviceCategories.businessId, context.businessId)).orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
  const catalog = await db.select({
    id: services.id, name: services.name, description: services.description, durationMinutes: services.durationMinutes,
    price: services.price, active: services.active, onlineBookable: services.onlineBookable, categoryName: serviceCategories.name,
  }).from(services).innerJoin(serviceCategories, and(eq(services.categoryId, serviceCategories.id), eq(serviceCategories.businessId, context.businessId)))
    .where(eq(services.businessId, context.businessId)).orderBy(asc(serviceCategories.name), asc(services.name));

  return <main className="dashboard-shell">
    <AppNav businessName={context.businessName} role={context.role} />
    <div className="page-heading"><div><p className="eyebrow">Catalogo</p><h1>Servizi</h1></div><p className="muted">Il listino alimenterà sito pubblico e prenotazioni.</p></div>
    <section className="management-grid">
      <article className="panel"><h2>Nuova categoria</h2><form action={createCategory} className="compact-form"><input name="name" placeholder="Es. Capelli" required minLength={2}/><button className="primary-button">Aggiungi</button></form></article>
      <article className="panel"><h2>Nuovo servizio</h2>{categories.length ? <form action={createService} className="compact-form stacked">
        <select name="categoryId" required>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
        <input name="name" placeholder="Nome servizio" required minLength={2}/><input name="description" placeholder="Descrizione breve" maxLength={180}/>
        <div className="form-row"><label>Durata (min)<input name="durationMinutes" type="number" min={5} step={5} defaultValue={30} required/></label><label>Prezzo (€)<input name="price" type="number" min={0} step="0.01" required/></label></div>
        <label className="checkbox-row"><input name="onlineBookable" type="checkbox" defaultChecked/> Prenotabile online</label><button className="primary-button">Crea servizio</button>
      </form> : <p className="muted">Crea prima una categoria.</p>}</article>
    </section>
    <section className="list-section"><h2>Listino</h2>{catalog.length ? <div className="data-list">{catalog.map(item => <article className="data-row" key={item.id}><div><p className="eyebrow">{item.categoryName}</p><h3>{item.name}</h3><p className="muted">{item.durationMinutes} min · € {Number(item.price).toFixed(2)} · {item.onlineBookable ? "Online" : "Solo interno"}</p>{item.description ? <p>{item.description}</p> : null}</div><form action={toggleService}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="active" value={String(item.active)}/><button className="ghost-button">{item.active ? "Disattiva" : "Riattiva"}</button></form></article>)}</div> : <div className="empty-state">Nessun servizio ancora.</div>}</section>
  </main>;
}
