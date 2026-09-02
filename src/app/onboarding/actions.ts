"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { businessMemberships, businesses, locations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { normalizeBusinessSlug } from "@/modules/businesses/domain/business-slug";
import { ensureBusinessProfileSchema } from "@/lib/ensure-business-profile-schema";

const onboardingSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  locationName: z.string().trim().min(2).max(100),
  timezone: z.string().trim().min(3).max(64),
});

export async function onboardBusiness(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const input = onboardingSchema.parse({
    businessName: formData.get("businessName"),
    locationName: formData.get("locationName"),
    timezone: formData.get("timezone"),
  });

  const existingMembership = await db.query.businessMemberships.findFirst({
    where: and(
      eq(businessMemberships.userId, session.user.id),
      eq(businessMemberships.role, "OWNER"),
    ),
  });
  if (existingMembership) redirect("/app");

  const baseSlug = normalizeBusinessSlug(input.businessName) || "salone";
  const suffix = crypto.randomUUID().slice(0, 6);
  const slug = `${baseSlug}-${suffix}`;

  await ensureBusinessProfileSchema();

  await db.transaction(async (tx) => {
    const [business] = await tx
      .insert(businesses)
      .values({ name: input.businessName, slug, timezone: input.timezone })
      .returning({ id: businesses.id });

    await tx.insert(locations).values({
      businessId: business.id,
      name: input.locationName,
      timezone: input.timezone,
    });

    await tx.insert(businessMemberships).values({
      businessId: business.id,
      userId: session.user.id,
      role: "OWNER",
    });
  });

  redirect("/app");
}
