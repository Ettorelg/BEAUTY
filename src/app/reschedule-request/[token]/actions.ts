"use server";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { appointmentRescheduleRequests } from "@/db/schema";
import { ensureRescheduleSchema } from "@/lib/ensure-reschedule-schema";
import { approveRescheduleRequest, tokenHash } from "@/lib/reschedule-requests";
export async function respondToCustomerReschedule(formData:FormData){await ensureRescheduleSchema();const token=String(formData.get("token")??""),decision=String(formData.get("decision")??"");const[request]=await db.select({id:appointmentRescheduleRequests.id}).from(appointmentRescheduleRequests).where(and(eq(appointmentRescheduleRequests.customerTokenHash,tokenHash(token)),eq(appointmentRescheduleRequests.proposerType,"STAFF"),eq(appointmentRescheduleRequests.status,"PENDING"))).limit(1);if(!request)throw new Error("Richiesta non valida o già gestita.");if(decision==="accept")await approveRescheduleRequest(request.id);else await db.update(appointmentRescheduleRequests).set({status:"REJECTED",respondedAt:new Date()}).where(eq(appointmentRescheduleRequests.id,request.id));redirect(`/reschedule-request/${token}?result=${decision==="accept"?"accepted":"rejected"}`);}
