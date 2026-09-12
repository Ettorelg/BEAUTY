import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { ensurePushSchema } from "@/lib/push-notifications";

const schema=z.object({endpoint:z.string().url(),keys:z.object({p256dh:z.string().min(1),auth:z.string().min(1)})});
export async function GET(request:Request){const session=await auth.api.getSession({headers:await headers()});if(!session)return NextResponse.json({registered:false},{status:401});const endpoint=new URL(request.url).searchParams.get("endpoint");if(!endpoint)return NextResponse.json({registered:false});await ensurePushSchema();const rows=await db.execute(sql`select endpoint from push_subscriptions where endpoint=${endpoint} and user_id=${session.user.id} limit 1`);return NextResponse.json({registered:rows.rows.length>0});}
export async function POST(request:Request){const session=await auth.api.getSession({headers:await headers()});if(!session)return NextResponse.json({error:"Non autorizzato"},{status:401});const input=schema.parse(await request.json());await ensurePushSchema();await db.execute(sql`insert into push_subscriptions(endpoint,user_id,p256dh,auth) values(${input.endpoint},${session.user.id},${input.keys.p256dh},${input.keys.auth}) on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=now()`);return NextResponse.json({ok:true});}
export async function DELETE(request:Request){const session=await auth.api.getSession({headers:await headers()});if(!session)return NextResponse.json({error:"Non autorizzato"},{status:401});const {endpoint}=z.object({endpoint:z.string().url()}).parse(await request.json());await ensurePushSchema();await db.execute(sql`delete from push_subscriptions where endpoint=${endpoint} and user_id=${session.user.id}`);return NextResponse.json({ok:true});}
