import { NextRequest, NextResponse } from "next/server";

const LEGACY_HOSTS = new Set(["beauty.alphasystemsrl.it"]);
const CANONICAL_HOST = "prenota.alphasystemsrl.it";

export function proxy(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwardedHost ?? request.headers.get("host") ?? "").split(":")[0].toLowerCase();

  if (!LEGACY_HOSTS.has(host)) return NextResponse.next();

  const destination = request.nextUrl.clone();
  destination.protocol = "https";
  destination.host = CANONICAL_HOST;
  destination.port = "";
  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: "/:path*",
};
