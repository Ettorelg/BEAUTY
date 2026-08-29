import Link from "next/link";
import { RegisterForm } from "@/app/(auth)/register/register-form";
import { SocialAuthButtons } from "@/app/(auth)/social-auth-buttons";

export default function CustomerRegisterPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Area clienti</p>
        <h1>Crea il tuo account.</h1>
        <p className="muted">Registrati per consultare le tue prenotazioni in ogni momento.</p>
        <SocialAuthButtons
          appleEnabled={false}
          callbackURL="/account"
          googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
        />
        <RegisterForm redirectTo="/account" />
        <p className="auth-secondary-link">Sei un professionista? <Link href="/register">Registra il salone</Link></p>
      </section>
    </main>
  );
}


