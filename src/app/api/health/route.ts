import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    service: "beauty-saas",
    status: "ok",
    authConfigured: Boolean(process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 32),
    timestamp: new Date().toISOString(),
  });
}
