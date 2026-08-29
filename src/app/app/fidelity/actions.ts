"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { fidelitySettings } from "@/db/schema";
import { requireBusinessContext } from "@/lib/business-context";
import { ensureFidelitySchema } from "@/lib/ensure-fidelity-schema";

export async function saveFidelitySettings(formData:FormData){
  const context=await requireBusinessContext(); if(context.role!=="OWNER")throw Error("Operazione riservata al titolare.");
  const input=z.object({spendEuros:z.coerce.number().min(1),pointsAward:z.coerce.number().int().min(1),rewardPoints:z.coerce.number().int().min(1),rewardType:z.enum(["DISCOUNT_EUR","DISCOUNT_PERCENT","FREE_SERVICE"]),rewardValue:z.coerce.number().min(0)}).parse(Object.fromEntries(formData));
  await ensureFidelitySchema();
  const data={spendCents:Math.round(input.spendEuros*100),pointsAward:input.pointsAward,rewardPoints:input.rewardPoints,rewardType:input.rewardType,rewardValue:input.rewardType==="DISCOUNT_PERCENT"?Math.round(input.rewardValue):Math.round(input.rewardValue*100)};
  await db.insert(fidelitySettings).values({businessId:context.businessId,...data}).onConflictDoUpdate({target:fidelitySettings.businessId,set:{...data,updatedAt:new Date()}}); revalidatePath("/app/fidelity");
}
