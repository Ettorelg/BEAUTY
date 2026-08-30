"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { fidelityPromotions, fidelityRules, fidelitySettings, services } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensureFidelitySchema } from "@/lib/ensure-fidelity-schema";
import { zonedLocalToUtc } from "@/modules/availability/domain/timezone";

async function owner(){const c=await requireBusinessContext();if(c.role!=="OWNER")throw Error("Operazione riservata al titolare.");await ensureFidelitySchema();return c}
const refresh=()=>{revalidatePath("/app/fidelity");revalidatePath("/s/[slug]","page")};
export async function saveFidelitySettings(f:FormData){const c=await owner();const x=z.object({spendEuros:z.coerce.number().min(1),pointsAward:z.coerce.number().int().min(1)}).parse(Object.fromEntries(f));await db.insert(fidelitySettings).values({businessId:c.businessId,spendCents:Math.round(x.spendEuros*100),pointsAward:x.pointsAward}).onConflictDoUpdate({target:fidelitySettings.businessId,set:{spendCents:Math.round(x.spendEuros*100),pointsAward:x.pointsAward,updatedAt:new Date()}});refresh();redirect("/app/fidelity?saved=1")}
export async function addFidelityRule(f:FormData){const c=await owner();const x=z.object({points:z.coerce.number().int().min(1),type:z.enum(["DISCOUNT_EUR","DISCOUNT_PERCENT","FREE_SERVICE"]),value:z.coerce.number().min(0),serviceId:z.string().uuid().optional()}).parse({...Object.fromEntries(f),serviceId:f.get("serviceId")||undefined});if(x.type==="FREE_SERVICE"&&!x.serviceId)throw Error("Seleziona il servizio omaggio.");await db.insert(fidelityRules).values({businessId:c.businessId,points:x.points,type:x.type,value:x.type==="DISCOUNT_EUR"?Math.round(x.value*100):Math.round(x.value),serviceId:x.type==="FREE_SERVICE"?x.serviceId:null});refresh();redirect("/app/fidelity?rule=1")}
export async function deleteFidelityRule(f:FormData){const c=await owner();const id=z.string().uuid().parse(f.get("id"));await db.delete(fidelityRules).where(and(eq(fidelityRules.id,id),eq(fidelityRules.businessId,c.businessId)));refresh()}
export async function addPromotion(f:FormData){const c=await owner();const x=z.object({serviceId:z.string().uuid(),discountPercent:z.coerce.number().int().min(1).max(100),startsAt:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),endsAt:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)}).parse(Object.fromEntries(f));const startsAt=zonedLocalToUtc(x.startsAt,c.timezone),endsAt=zonedLocalToUtc(x.endsAt,c.timezone);if(endsAt<=startsAt)throw Error("La fine deve essere successiva all'inizio.");const [service]=await db.select({id:services.id}).from(services).where(and(eq(services.id,x.serviceId),eq(services.businessId,c.businessId),eq(services.active,true))).limit(1);if(!service)throw Error("Servizio non valido.");await db.insert(fidelityPromotions).values({businessId:c.businessId,serviceId:x.serviceId,discountPercent:x.discountPercent,startsAt,endsAt});refresh();redirect("/app/fidelity?promo=1")}
export async function deletePromotion(f:FormData){const c=await owner();const id=z.string().uuid().parse(f.get("id"));await db.delete(fidelityPromotions).where(and(eq(fidelityPromotions.id,id),eq(fidelityPromotions.businessId,c.businessId)));refresh()}
