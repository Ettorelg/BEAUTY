import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) return new NextResponse(challenge, { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  // Consumiamo il payload per permettere a Meta di registrare consegne e messaggi.
  // La gestione conversazionale verrà aggiunta solo se il titolare la abilita.
  await request.json().catch(() => null);
  return NextResponse.json({ received: true });
}
