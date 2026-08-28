import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    service: "beauty-saas",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
