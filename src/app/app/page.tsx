import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { businessMemberships, businesses, locations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { LogoutButton } from "./logout-button";

export default async function AppPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const membership = await db
    .select({
      role: businessMemberships.role,
      businessId: businesses.id,
      businessName: businesses.name,
      locationName: locations.name,
    })
    .from(businessMemberships)
    .innerJoin(businesses, eq(businessMemberships.businessId, businesses.id))
    .innerJoin(locations, eq(locations.businessId, businesses.id))
    .where(eq(businessMemberships.userId, session.user.id))
    .limit(1);

  if (!membership[0]) redirect("/onboarding");
  const tenant = membership[0];

  return (
    <main className="dashboard-shell">
      <header className="app-header">
        <div><p className="eyebrow">{tenant.role}</p><strong>{tenant.businessName}</strong></div>
        <LogoutButton />
      </header>
      <section className="welcome-panel">
        <div>
          <p className="muted">{tenant.locationName}</p>
          <h1>Ciao, {session.user.name}.</h1>
          <p>La base del tuo spazio di lavoro è pronta.</p>
        </div>
        <span className="status-pill">Tenant isolato</span>
      </section>
      <section className="module-grid">
        {[
          ["Agenda", "Prossima fase"],
          ["Servizi", "Prossima fase"],
          ["Staff", "Prossima fase"],
          ["Clienti", "In preparazione"],
          ["Fidelity", "In preparazione"],
          ["Impostazioni", "In preparazione"],
        ].map(([name, status]) => <article className="module-card" key={name}><h2>{name}</h2><p>{status}</p></article>)}
      </section>
    </main>
  );
}
