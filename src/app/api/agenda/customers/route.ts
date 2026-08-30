import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { customerRelations } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";

export async function GET(request:NextRequest){
  const c=await requireBusinessContext();
  if(c.role!=="OWNER")return NextResponse.json({customers:[]},{status:403});
  const q=(request.nextUrl.searchParams.get("q")??"").trim();
  if(q.length<2)return NextResponse.json({customers:[]});
  const normalizedPhone=q.replace(/\D/g,"");
  const condition=q.includes("@")
    ? eq(sql`lower(${customerRelations.email})`,q.toLowerCase())
    : normalizedPhone.length>=6
      ? eq(sql`regexp_replace(coalesce(${customerRelations.phone}, ''), '\D', '', 'g')`,normalizedPhone)
      : undefined;
  if(!condition)return NextResponse.json({customers:[]});
  const customers=await db.select({id:customerRelations.id,name:customerRelations.name,email:customerRelations.email,phone:customerRelations.phone})
    .from(customerRelations).where(and(eq(customerRelations.businessId,c.businessId),condition)).limit(2);
  return NextResponse.json({customers,ambiguous:customers.length>1});
}
