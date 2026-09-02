import { sql } from "drizzle-orm";
import { db } from "@/db/client";

let ready: Promise<void> | undefined;

export function ensurePaymentSchema() {
  ready ??= (async () => {
    await db.execute(sql.raw("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'NOT_DUE'"));
    await db.execute(sql.raw("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid_at timestamptz"));
    await db.execute(sql.raw("CREATE INDEX IF NOT EXISTS appointments_customer_payment_idx ON appointments(business_id, customer_relation_id, payment_status)"));
  })();
  return ready;
}
