import { sql } from "drizzle-orm";
import { db } from "@/db/client";
let schemaPromise: Promise<void> | undefined;
export function ensureRescheduleSchema() { schemaPromise ??= (async () => {
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS appointment_reschedule_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,proposed_staff_id uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,proposed_starts_at timestamptz NOT NULL,proposed_ends_at timestamptz NOT NULL,appointment_version integer NOT NULL,proposer_type text NOT NULL,proposed_by uuid REFERENCES users(id) ON DELETE SET NULL,customer_token_hash text,status text NOT NULL DEFAULT 'PENDING',expires_at timestamptz NOT NULL,responded_at timestamptz,created_at timestamptz NOT NULL DEFAULT now())`));
  await db.execute(sql.raw("CREATE INDEX IF NOT EXISTS reschedule_appointment_status_idx ON appointment_reschedule_requests(appointment_id,status)"));
  await db.execute(sql.raw("CREATE INDEX IF NOT EXISTS reschedule_staff_period_idx ON appointment_reschedule_requests(proposed_staff_id,proposed_starts_at,proposed_ends_at)"));
  await db.execute(sql.raw("CREATE INDEX IF NOT EXISTS reschedule_token_idx ON appointment_reschedule_requests(customer_token_hash)"));
})(); return schemaPromise; }
