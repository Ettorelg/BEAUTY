import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL non configurato");

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query(`
    ALTER TABLE "staff_members" ADD COLUMN IF NOT EXISTS "user_id" uuid;
    DO $
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_members_user_id_users_id_fk') THEN
        ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_users_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
      END IF;
    END $;
    CREATE UNIQUE INDEX IF NOT EXISTS "staff_members_business_user_unique" ON "staff_members" ("business_id", "user_id");

    CREATE TABLE IF NOT EXISTS "staff_invitations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "business_id" uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
      "staff_id" uuid NOT NULL REFERENCES "staff_members"("id") ON DELETE CASCADE,
      "email" text NOT NULL,
      "token_hash" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "sent_at" timestamp with time zone,
      "accepted_at" timestamp with time zone,
      "last_error" text,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "staff_invitations_staff_unique" ON "staff_invitations" ("staff_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "staff_invitations_business_email_unique" ON "staff_invitations" ("business_id", "email");
    CREATE UNIQUE INDEX IF NOT EXISTS "staff_invitations_token_unique" ON "staff_invitations" ("token_hash");
    CREATE INDEX IF NOT EXISTS "staff_invitations_business_idx" ON "staff_invitations" ("business_id");
  `);
  console.log("Production schema ready");
} finally {
  await client.end();
}


