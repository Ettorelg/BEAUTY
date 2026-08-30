import pg from "pg";
let ready:Promise<void>|undefined;
export function ensureBusinessProfileSchema(){if(ready)return ready;ready=(async()=>{const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();try{for(const column of ['address text','city text','postal_code text','phone text','email text','description text','website text','instagram text'])await c.query(`ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS ${column}`)}finally{await c.end()}})();return ready}
