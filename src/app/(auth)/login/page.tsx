import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Beauty SaaS</p>
        <h1>Bentornato.</h1>
        <p className="muted">Accedi per gestire salone, agenda e clienti.</p>
        <LoginForm />
      </section>
    </main>
  );
}
