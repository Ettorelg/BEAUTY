import Link from "next/link";

export const metadata = { title: "Termini di servizio · Alpha Beauty" };

export default function TermsPage() {
  return <main className="legal-shell"><article className="card legal-document">
    <p className="eyebrow">Alpha Beauty</p><h1>Termini di servizio</h1><p className="muted">Ultimo aggiornamento: 31 agosto 2026</p>
    <h2>Oggetto</h2><p>Alpha Beauty mette a disposizione strumenti per prenotazioni, agenda, gestione clienti, Fidelity e promozioni. Il salone resta responsabile dei servizi offerti, dei prezzi, della disponibilità e del rapporto con il cliente.</p>
    <h2>Account</h2><p>L’utente deve fornire dati corretti e custodire le credenziali. Gli account professionali possono accedere esclusivamente ai dati dell’attività a cui sono autorizzati.</p>
    <h2>Prenotazioni e cancellazioni</h2><p>La prenotazione è soggetta alla disponibilità mostrata e alle condizioni del singolo salone. Eventuali cancellazioni, ritardi, caparre o penali devono essere comunicati dal salone.</p>
    <h2>Fidelity e promozioni</h2><p>Punti, premi e promozioni sono definiti dal singolo salone, non sono convertibili in denaro e possono avere condizioni e scadenze mostrate nell’interfaccia.</p>
    <h2>Disponibilità del servizio</h2><p>La piattaforma viene mantenuta con ragionevole cura, ma possono verificarsi manutenzioni o interruzioni. Le attività devono conservare le informazioni necessarie alla continuità operativa.</p>
    <p className="legal-note">I termini dovranno essere completati con dati societari, foro competente, condizioni economiche e regole di recesso prima della commercializzazione.</p>
    <Link className="ghost-button link-button" href="/">Torna alla home</Link>
  </article></main>;
}
