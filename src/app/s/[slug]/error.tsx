"use client";

export default function BookingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">Prenotazione non completata</p><h1>Qualcosa non ha funzionato.</h1><p className="muted">L’orario potrebbe essere stato appena occupato oppure i dati inseriti non sono più validi. Nessun punto viene scalato se la prenotazione non è confermata.</p><button className="primary-button" onClick={reset}>Controlla e riprova</button></section></main>;
}
