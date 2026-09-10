"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type LinkedAccount = { id: string; providerId: string };

export function GoogleAccountConnection({
  email,
  googleEnabled,
  nextPath,
}: {
  email: string;
  googleEnabled: boolean;
  nextPath: string;
}) {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const googleLinked = accounts.some((account) => account.providerId === "google");

  useEffect(() => {
    let active = true;
    authClient.listAccounts().then((result) => {
      if (!active) return;
      if (result.error) setError("Non è stato possibile controllare gli account collegati.");
      else setAccounts((result.data ?? []) as LinkedAccount[]);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function connectGoogle() {
    setPending(true);
    setError(undefined);
    try {
      const callbackURL = `/account/connections?linked=google&next=${encodeURIComponent(nextPath)}`;
      const result = await authClient.linkSocial({ provider: "google", callbackURL });
      if (result.error) {
        setError(result.error.message ?? "Collegamento con Google non riuscito.");
        setPending(false);
      }
    } catch {
      setError("Servizio Google temporaneamente non disponibile.");
      setPending(false);
    }
  }

  return <div className="account-connection-panel">
    <div className={`account-connection-status ${googleLinked ? "is-linked" : ""}`}>
      <span className="social-mark">G</span>
      <div>
        <strong>Account Google</strong>
        <p>{loading ? "Controllo collegamento…" : googleLinked ? "Collegato correttamente" : "Non ancora collegato"}</p>
      </div>
      {!loading && googleLinked ? <span className="status-pill">Collegato</span> : null}
    </div>

    {!loading && !googleLinked ? <>
      <p className="muted">Quando Google chiede quale account utilizzare, scegli <strong>{email}</strong>.</p>
      {googleEnabled
        ? <button className="social-button social-button-google" disabled={pending} onClick={connectGoogle} type="button">
            <span aria-hidden="true" className="social-mark">G</span>
            {pending ? "Collegamento…" : "Collega il mio account Google"}
          </button>
        : <p className="form-error">Il collegamento Google non è disponibile in questo momento.</p>}
    </> : null}

    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <Link className="ghost-button link-button account-connection-continue" href={nextPath}>
      {googleLinked ? "Continua" : "Continua senza collegare Google"}
    </Link>
  </div>;
}
