import { LoginForm } from "./login-form";
import { SocialAuthButtons } from "../social-auth-buttons";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Beauty SaaS</p>
        <h1>Bentornato.</h1>
        <p className="muted">Accedi per gestire salone, agenda e clienti.</p>
        <SocialAuthButtons
          appleEnabled={Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET)}
          callbackURL="/app"
          googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
        />
        <LoginForm />
      </section>
    </main>
  );
}
