"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ redirectTo = "/app" }: { redirectTo?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    let result;
    try {
      result = await authClient.signIn.email({
        email: String(data.get("email")),
        password: String(data.get("password")),
      });
    } catch {
      setError("Servizio temporaneamente non disponibile. Riprova tra poco.");
      setPending(false);
      return;
    }

    if (result.error) {
      setError("Email o password non corretti.");
      setPending(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? "Accesso…" : "Accedi"}
      </button>
      <p className="form-footer">Non hai un account? <Link href={redirectTo === "/account" ? "/account/register" : "/register"}>Registrati</Link></p>
    </form>
  );
}
