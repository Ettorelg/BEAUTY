import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import { businessMemberships, businesses, users } from "@/db/schema";
import { LogoutButton } from "@/app/app/logout-button";
import { requireSuperAdmin } from "@/lib/super-admin";

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
    <section className="panel"><p><strong>{businessRows.length}</strong> licenze totali</p></section>
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


