import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Inizia ora</p>
        <h1>Crea il tuo spazio.</h1>
        <p className="muted">Configura il salone in pochi passaggi.</p>
        <RegisterForm />
      </section>
    </main>
  );
}
