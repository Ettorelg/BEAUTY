import Link from "next/link";

export const metadata = { title: "Privacy Policy · Alpha Beauty" };

export default function PrivacyPage() {
  return <main className="legal-shell"><article className="card legal-document">
    <p className="eyebrow">Alpha Beauty</p><h1>Privacy Policy</h1><p className="muted">Ultimo aggiornamento: 31 agosto 2026</p>
    <h2>Dati trattati</h2><p>Il servizio tratta dati identificativi e di contatto, informazioni sulle prenotazioni, preferenze, punti Fidelity e dati tecnici necessari alla sicurezza e al funzionamento della piattaforma.</p>
    <h2>Finalità</h2><p>I dati sono utilizzati per creare e gestire l’account, registrare e ricordare gli appuntamenti, gestire Fidelity e promozioni richieste, fornire assistenza e proteggere il servizio da utilizzi impropri.</p>
    <h2>Titolari del trattamento</h2><p>Per i dati relativi al rapporto con il salone, il titolare è il singolo esercente indicato nella pagina pubblica. Alpha System S.r.l. opera come fornitore tecnico della piattaforma nei limiti degli accordi applicabili.</p>
    <h2>Fornitori</h2><p>I dati possono essere trattati da fornitori infrastrutturali, database, autenticazione, archiviazione ed email esclusivamente per erogare il servizio. Non vendiamo dati personali.</p>
    <h2>Conservazione e diritti</h2><p>I dati sono conservati per il tempo necessario alle finalità indicate e agli obblighi di legge. Puoi richiedere accesso, rettifica, cancellazione, limitazione o portabilità contattando il salone oppure il supporto della piattaforma.</p>
    <h2>Comunicazioni promozionali</h2><p>Le comunicazioni promozionali richiedono una base giuridica o un consenso separato. I promemoria strettamente collegati a una prenotazione sono comunicazioni di servizio.</p>
    <p className="legal-note">Questa pagina costituisce una base informativa tecnica e deve essere completata con i dati societari, i contatti privacy e i tempi di conservazione definitivi prima del lancio commerciale.</p>
    <Link className="ghost-button link-button" href="/">Torna alla home</Link>
  </article></main>;
}
