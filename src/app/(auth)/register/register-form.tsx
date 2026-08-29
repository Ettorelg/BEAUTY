"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function RegisterForm({ redirectTo = "/onboarding" }: { redirectTo?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("passwordConfirm"))) {
      setError("Le password non coincidono.");
      setPending(false);
      return;
    }

    let result;
    try {
      result = await authClient.signUp.email({
        name: String(data.get("name")),
        email: String(data.get("email")),
        password,
      });
    } catch {
      setError("Servizio temporaneamente non disponibile. Riprova tra poco.");
      setPending(false);
      return;
    }

    if (result.error) {
      setError(result.error.message ?? "Impossibile creare l’account.");
      setPending(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>Nome e cognome<input name="name" autoComplete="name" required /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>Ripeti password<input name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required /></label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? "Creazione…" : "Crea account"}
      </button>
      <p className="form-footer">Hai già un account? <Link href={redirectTo === "/account" ? "/account/login" : "/login"}>Accedi</Link></p>
    </form>
  );
}
