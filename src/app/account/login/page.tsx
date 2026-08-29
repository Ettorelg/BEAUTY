import Link from "next/link";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { SocialAuthButtons } from "@/app/(auth)/social-auth-buttons";

export default function CustomerLoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Area clienti</p>
        <h1>Le tue prenotazioni.</h1>
        <p className="muted">Accedi con email o Google per ritrovare i tuoi appuntamenti.</p>
        <SocialAuthButtons
          appleEnabled={false}
          callbackURL="/account"
          googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
        />
        <LoginForm redirectTo="/account" />
        <p className="auth-secondary-link">Sei un professionista? <Link href="/login">Accedi al gestionale</Link></p>
      </section>
    </main>
  );
}


