import Link from "next/link";
import { requireBusinessContext } from "@/lib/business-context";
import { AppNav } from "./app-nav";

export default async function AppPage() {
  const context = await requireBusinessContext();

  return (
    <main className="dashboard-shell">
      <AppNav businessName={context.businessName} role={context.role} />
      <section className="welcome-panel">
        <div>
          <p className="muted">{context.locationName}</p>
          <h1>Ciao, {context.user.name}.</h1>
          <p>La base del tuo spazio di lavoro è pronta.</p>
        </div>
        <span className="status-pill">Tenant isolato</span>
      </section>
      <section className="module-grid">
        <Link className="module-card module-link" href="/app/services"><h2>Servizi</h2><p>Gestisci listino e categorie</p></Link>
        <Link className="module-card module-link" href="/app/staff"><h2>Staff</h2><p>Operatori, turni e assenze</p></Link>
        {["Agenda", "Clienti", "Fidelity", "Impostazioni"].map((name) => <article className="module-card" key={name}><h2>{name}</h2><p>In preparazione</p></article>)}
      </section>
    </main>
  );
}
