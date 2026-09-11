import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) return new NextResponse(challenge, { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.META_APP_SECRET;
  const signature = request.headers.get("x-hub-signature-256");
  const payload = await request.text();
  if (!secret || !signature?.startsWith("sha256=")) return new NextResponse("Unauthorized", { status: 401 });
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return new NextResponse("Unauthorized", { status: 401 });
  try { JSON.parse(payload); } catch { return new NextResponse("Bad Request", { status: 400 }); }
  return NextResponse.json({ received: true });
}
