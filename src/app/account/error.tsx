"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AccountError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Customer account error", error);
  }, [error]);

  return (
    <main>
      <section className="card">
        <p className="eyebrow">Area clienti</p>
        <h1>Non siamo riusciti a caricare i tuoi dati</h1>
        <p>Riprova tra qualche istante. Le tue prenotazioni non sono state modificate.</p>
        <div className="button-row">
          <button className="primary-button" type="button" onClick={reset}>Riprova</button>
          <Link className="ghost-button link-button" href="/account">Torna all’area clienti</Link>
        </div>
      </section>
    </main>
  );
}
