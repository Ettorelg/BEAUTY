import { sql } from "drizzle-orm";
import { db } from "@/db/client";

let ready: Promise<void> | undefined;

export function ensureServicePricingSchema() {
  ready ??= db.execute(sql.raw("ALTER TABLE services ADD COLUMN IF NOT EXISTS repeat_price numeric(10,2)")).then(() => undefined);
  return ready;
}
