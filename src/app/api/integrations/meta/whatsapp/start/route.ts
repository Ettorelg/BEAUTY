import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/business-context";

const callbackUrl = "https://prenota.alphasystemsrl.it/api/integrations/meta/whatsapp/callback";

export async function GET() {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") return NextResponse.redirect(new URL("/app/settings?whatsapp=error", callbackUrl));
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
  response.cookies.set("wa_signup_business", context.businessId, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 900, path: "/" });
  return response;
}
