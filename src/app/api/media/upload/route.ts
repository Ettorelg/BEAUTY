import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/business-context";
import { bucket } from "@/lib/bucket";
export async function POST(request:NextRequest){const c=await requireBusinessContext();if(c.role!=="OWNER")return NextResponse.json({error:"Non autorizzato"},{status:403});const data=await request.formData(),file=data.get("file");if(!(file instanceof File)||!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>5*1024*1024)return NextResponse.json({error:"Carica un’immagine JPG, PNG o WebP fino a 5 MB."},{status:400});const{client,bucketName}=bucket(),key=`businesses/${c.businessId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;await client.send(new PutObjectCommand({Bucket:bucketName,Key:key,Body:Buffer.from(await file.arrayBuffer()),ContentType:file.type}));return NextResponse.json({key})}
