import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { customerRelations } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";

export async function GET(request: NextRequest) {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") return NextResponse.json({ customers: [] }, { status: 403 });

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2) return NextResponse.json({ customers: [] });

  const normalizedPhone = query.replace(/\D/g, "");
  const pattern = `%${query}%`;
  const customers = await db
    .select({
      id: customerRelations.id,
      name: customerRelations.name,
      email: customerRelations.email,
      phone: customerRelations.phone,
    })
    .from(customerRelations)
    .where(
      and(
        eq(customerRelations.businessId, context.businessId),
        or(
          ilike(customerRelations.name, pattern),
          ilike(customerRelations.email, pattern),
          normalizedPhone.length >= 2
            ? sql`regexp_replace(coalesce(${customerRelations.phone}, ''), '\\D', '', 'g') like ${`%${normalizedPhone}%`}`
            : undefined,
        ),
      ),
    )
    .orderBy(asc(customerRelations.name))
    .limit(8);

  return NextResponse.json({ customers });
}
