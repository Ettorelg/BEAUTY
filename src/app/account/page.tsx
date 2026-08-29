import { and, desc, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/app/logout-button";
import { db } from "@/db/client";
import { appointments, businesses, customerRelations } from "@/db/schema";
import { auth } from "@/lib/auth";

const statusLabels: Record<string, string> = {
  BOOKED: "Prenotato",
  CONFIRMED: "Confermato",
  ARRIVED: "Arrivato",
  COMPLETED: "Completato",
  CANCELLED: "Annullato",
  NO_SHOW: "Non presentato",
};

export default async function CustomerAccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/account/login");

  if (session.user.emailVerified) {
    await db
      .update(customerRelations)
      .set({ userId: session.user.id, updatedAt: new Date() })
      .where(and(isNull(customerRelations.userId), eq(customerRelations.email, session.user.email.toLowerCase())));
  }

  const bookings = await db
    .select({
      id: appointments.id,
      businessName: businesses.name,
      serviceName: appointments.serviceName,
      startsAt: appointments.startsAt,
      timezone: appointments.timezone,
      price: appointments.price,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(customerRelations, eq(customerRelations.id, appointments.customerRelationId))
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .where(eq(customerRelations.userId, session.user.id))
    .orderBy(desc(appointments.startsAt));

  return (
    <main className="customer-account-shell">
      <header className="customer-account-header">
        <div>
          <p className="eyebrow">Area clienti</p>
          <h1>Ciao, {session.user.name || "benvenuto"}.</h1>
          <p className="muted">Qui trovi le prenotazioni associate a {session.user.email}.</p>
        </div>
        <LogoutButton redirectTo="/account/login" />
      </header>
      <section className="list-section">
        <h2>Le mie prenotazioni</h2>
        {bookings.length ? (
          <div className="data-list">
            {bookings.map((booking) => (
              <article className="data-row" key={booking.id}>
                <div>
                  <p className="eyebrow">{statusLabels[booking.status] ?? booking.status}</p>
                  <h3>{booking.serviceName} · {booking.businessName}</h3>
                  <p className="muted">
                    {booking.startsAt.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short", timeZone: booking.timezone })}
                  </p>
                </div>
                <strong>€ {Number(booking.price).toFixed(2)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Non ci sono ancora prenotazioni associate a questo account.</div>
        )}
      </section>
    </main>
  );
}
