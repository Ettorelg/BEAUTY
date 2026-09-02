import { sql } from "drizzle-orm";
import { db } from "@/db/client";

let ready: Promise<void> | undefined;

export function ensureServicePricingSchema() {
  ready ??= (async () => {
    await db.execute(sql.raw("ALTER TABLE services ADD COLUMN IF NOT EXISTS repeat_price numeric(10,2)"));
    await db.execute(sql.raw("ALTER TABLE services ADD COLUMN IF NOT EXISTS repeat_price_enabled boolean NOT NULL DEFAULT false"));
    await db.execute(sql.raw("ALTER TABLE services ADD COLUMN IF NOT EXISTS repeat_duration_minutes integer"));
  })();
  return ready;
}
