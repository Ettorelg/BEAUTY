# Beauty SaaS

MVP web multi-tenant per saloni e professionisti beauty.

## Avvio locale

1. Copiare `.env.example` in `.env.local`.
2. Avviare PostgreSQL con `docker compose up -d`.
3. Installare le dipendenze con `pnpm install`.
4. Generare e applicare le migrazioni con `pnpm db:generate` e `pnpm db:migrate`.
5. Avviare l'app con `pnpm dev`.

Health check: `GET /api/health`.

La proposta tecnica approvata è in `docs/ARCHITETTURA_MVP.md`.

## Deploy Railway

Il repository è predisposto per Railway con build standalone, migrazioni pre-deploy e health check.

1. Creare un progetto Railway e aggiungere PostgreSQL.
2. Collegare `DATABASE_URL` del servizio web alla variabile del servizio PostgreSQL.
3. Pubblicare il repository o eseguire il deploy tramite Railway CLI.
4. Generare il dominio pubblico del servizio web.
