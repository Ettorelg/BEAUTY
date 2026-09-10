import Image from "next/image";
import Link from "next/link";

const features = [
  { number: "01", title: "Prenotazioni sempre aperte", text: "I clienti scelgono servizio, professionista e orario disponibile in completa autonomia." },
  { number: "02", title: "Agenda e staff coordinati", text: "Appuntamenti, turni, assenze e disponibilità restano ordinati in un’unica agenda." },
  { number: "03", title: "Clienti e Fidelity", text: "Schede cliente, storico visite e punti Fidelity aiutano a costruire relazioni durature." },
  { number: "04", title: "Statistiche utili", text: "Controlla l’andamento dell’attività e individua servizi, giornate e orari più richiesti." },
];

export default function HomePage() {
  return (
    <main className="landing-main">
      <section className="landing-hero">
        <header className="landing-nav">
          <Link className="landing-brand" href="/" aria-label="Alpha Prenota · Pagina iniziale">
            <Image src="/brand/alpha-prenota-logo-v1.png" alt="Alpha Prenota" width={420} height={140} priority />
          </Link>
          <nav aria-label="Navigazione principale">
            <a href="#funzionalita">Funzionalità</a>
            <a href="#come-funziona">Come funziona</a>
            <Link className="landing-nav-login" href="/login">Accedi</Link>
          </nav>
        </header>

        <div className="landing-hero-grid">
          <div className="landing-copy">
            <p className="landing-kicker">Prenotazioni semplici. Gestione completa.</p>
            <h1>La tua agenda online, <span>sempre sotto controllo.</span></h1>
            <p className="landing-lead">Alpha Prenota riunisce prenotazioni, agenda, clienti e fidelizzazione in un unico spazio, per professionisti di ogni settore.</p>
            <div className="landing-actions">
              <Link className="landing-button landing-button-primary" href="/account/login">Prenota come cliente</Link>
              <Link className="landing-button landing-button-secondary" href="/login">Accesso professionisti</Link>
            </div>
            <div className="landing-metrics" aria-label="Vantaggi principali">
              <div><strong>24/7</strong><span>prenotazioni online</span></div>
              <div><strong>1 agenda</strong><span>per attività e staff</span></div>
              <div><strong>Fidelity</strong><span>clienti più vicini</span></div>
            </div>
          </div>

          <div className="agenda-preview" aria-label="Anteprima agenda Alpha Prenota">
            <div className="agenda-preview-top">
              <div><span className="agenda-overline">ANTEPRIMA GESTIONALE</span><h2>Agenda di oggi</h2></div>
              <span className="agenda-status">Online</span>
            </div>
            <div className="agenda-date-row">
              <div><strong>OGGI</strong><span>AGENDA</span></div>
              <p><strong>Prossimi appuntamenti</strong><span>4 appuntamenti confermati</span></p>
            </div>
            <div className="agenda-list">
              <article><time>09:00</time><span className="agenda-dot agenda-dot-red" /><div><strong>Consulenza</strong><small>Cliente confermato</small></div><b>45 min</b></article>
              <article><time>10:30</time><span className="agenda-dot agenda-dot-blue" /><div><strong>Trattamento</strong><small>Con Marco</small></div><b>60 min</b></article>
              <article><time>12:00</time><span className="agenda-dot agenda-dot-green" /><div><strong>Nuovo appuntamento</strong><small>Disponibile online</small></div><b>30 min</b></article>
            </div>
            <Link className="landing-button landing-button-primary agenda-button" href="/login">Apri l’area professionisti</Link>
          </div>
        </div>
      </section>

      <section className="landing-section" id="funzionalita">
        <div className="landing-section-heading">
          <p className="landing-kicker">TUTTO IN UN UNICO POSTO</p>
          <h2>Più tempo per il tuo lavoro, meno per l’agenda.</h2>
          <p>Gli strumenti essenziali per organizzare l’attività e offrire ai clienti un’esperienza semplice.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map((feature) => <article key={feature.number}><span>{feature.number}</span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}
        </div>
      </section>

      <section className="landing-section landing-how" id="come-funziona">
        <div className="landing-how-copy">
          <p className="landing-kicker">DUE ACCESSI, UN SOLO SISTEMA</p>
          <h2>Semplice per chi prenota. Completo per chi lavora.</h2>
          <p>Il cliente trova l’orario giusto in pochi passaggi. Il professionista gestisce disponibilità, appuntamenti, staff e clienti dalla propria area riservata.</p>
        </div>
        <div className="landing-access-grid">
          <article><span>PER I CLIENTI</span><h3>Prenota il tuo appuntamento</h3><p>Cerca l’attività, scegli il servizio e controlla le tue prenotazioni.</p><Link href="/account/login">Entra come cliente <b aria-hidden="true">→</b></Link></article>
          <article className="landing-access-pro"><span>PER I PROFESSIONISTI</span><h3>Gestisci la tua attività</h3><p>Organizza agenda, collaboratori, servizi, clienti e fidelizzazione.</p><Link href="/login">Entra come professionista <b aria-hidden="true">→</b></Link></article>
        </div>
      </section>
    </main>
  );
}
