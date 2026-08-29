import { RegisterForm } from "./register-form";
import { SocialAuthButtons } from "../social-auth-buttons";

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Inizia ora</p>
        <h1>Crea il tuo spazio.</h1>
        <p className="muted">Configura il salone in pochi passaggi.</p>
        <SocialAuthButtons
          appleEnabled={Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET)}
          callbackURL="/onboarding"
          googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
        />
        <RegisterForm />
      </section>
    </main>
  );
}
