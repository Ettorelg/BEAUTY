import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { services } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { getPublicAvailability } from "@/modules/availability/application/public-availability";

export async function GET(request:NextRequest){const context=await requireBusinessContext(),serviceId=request.nextUrl.searchParams.get("serviceId")??"",date=request.nextUrl.searchParams.get("date")??"",staffId=request.nextUrl.searchParams.get("staffId")??"";if(!/^[0-9a-f-]{36}$/i.test(serviceId)||!/^\d{4}-\d{2}-\d{2}$/.test(date))return NextResponse.json({slots:[]},{status:400});const[s]=await db.select({duration:services.durationMinutes}).from(services).where(and(eq(services.id,serviceId),eq(services.businessId,context.businessId),eq(services.active,true))).limit(1);if(!s)return NextResponse.json({slots:[]});const slots=await getPublicAvailability({businessId:context.businessId,serviceId,date,durationMinutes:s.duration,timezone:context.timezone});return NextResponse.json({slots:staffId?slots.filter(x=>x.staffId===staffId):slots})}
