import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendDueAppointmentReminders } from "@/lib/appointment-reminders";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || expected.length < 24 || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const processed = await sendDueAppointmentReminders();
  return NextResponse.json({ ok: true, processed, timestamp: new Date().toISOString() });
}
