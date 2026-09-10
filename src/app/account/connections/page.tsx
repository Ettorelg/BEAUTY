import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GoogleAccountConnection } from "./google-account-connection";

const allowedDestinations = new Set(["/account", "/app", "/admin/licenses", "/onboarding"]);

export default async function AccountConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const requestedDestination = (await searchParams).next ?? "/account";
  const nextPath = allowedDestinations.has(requestedDestination) ? requestedDestination : "/account";

  return <main className="auth-shell account-connections-shell">
    <section className="auth-card">
      <Image className="auth-brand-logo" src="/brand/alpha-prenota-logo-v1.png" alt="Logo Alpha Prenota" width={420} height={140} priority />
      <p className="eyebrow">Sicurezza account</p>
      <h1>Collega Google.</h1>
      <p className="muted">Dopo il collegamento potrai accedere più velocemente senza inserire ogni volta la password.</p>
      <GoogleAccountConnection email={session.user.email} googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} nextPath={nextPath} />
    </section>
  </main>;
}
