"use server";
import { eq } from "drizzle-orm"; import { redirect } from "next/navigation"; import { z } from "zod"; import { db } from "@/db/client"; import { businesses } from "@/db/schema"; import { requireBusinessContext } from "@/lib/business-context"; import { BUSINESS_TYPES,normalizeBusinessType,OPTIONAL_MODULES,serializeModules } from "@/lib/business-settings"; import { decryptWhatsAppToken, encryptWhatsAppToken } from "@/lib/whatsapp-credentials";
export async function saveBusinessSettings(formData:FormData){const c=await requireBusinessContext();if(c.role!=="OWNER")throw Error("Operazione riservata al titolare.");const type=normalizeBusinessType(z.enum(BUSINESS_TYPES).parse(formData.get("businessType")));const modules=OPTIONAL_MODULES.filter(module=>formData.get(`module_${module}`)==="on"),enabled=formData.get("whatsappRemindersEnabled")==="on",phoneId=z.string().trim().max(100).parse(formData.get("whatsappPhoneNumberId")??""),template=z.string().trim().max(200).parse(formData.get("whatsappReminderTemplate")??""),language=z.string().trim().min(2).max(10).parse(formData.get("whatsappTemplateLanguage")||"it"),plainToken=z.string().trim().max(2000).parse(formData.get("whatsappAccessToken")??"");const[current]=await db.select({token:businesses.whatsappAccessTokenEncrypted}).from(businesses).where(eq(businesses.id,c.businessId)).limit(1);if(enabled&&(!phoneId||!template||(!plainToken&&!current?.token)))redirect("/app/settings?whatsapp=incomplete");await db.update(businesses).set({businessType:type,enabledModules:serializeModules(modules),whatsappRemindersEnabled:enabled,whatsappPhoneNumberId:phoneId||null,whatsappReminderTemplate:template||null,whatsappTemplateLanguage:language,...(plainToken?{whatsappAccessTokenEncrypted:encryptWhatsAppToken(plainToken)}:{}),updatedAt:new Date()}).where(eq(businesses.id,c.businessId));redirect("/app/settings?saved=1");}

export async function sendWhatsAppTest(formData: FormData) {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") throw new Error("Operazione riservata al titolare.");
  let recipient = z.string().trim().min(6).max(30).parse(formData.get("recipient")).replace(/\D/g, "");
  if (recipient.startsWith("00")) recipient = recipient.slice(2);
  if (recipient.length === 10 && recipient.startsWith("3")) recipient = `${process.env.WHATSAPP_DEFAULT_COUNTRY_CODE ?? "39"}${recipient}`;
  const [business] = await db.select({
    name: businesses.name,
    phoneId: businesses.whatsappPhoneNumberId,
    token: businesses.whatsappAccessTokenEncrypted,
    template: businesses.whatsappReminderTemplate,
    language: businesses.whatsappTemplateLanguage,
  }).from(businesses).where(eq(businesses.id, context.businessId)).limit(1);
  if (!business?.phoneId || !business.token || !business.template) redirect("/app/settings?whatsapp=test-error");
  let failureReason = "";
  try {
    const token = decryptWhatsAppToken(business.token);
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v24.0";
    const isMetaSample = business.template === "jaspers_market_order_confirmation_v1";
    const isHelloWorld = business.template === "hello_world";
    const parameters = isMetaSample
      ? ["Cliente di prova", "123456", "Sep 11, 2026"]
      : ["Cliente di prova", business.name, "Servizio di prova", "domani alle 10:00"];
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${business.phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: business.template,
          language: { code: business.language },
          ...(!isHelloWorld ? { components: [{ type: "body", parameters: parameters.map(text => ({ type: "text", text })) }] } : {}),
        },
      }),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => null) as { error?: { message?: string; code?: number } } | null;
      failureReason = [details?.error?.code ? `Meta ${details.error.code}` : "Errore Meta", details?.error?.message].filter(Boolean).join(": ");
    }
  } catch (error) {
    failureReason = error instanceof Error ? error.message : "Collegamento WhatsApp non disponibile.";
  }
  if (failureReason) redirect(`/app/settings?whatsapp=test-error&reason=${encodeURIComponent(failureReason.slice(0, 240))}`);
  redirect("/app/settings?whatsapp=test-sent");
}
