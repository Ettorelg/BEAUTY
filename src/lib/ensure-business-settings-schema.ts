import pg from "pg";
let ready: Promise<void> | undefined;
export function ensureBusinessSettingsSchema(){
  if(ready)return ready;
  ready=(async()=>{const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();try{
    await client.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'BEAUTY'`);
    await client.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS enabled_modules text NOT NULL DEFAULT 'STAFF,PAYMENTS,FIDELITY,STATISTICS,INVENTORY'`);
  }finally{await client.end();}})(); return ready;
}
