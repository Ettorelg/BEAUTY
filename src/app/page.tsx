import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
          <Image src="/brand/alpha-beauty-logo.png" alt="Logo Alpha Beauty" width={88} height={88} priority />
          <div>
            <p className="eyebrow">Alpha Beauty</p>
            <h1>Il tuo salone, più semplice.</h1>
          </div>
        </div>
        <p>Prenotazioni, agenda, clienti e Fidelity in un unico spazio pensato per il settore beauty.</p>
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
