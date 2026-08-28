import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { businessMemberships } from "@/db/schema";
import { auth } from "@/lib/auth";
import { onboardBusiness } from "./actions";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const membership = await db.query.businessMemberships.findFirst({
    where: eq(businessMemberships.userId, session.user.id),
  });
  if (membership) redirect("/app");

  return (
    <main className="auth-shell">
      <section className="auth-card wide-card">
        <p className="eyebrow">Configurazione iniziale</p>
        <h1>Parlaci del tuo salone.</h1>
        <p className="muted">Potrai modificare queste informazioni dalle impostazioni.</p>
        <form className="auth-form" action={onboardBusiness}>
          <label>Nome del salone<input name="businessName" placeholder="Es. Beauty Lab" required /></label>
          <label>Nome della sede<input name="locationName" defaultValue="Sede principale" required /></label>
          <label>Fuso orario
            <select name="timezone" defaultValue="Europe/Rome">
              <option value="Europe/Rome">Europe/Rome</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Europe/London">Europe/London</option>
            </select>
          </label>
          <button className="primary-button" type="submit">Crea il salone</button>
        </form>
      </section>
    </main>
  );
}
