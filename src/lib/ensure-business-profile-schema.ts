import pg from "pg";

let ready: Promise<void> | undefined;
const profileColumns = [
  "address text", "city text", "postal_code text", "phone text", "email text",
  "description text", "website text", "instagram text", "logo_key text",
  "cover_key text", "gallery_keys text",
];

export function ensureBusinessProfileSchema() {
  if (ready) return ready;
  ready = (async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      for (const table of ["businesses", "locations"]) {
        for (const column of profileColumns) {
          await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${column}`);
        }
      }
    } finally {
      await client.end();
    }
  })();
  return ready;
}
