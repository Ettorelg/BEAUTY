import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="card">
        <p className="eyebrow">Beauty SaaS</p>
        <h1>Il tuo salone, più semplice.</h1>
        <p>
          Prenotazioni, agenda, clienti e Fidelity in un unico spazio pensato per il settore beauty.
        </p>
        <div className="button-row"><Link className="primary-button link-button" href="/register">Inizia ora</Link><Link className="ghost-button link-button" href="/login">Accedi</Link></div>
      </section>
    </main>
  );
}
