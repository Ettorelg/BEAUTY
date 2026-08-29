import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import { businessMemberships, businesses, users } from "@/db/schema";
import { LogoutButton } from "@/app/app/logout-button";
import { requireSuperAdmin } from "@/lib/super-admin";
import { grantLicense } from "./actions";

export default async function AdminLicensesPage() {
  const administrator = await requireSuperAdmin();
  const [businessRows, membershipRows, ownerRows] = await Promise.all([
    db.select().from(businesses).orderBy(asc(businesses.name)),
    db.select({ businessId: businessMemberships.businessId }).from(businessMemberships),
    db.select({ businessId: businessMemberships.businessId, email: users.email })
      .from(businessMemberships)
      .innerJoin(users, eq(users.id, businessMemberships.userId))
      .where(eq(businessMemberships.role, "OWNER")),
  ]);

  return <main className="dashboard-shell">
    <header className="app-header">
      <div><p className="eyebrow">Super amministratore</p><strong>{administrator.email}</strong></div>
      <LogoutButton />
    </header>
    <nav className="app-nav"><Link href="/admin/licenses">Tutte le licenze</Link></nav>
    <section className="page-heading"><div><p className="eyebrow">Amministrazione globale</p><h1>Licenze</h1></div><p className="muted">Tutti i saloni registrati sulla piattaforma.</p></section>
    <section className="management-grid"><article className="panel"><h2>Abilita nuovo titolare</h2><p className="muted">L’utente deve essersi già registrato come cliente.</p><form action={grantLicense} className="compact-form stacked"><input name="email" type="email" placeholder="Email titolare" required/><input name="businessName" placeholder="Nome salone" required/><input name="locationName" placeholder="Sede principale" defaultValue="Sede principale" required/><select name="timezone" defaultValue="Europe/Rome"><option value="Europe/Rome">Europe/Rome</option><option value="Europe/Paris">Europe/Paris</option><option value="Europe/London">Europe/London</option></select><button className="primary-button">Abilita licenza</button></form></article><article className="panel"><p><strong>{businessRows.length}</strong> licenze totali</p><p className="muted">Gli account senza licenza restano clienti.</p></article></section>
    <section className="list-section"><div className="data-list">
      {businessRows.map((business) => {
        const owners = ownerRows.filter((row) => row.businessId === business.id).map((row) => row.email);
        const members = membershipRows.filter((row) => row.businessId === business.id).length;
        return <article className="data-row" key={business.id}><div><p className="eyebrow">Licenza attiva</p><h3>{business.name}</h3><p><strong>Slug:</strong> {business.slug}</p><p><strong>Titolare:</strong> {owners.join(", ") || "Non assegnato"}</p><p className="muted">Utenti collegati: {members} · Creata il {business.createdAt.toLocaleDateString("it-IT")}</p></div><div><span className="status-pill">Attiva</span><p><Link className="ghost-button link-button" href={`/admin/licenses/${business.id}`}>Controlla</Link></p></div></article>;
      })}
      {!businessRows.length ? <div className="empty-state">Nessuna licenza registrata.</div> : null}
    </div></section>
  </main>;
}






