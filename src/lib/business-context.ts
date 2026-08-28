import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { businessMemberships, businesses, locations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createTenantContext } from "@/modules/businesses/domain/tenant-context";

export async function requireBusinessContext() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [membership] = await db
    .select({
      businessId: businesses.id,
      businessName: businesses.name,
      timezone: businesses.timezone,
      locationId: locations.id,
      locationName: locations.name,
      role: businessMemberships.role,
    })
    .from(businessMemberships)
    .innerJoin(businesses, eq(businessMemberships.businessId, businesses.id))
    .innerJoin(locations, eq(locations.businessId, businesses.id))
    .where(eq(businessMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) redirect("/onboarding");

  return {
    ...membership,
    user: session.user,
    tenant: createTenantContext({ businessId: membership.businessId, actorId: session.user.id }),
  };
}
