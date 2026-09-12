import webpush from "web-push";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { customerRelations } from "@/db/schema";

export async function ensurePushSchema() {
  await db.execute(sql`create table if not exists push_subscriptions (endpoint text primary key, user_id uuid not null references users(id) on delete cascade, p256dh text not null, auth text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  await db.execute(sql`create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id)`);
}

export async function sendPushToCustomer(input: { businessId: string; email?: string | null; title: string; body: string; url?: string }) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !input.email) return false;
  const [customer] = await db.select({ userId: customerRelations.userId }).from(customerRelations).where(and(eq(customerRelations.businessId, input.businessId), eq(customerRelations.email, input.email.toLowerCase()), isNotNull(customerRelations.userId))).limit(1);
  if (!customer?.userId) return false;
  return sendPushToUser({userId:customer.userId,title:input.title,body:input.body,url:input.url});
}

export async function sendPushToUser(input:{userId:string;title:string;body:string;url?:string}){
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  await ensurePushSchema();
  const subscriptions = await db.execute(sql`select endpoint, p256dh, auth from push_subscriptions where user_id = ${input.userId}`);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:privacy@alphasystemsrl.it", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  let sent = false;
  for (const item of subscriptions.rows as Array<{endpoint:string;p256dh:string;auth:string}>) {
    try {
      await webpush.sendNotification({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } }, JSON.stringify({ title: input.title, body: input.body, url: input.url ?? "/account", icon: "/pwa/icon-192.png" }));
      sent = true;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      console.error("Push delivery failed",status ?? "unknown",error instanceof Error ? error.message : error);
      if (status === 404 || status === 410) await db.execute(sql`delete from push_subscriptions where endpoint = ${item.endpoint}`);
    }
  }
  return sent;
}
