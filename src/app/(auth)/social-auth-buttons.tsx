"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type SocialProvider = "google" | "apple";

type SocialAuthButtonsProps = {
  googleEnabled: boolean;
  appleEnabled: boolean;
  callbackURL: string;
};

const providerLabels: Record<SocialProvider, string> = {
  google: "Google",
  apple: "Apple",
};

export function SocialAuthButtons({ googleEnabled, appleEnabled, callbackURL }: SocialAuthButtonsProps) {
  const [pending, setPending] = useState<SocialProvider>();
  const [error, setError] = useState<string>();
  const providers: SocialProvider[] = [
    ...(googleEnabled ? ["google" as const] : []),
    ...(appleEnabled ? ["apple" as const] : []),
  ];

  if (!providers.length) return null;

  async function continueWith(provider: SocialProvider) {
    setPending(provider);
    setError(undefined);

    try {
      const result = await authClient.signIn.social({ provider, callbackURL });
      if (result.error) {
        setError(`Accesso con ${providerLabels[provider]} non riuscito. Riprova.`);
        setPending(undefined);
      }
    } catch {
      setError("Servizio di accesso temporaneamente non disponibile.");
      setPending(undefined);
    }
  }

  return (
    <div className="social-auth">
      <div className="social-buttons">
        {providers.map((provider) => (
          <button
            className={`social-button social-button-${provider}`}
            disabled={Boolean(pending)}
            key={provider}
            onClick={() => continueWith(provider)}
            type="button"
          >
            <span aria-hidden="true" className="social-mark">{provider === "google" ? "G" : "●"}</span>
            {pending === provider ? "Collegamento…" : `Continua con ${providerLabels[provider]}`}
          </button>
        ))}
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="auth-divider"><span>oppure</span></div>
    </div>
  );
}
