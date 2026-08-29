"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { businessMemberships, businesses, locations, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/super-admin";
import { normalizeBusinessSlug } from "@/modules/businesses/domain/business-slug";

export async function grantLicense(formData: FormData) {
  await requireSuperAdmin();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const input = z.object({ email: z.string().email(), businessName: z.string().trim().min(2).max(100), locationName: z.string().trim().min(2).max(100), timezone: z.string().trim().min(3).max(64) }).parse({
    email: formData.get("email"), businessName: formData.get("businessName"), locationName: formData.get("locationName"), timezone: formData.get("timezone"),
  });
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
  if (!owner) throw new Error("L’utente deve registrarsi prima come cliente.");
  const existing = await db.select({ id: businessMemberships.id }).from(businessMemberships).where(and(eq(businessMemberships.userId, owner.id), eq(businessMemberships.role, "OWNER"))).limit(1);
  if (existing.length) throw new Error("Questo utente ha già una licenza.");
  const slug = (normalizeBusinessSlug(input.businessName) || "salone") + "-" + crypto.randomUUID().slice(0, 6);
  await db.transaction(async (tx) => {
    const [business] = await tx.insert(businesses).values({ name: input.businessName, slug, timezone: input.timezone }).returning({ id: businesses.id });
    await tx.insert(locations).values({ businessId: business.id, name: input.locationName, timezone: input.timezone });
    await tx.insert(businessMemberships).values({ businessId: business.id, userId: owner.id, role: "OWNER" });
  });
  redirect("/admin/licenses");
}
