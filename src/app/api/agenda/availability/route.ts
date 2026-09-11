import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { services } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { getPublicAvailability } from "@/modules/availability/application/public-availability";
import { ensureServicePricingSchema } from "@/lib/ensure-service-pricing-schema";

export async function GET(request: NextRequest) {
  await ensureServicePricingSchema();
  const context = await requireBusinessContext(),
    serviceId = request.nextUrl.searchParams.get("serviceId") ?? "",
    date = request.nextUrl.searchParams.get("date") ?? "",
    staffId = request.nextUrl.searchParams.get("staffId") ?? "",
    requested = Number(request.nextUrl.searchParams.get("durationMinutes"));
  if (!/^[0-9a-f-]{36}$/i.test(serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ slots: [] }, { status: 400 });
  const [s] = await db
    .select({ duration: services.durationMinutes, capacity: services.capacity })
    .from(services)
    .where(
      and(
        eq(services.id, serviceId),
        eq(services.businessId, context.businessId),
        eq(services.active, true),
      ),
    )
    .limit(1);
  if (!s) return NextResponse.json({ slots: [] });
  const duration =
    Number.isInteger(requested) && requested >= 5 && requested <= 480
      ? requested
      : s.duration;
  const slots = await getPublicAvailability({
    businessId: context.businessId,
    serviceId,
    date,
    durationMinutes: duration,
    timezone: context.timezone,
    capacity: s.capacity,
  });
  return NextResponse.json({
    slots: staffId ? slots.filter((x) => x.staffId === staffId) : slots,
  });
}
