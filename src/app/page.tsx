import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="card">
        <div style={{ marginBottom: 24 }}>
          <Image
            src="/brand/alpha-prenota-logo-v1.png"
            alt="Logo Alpha Prenota"
            width={420}
            height={140}
            priority
            style={{ width: "min(100%, 420px)", height: "auto" }}
          />
        </div>
        <h1>I tuoi appuntamenti, più semplici.</h1>
        <p>Prenotazioni, agenda, clienti e Fidelity in un unico spazio per ogni attività.</p>
        <div className="button-row">
          <Link className="primary-button link-button" href="/account/login">Accesso clienti</Link>
          <Link className="ghost-button link-button" href="/login">Accesso professionisti</Link>
        </div>
        <nav className="button-row" aria-label="Informazioni legali" style={{ marginTop: 24 }}>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Termini e condizioni</Link>
        </nav>
      </section>
    </main>
  );
}
