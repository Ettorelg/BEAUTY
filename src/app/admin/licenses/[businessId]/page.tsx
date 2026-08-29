import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LogoutButton } from "@/app/app/logout-button";
import { db } from "@/db/client";
import { businessMemberships, businesses, services, staffMembers, users } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/super-admin";

export default async function LicenseDetailPage({ params }: { params: Promise<{ businessId: string }> }) {
  await requireSuperAdmin();
  const { businessId } = await params;
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!business) notFound();

  const [members, operators, serviceRows] = await Promise.all([
    db.select({ id: businessMemberships.id, role: businessMemberships.role, email: users.email, name: users.name, createdAt: businessMemberships.createdAt })
      .from(businessMemberships).innerJoin(users, eq(users.id, businessMemberships.userId))
      .where(eq(businessMemberships.businessId, businessId)).orderBy(asc(users.email)).catch(() => []),
    db.select({ id: staffMembers.id, name: staffMembers.name, title: staffMembers.title, active: staffMembers.active, email: users.email })
      .from(staffMembers).leftJoin(users, eq(users.id, staffMembers.userId))
      .where(eq(staffMembers.businessId, businessId)).orderBy(asc(staffMembers.name)).catch(() => []),
    db.select({ id: services.id, name: services.name, active: services.active, onlineBookable: services.onlineBookable })
      .from(services).where(eq(services.businessId, businessId)).orderBy(asc(services.name)).catch(() => []),
  ]);

  return <main className="dashboard-shell">
    <header className="app-header"><div><p className="eyebrow">Controllo licenza</p><strong>{business.name}</strong></div><LogoutButton /></header>
    <nav className="app-nav"><Link href="/admin/licenses">← Tutte le licenze</Link></nav>
    <section className="page-heading"><div><p className="eyebrow">Licenza attiva</p><h1>{business.name}</h1></div><span className="status-pill">Attiva</span></section>
    <section className="management-grid">
      <article className="panel"><h2>Dati licenza</h2><p><strong>ID:</strong> {business.id}</p><p><strong>Slug:</strong> {business.slug}</p><p><strong>Fuso orario:</strong> {business.timezone}</p><p><strong>Creata:</strong> {business.createdAt.toLocaleString("it-IT")}</p></article>
      <article className="panel"><h2>Riepilogo</h2><p><strong>{members.length}</strong> account collegati</p><p><strong>{operators.length}</strong> operatori</p><p><strong>{serviceRows.length}</strong> servizi</p><p><strong>{serviceRows.filter((service) => service.onlineBookable && service.active).length}</strong> prenotabili online</p></article>
    </section>
    <section className="list-section"><h2>Titolari e account staff</h2><div className="data-list">{members.map((member) => <article className="data-row" key={member.id}><div><p className="eyebrow">{member.role}</p><h3>{member.name || "Senza nome"}</h3><p>{member.email}</p><p className="muted">Collegato il {member.createdAt.toLocaleDateString("it-IT")}</p></div></article>)}</div></section>
    <section className="list-section"><h2>Operatori</h2><div className="data-list">{operators.map((operator) => <article className="data-row" key={operator.id}><div><h3>{operator.name}</h3><p>{operator.title || "Operatore"}</p><p className="muted">{operator.email || "Account non ancora collegato"}</p></div><span className="status-pill">{operator.active ? "Attivo" : "Disattivo"}</span></article>)}{!operators.length ? <div className="empty-state">Nessun operatore.</div> : null}</div></section>
    <section className="list-section"><h2>Servizi</h2><div className="data-list">{serviceRows.map((service) => <article className="data-row" key={service.id}><div><h3>{service.name}</h3><p className="muted">{service.onlineBookable ? "Prenotabile online" : "Solo gestionale"}</p></div><span className="status-pill">{service.active ? "Attivo" : "Disattivo"}</span></article>)}{!serviceRows.length ? <div className="empty-state">Nessun servizio.</div> : null}</div></section>
  </main>;
}


