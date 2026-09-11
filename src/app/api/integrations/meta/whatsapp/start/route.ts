import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { businessMemberships } from "@/db/schema";
import { auth } from "@/lib/auth";

const callbackUrl = "https://prenota.alphasystemsrl.it/api/integrations/meta/whatsapp/callback";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.redirect(new URL("/login", callbackUrl));
  const [membership] = await db.select({ role: businessMemberships.role }).from(businessMemberships).where(eq(businessMemberships.userId, session.user.id)).limit(1);
  if (membership?.role !== "OWNER") return NextResponse.redirect(new URL("/app/settings?whatsapp=error", callbackUrl));
  const appId = process.env.META_APP_ID;
  const configId = process.env.META_WHATSAPP_CONFIG_ID;
  if (!appId || !configId) return NextResponse.redirect(new URL("/app/settings?whatsapp=error", callbackUrl));

  const state = randomBytes(24).toString("hex");
  const extras = JSON.stringify({ sessionInfoVersion: 3 });
  const destination = new URL("https://business.facebook.com/messaging/whatsapp/onboard/");
  destination.searchParams.set("app_id", appId);
  destination.searchParams.set("config_id", configId);
  destination.searchParams.set("redirect_uri", callbackUrl);
  destination.searchParams.set("state", state);
  destination.searchParams.set("extras", extras);
  const response = NextResponse.redirect(destination);
  response.cookies.set("wa_signup_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 900, path: "/" });
  return response;
}
