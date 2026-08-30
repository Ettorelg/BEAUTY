import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { businesses } from "@/db/schema";
import { bucket } from "@/lib/bucket";
export async function GET(request:NextRequest){const slug=request.nextUrl.searchParams.get("salon"),kind=request.nextUrl.searchParams.get("kind");if(!slug||!(kind==="logo"||kind==="cover"))return new NextResponse("Non trovata",{status:404});const[b]=await db.select({logoKey:businesses.logoKey,coverKey:businesses.coverKey,active:businesses.active}).from(businesses).where(eq(businesses.slug,slug)).limit(1);const key=kind==="logo"?b?.logoKey:b?.coverKey;if(!b?.active||!key)return new NextResponse("Non trovata",{status:404});const{client,bucketName}=bucket();return NextResponse.redirect(await getSignedUrl(client,new GetObjectCommand({Bucket:bucketName,Key:key}),{expiresIn:3600}))}
