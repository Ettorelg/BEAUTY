import { sql } from "drizzle-orm";
import { db } from "@/db/client";

let ready: Promise<void> | undefined;

export function ensurePaymentSchema() {
  ready ??= (async () => {
    await db.execute(sql.raw("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'NOT_DUE'"));
    await db.execute(sql.raw("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid_at timestamptz"));
    await db.execute(sql.raw("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0"));
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS appointment_payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE, amount numeric(10,2) NOT NULL,
      method text NOT NULL DEFAULT 'CASH', note text, actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
      paid_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
    )`));
    await db.execute(sql.raw("CREATE INDEX IF NOT EXISTS appointment_payments_appointment_idx ON appointment_payments(appointment_id)"));
    await db.execute(sql.raw("CREATE INDEX IF NOT EXISTS appointments_customer_payment_idx ON appointments(business_id, customer_relation_id, payment_status)"));
  })();
  return ready;
}
