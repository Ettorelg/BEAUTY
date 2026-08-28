# Beauty SaaS - Architettura proposta per l'MVP

Stato: proposta da approvare prima dell'implementazione.

Fonte dei requisiti: `docs/Progetto SaaS Beauty.docx`.

## 1. Obiettivo e confini

Realizzare un'applicazione web SaaS responsive per singoli saloni, composta da:

- sito pubblico del salone;
- prenotazione online;
- area personale cliente;
- gestionale OWNER/STAFF;
- programma Fidelity separato per salone.

Fuori dall'MVP: app native, AI, pagamenti/caparre, multi-sede lato prodotto, marketplace, contabilità, fatturazione elettronica, payroll, magazzino avanzato e marketing automation avanzata.

## 2. Decisione architetturale

### Monolite modulare

Un'unica applicazione distribuibile, organizzata in moduli di dominio indipendenti. È la soluzione più semplice per l'MVP e permette transazioni atomiche tra agenda, prenotazioni e Fidelity. I confini interni consentiranno di estrarre servizi separati in futuro solo se necessario.

Moduli:

- Identity & Access
- Businesses & Locations
- Catalog (categorie e servizi)
- Staff & Scheduling
- Availability
- Booking & Appointments
- Customers
- Loyalty
- Public Site
- Notifications
- Plans & Entitlements (solo predisposizione)
- Audit

Regola: la logica di dominio non vive nei componenti UI né nelle route HTTP. Disponibilità, prenotazione, cancellazione e accredito punti hanno servizi applicativi unici e testabili.

## 3. Stack consigliato

- Linguaggio: TypeScript in modalità strict.
- Web full-stack: Next.js con App Router.
- UI: React, Tailwind CSS e componenti accessibili costruiti su primitive headless.
- Database: PostgreSQL.
- Accesso dati: Drizzle ORM, con migrazioni SQL revisionabili e SQL nativo per vincoli avanzati.
- Autenticazione: libreria compatibile OAuth/OIDC con Google, Apple ed email/password; sessioni persistite server-side e cookie sicuri.
- Validazione: Zod ai confini dell'applicazione.
- Form: React Hook Form dove serve stato client complesso; Server Actions/route handlers per casi semplici.
- Test: Vitest per unit/integration, Playwright per flussi end-to-end.
- Email: provider transazionale dietro un adapter; in sviluppo mailbox locale/fake.
- File/immagini: object storage S3-compatible dietro un adapter.
- Osservabilità: log JSON strutturati, error tracking e audit trail delle operazioni sensibili.
- Package manager: pnpm.
- CI: lint, typecheck, test, build e verifica migrazioni.

Non fissare versioni nel documento: verranno bloccate nel lockfile al momento del bootstrap.

## 4. Struttura del repository

```text
/
|-- src/
|   |-- app/
|   |   |-- (public)/
|   |   |-- (auth)/
|   |   |-- (customer)/
|   |   `-- (backoffice)/
|   |-- modules/
|   |   |-- identity/
|   |   |-- businesses/
|   |   |-- catalog/
|   |   |-- staff/
|   |   |-- availability/
|   |   |-- appointments/
|   |   |-- customers/
|   |   |-- loyalty/
|   |   |-- notifications/
|   |   `-- entitlements/
|   |-- db/
|   |   |-- schema/
|   |   |-- migrations/
|   |   `-- seeds/
|   |-- shared/
|   |   |-- auth/
|   |   |-- ui/
|   |   |-- validation/
|   |   |-- observability/
|   |   `-- utilities/
|   `-- test/
|-- public/
|-- docs/
|-- e2e/
`-- scripts/
```

Ogni modulo contiene, quando necessario: `domain`, `application`, `infrastructure` e `ui`. Non introdurre astrazioni vuote: i livelli si aggiungono quando proteggono una regola di business reale.

## 5. Multi-tenancy e autorizzazione

### Modello

- `User` è l'identità globale.
- `Business` è il tenant.
- `Location` esiste già nel modello, ma l'MVP impone una sola location per business.
- `BusinessMembership` collega un utente a un business con ruolo `OWNER` o `STAFF`.
- `CustomerProfile` contiene i dati globali minimi del cliente.
- `CustomerBusinessRelation` contiene i dati commerciali specifici del rapporto cliente-salone.

### Isolamento

- Ogni tabella tenant-specifica contiene `business_id` non nullo.
- Chiavi esterne e indici includono `business_id` quando necessario per impedire collegamenti tra tenant.
- Il tenant non viene accettato ciecamente dal body della richiesta: viene risolto da dominio/sottodominio e sessione, poi verificato dal server.
- Tutte le query tenant-specifiche passano da un contesto autorizzato.
- Test automatici provano esplicitamente accessi cross-tenant.
- PostgreSQL Row-Level Security può essere aggiunta come secondo livello; per la prima iterazione va valutata con un proof of concept, non usata come sostituto dei controlli applicativi.

## 6. Schema dati iniziale

Entità principali:

- `users`, `accounts`, `sessions`
- `businesses`, `locations`, `business_memberships`
- `customer_profiles`, `customer_business_relations`
- `service_categories`, `services`, `staff_services`
- `working_hours`, `staff_shifts`, `breaks`, `absences`, `calendar_blocks`
- `appointments`, `appointment_events`
- `loyalty_programs`, `loyalty_cards`, `loyalty_transactions`, `rewards`, `reward_redemptions`
- `notification_jobs`
- `audit_events`
- `plans`, `features`, `plan_features`, `business_subscriptions` (struttura minima, nessun pricing o enforcement avanzato)

### Appuntamento

Campi essenziali:

- `id`, `business_id`, `location_id`, `customer_relation_id`, `staff_id`;
- `service_id` e snapshot di nome, durata e prezzo;
- `starts_at`, `ends_at`, `timezone`;
- stato, note, canale di creazione e autore;
- timestamps e versione per concorrenza ottimistica.

Date e ore sono memorizzate come istanti UTC. Il salone mantiene una timezone IANA; la UI converte sempre nella timezone del salone.

### Fidelity

Il saldo nasce da un ledger append-only:

- accredito per appuntamento completato;
- bonus/rettifica manuale con autore e motivazione;
- utilizzo premio;
- eventuale storno collegato alla transazione originale.

Una cache del saldo è ammessa solo se aggiornata nella stessa transazione del ledger. Ogni completamento appuntamento deve essere idempotente per non accreditare due volte.

## 7. Booking engine

### Calcolo disponibilità

Input: business, location, servizio, operatore opzionale, intervallo date.

1. Caricare durata e operatori abilitati.
2. Costruire gli intervalli lavorativi da orari ricorrenti e turni specifici.
3. Sottrarre pause, assenze e blocchi manuali.
4. Sottrarre gli appuntamenti che occupano agenda.
5. Generare slot secondo una granularità configurabile, mantenendo la durata reale del servizio.
6. Selezionare solo intervalli interamente contenuti nella disponibilità residua.
7. Per "Primo disponibile", unire i risultati degli operatori e scegliere il primo slot con criterio deterministico.

La stessa funzione viene usata da sito pubblico, area cliente e gestionale.

### Prevenzione doppie prenotazioni

- La disponibilità mostrata è indicativa fino alla conferma.
- La creazione dell'appuntamento avviene in una transazione database.
- PostgreSQL applica un vincolo di esclusione sugli intervalli temporali dello stesso operatore per gli stati che occupano agenda.
- Un token di idempotenza evita duplicazioni da doppio click o retry di rete.
- In caso di conflitto, la transazione fallisce e la UI propone gli slot aggiornati.

## 8. Autenticazione e prenotazione ospite

- Google, Apple ed email/password convergono su un singolo `User`.
- Gli account vengono collegati solo con regole verificabili, evitando merge automatici rischiosi basati su email non verificata.
- La prenotazione ospite crea/riutilizza una relazione cliente-salone tramite identificatori verificati e policy anti-duplicato.
- Dopo la prenotazione, un invito consente di rivendicare il profilo e collegarlo all'identità globale.
- OWNER e STAFF richiedono membership attiva; CUSTOMER non eredita accesso gestionale.

## 9. Stati e regole appuntamento

Stati iniziali: `BOOKED`, `CONFIRMED`, `ARRIVED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.

Le transizioni ammesse sono centralizzate. Cancellazione e modifica rispettano la policy del salone e registrano autore, timestamp e motivo. Gli stati cancellati/non occupanti liberano lo slot secondo una regola unica e testata.

## 10. Edge case prioritari

- due clienti confermano lo stesso slot nello stesso istante;
- cambio ora legale e timezone del salone;
- servizio o staff disattivato con appuntamenti futuri;
- modifica di prezzo/durata senza alterare lo storico;
- assenza inserita sopra appuntamenti esistenti;
- appuntamento spostato tra operatori con competenze diverse;
- cancellazione al limite esatto della policy;
- retry di rete e doppio submit;
- prenotazione ospite già associata a un account;
- account Google/Apple con email relay o email modificata;
- accredito Fidelity duplicato o storno di un appuntamento completato;
- saldo Fidelity concorrente;
- accesso cross-tenant tramite ID indovinato;
- cancellazione di business/staff con record storici;
- foto o testo pubblico non validi;
- dominio/sottodominio non disponibile;
- notifiche duplicate o fallite.

## 11. Piano incrementale

### Fase 0 - Fondazioni verificabili

Bootstrap, convenzioni, CI, ambiente locale, migrazioni, logging e strategia test.

### Fase 1 - Identity e tenant

Autenticazione, onboarding business, location unica, membership OWNER, isolamento tenant e test cross-tenant.

### Fase 2 - Catalogo e staff

Categorie, servizi, operatori, abilitazioni, orari, turni, pause e assenze.

### Fase 3 - Availability e booking core

Motore disponibilità puro, vincoli database, creazione idempotente, modifica/cancellazione e test di concorrenza.

### Fase 4 - Sito pubblico

Home essenziale, catalogo, CTA e booking guest/account con design responsive.

### Fase 5 - Agenda gestionale

Vista giorno/settimana, operatori, CRUD appuntamenti, blocchi e aggiornamenti di stato.

### Fase 6 - Clienti

Ricerca, scheda, storico, note e relazione cliente-salone.

### Fase 7 - Fidelity

Programma, ledger, premi, accredito idempotente e rettifiche auditate.

### Fase 8 - Area cliente

Prossimi appuntamenti, storico, Fidelity, profilo e modifiche consentite.

### Fase 9 - Dashboard e impostazioni

Riepilogo operativo, branding, sito, regole booking, account e predisposizione notifiche.

### Fase 10 - Hardening

Test end-to-end, sicurezza, accessibilità, performance, responsive QA, backup/restore e checklist di rilascio.

Ogni fase termina con una demo verticale funzionante e criteri di accettazione; nessuna fase successiva deve compensare fondamenta non verificate.

## 12. Decisioni da approvare

1. Confermare il monolite modulare Next.js + PostgreSQL.
2. Confermare Drizzle ORM con possibilità di SQL nativo per i vincoli di agenda.
3. Confermare una sola applicazione web con route pubbliche, cliente e backoffice, anziché tre deploy separati.
4. Confermare che la prenotazione ospite sia inclusa nell'MVP.
5. Confermare che email sia l'unico canale di notifica operativo iniziale; SMS/WhatsApp restano fuori.
6. Scegliere il provider di hosting e servizi gestiti prima del bootstrap, oppure mantenere adapter neutrali e decidere dopo la Fase 1.

## 13. Primo incremento proposto dopo l'approvazione

Creare solo la Fase 0 e lo scheletro della Fase 1: progetto avviabile, database locale, migrazione iniziale, health check, test setup e modello minimo `User/Business/Location/Membership`. Nessun booking o UI estesa finché isolamento tenant e autenticazione non sono verificati.
