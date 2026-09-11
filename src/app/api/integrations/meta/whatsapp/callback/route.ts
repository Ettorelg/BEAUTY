import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { businessMemberships, businesses } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ensureBusinessSettingsSchema } from "@/lib/ensure-business-settings-schema";
import { encryptWhatsAppToken } from "@/lib/whatsapp-credentials";

const callbackUrl = "https://prenota.alphasystemsrl.it/api/integrations/meta/whatsapp/callback";
const failure = () => NextResponse.redirect(new URL("/app/settings?whatsapp=error", callbackUrl));

function parseSessionInfo(request: NextRequest) {
  const result: Record<string, unknown> = Object.fromEntries(request.nextUrl.searchParams.entries());
  for (const name of ["session_info", "sessionInfo", "data"]) {
    const raw = request.nextUrl.searchParams.get(name);
    if (!raw) continue;
    try { Object.assign(result, JSON.parse(raw)); } catch { /* Meta may omit structured session data. */ }
  }
  return {
    wabaId: String(result.waba_id ?? result.wabaId ?? result.whatsapp_business_account_id ?? ""),
    phoneNumberId: String(result.phone_number_id ?? result.phoneNumberId ?? ""),
  };
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("wa_signup_state")?.value;
  const businessId = cookieStore.get("wa_signup_business")?.value;
  const returnedState = request.nextUrl.searchParams.get("state");
  if (!expectedState || !businessId || returnedState !== expectedState || request.nextUrl.searchParams.get("error")) return failure();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.redirect(new URL("/login", callbackUrl));
  const [membership] = await db.select({ businessId: businessMemberships.businessId, role: businessMemberships.role }).from(businessMemberships).where(and(eq(businessMemberships.userId, session.user.id), eq(businessMemberships.businessId, businessId))).limit(1);
  if (!membership || membership.role !== "OWNER") return failure();

  const code = request.nextUrl.searchParams.get("code");
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!code || !appId || !appSecret) return failure();
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v24.0";
  const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", callbackUrl);
  tokenUrl.searchParams.set("code", code);
  const tokenResponse = await fetch(tokenUrl, { cache: "no-store" });
  if (!tokenResponse.ok) return failure();
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) return failure();

  const info = parseSessionInfo(request);
  let phoneNumberId = info.phoneNumberId;
  if (!phoneNumberId && info.wabaId) {
    const phonesResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${info.wabaId}/phone_numbers?fields=id`, { headers: { Authorization: `Bearer ${tokenData.access_token}` }, cache: "no-store" });
    if (phonesResponse.ok) {
      const phones = await phonesResponse.json() as { data?: Array<{ id: string }> };
      if (phones.data?.length === 1) phoneNumberId = phones.data[0].id;
    }
  }
  if (!phoneNumberId) return failure();
  if (info.wabaId) {
    await fetch(`https://graph.facebook.com/${graphVersion}/${info.wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }).catch(() => null);
  }
  await ensureBusinessSettingsSchema();
  await db.update(businesses).set({
    whatsappBusinessAccountId: info.wabaId || null,
    whatsappPhoneNumberId: phoneNumberId,
    whatsappAccessTokenEncrypted: encryptWhatsAppToken(tokenData.access_token),
    whatsappReminderTemplate: "promemoria_prenotazione",
    whatsappTemplateLanguage: "it",
    updatedAt: new Date(),
  }).where(eq(businesses.id, membership.businessId));
  const response = NextResponse.redirect(new URL("/app/settings?whatsapp=connected", callbackUrl));
  response.cookies.delete("wa_signup_state");
  response.cookies.delete("wa_signup_business");
  return response;
}
