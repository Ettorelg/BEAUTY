"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function InviteAuthForm({ email, name }: { email: string; name: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const password = String(new FormData(event.currentTarget).get("password"));
    try {
      const result = mode === "register"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(mode === "register" ? "Account già esistente o password non valida. Prova ad accedere." : "Password non corretta.");
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Servizio temporaneamente non disponibile.");
      setPending(false);
    }
  }

  return <>
    <form className="auth-form" onSubmit={submit}>
      <label>Email<input value={email} type="email" readOnly /></label>
      <label>Password<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} required /></label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="primary-button" disabled={pending}>{pending ? "Attendi…" : mode === "register" ? "Crea account e continua" : "Accedi e continua"}</button>
    </form>
    <button className="ghost-button auth-mode-button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(undefined); }} type="button">
      {mode === "register" ? "Hai già un account? Accedi" : "Non hai un account? Registrati"}
    </button>
  </>;
}
