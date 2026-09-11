import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { businesses, customerRelations } from "@/db/schema";
import { decryptWhatsAppToken } from "@/lib/whatsapp-credentials";
import { sendPushToCustomer } from "@/lib/push-notifications";

export type WhatsAppNotificationKind = "CONFIRMATION" | "RESCHEDULE" | "ABSENCE" | "PROMOTION" | "WAITLIST";

const templates: Record<WhatsAppNotificationKind, string> = {
  CONFIRMATION: process.env.WHATSAPP_CONFIRMATION_TEMPLATE ?? "conferma_prenotazione",
  RESCHEDULE: process.env.WHATSAPP_RESCHEDULE_TEMPLATE ?? "modifica_prenotazione",
  ABSENCE: process.env.WHATSAPP_ABSENCE_TEMPLATE ?? "indisponibilita_operatore",
  PROMOTION: process.env.WHATSAPP_PROMOTION_TEMPLATE ?? "promozione_servizio",
  WAITLIST: process.env.WHATSAPP_WAITLIST_TEMPLATE ?? "lista_attesa",
};

export function normalizeWhatsAppRecipient(value: string) {
  let recipient = value.replace(/\D/g, "");
  if (recipient.startsWith("00")) recipient = recipient.slice(2);
  if (recipient.length === 10 && recipient.startsWith("3")) recipient = `${process.env.WHATSAPP_DEFAULT_COUNTRY_CODE ?? "39"}${recipient}`;
  return recipient;
}

export async function sendBusinessWhatsApp(input: {
  businessId: string;
  kind: WhatsAppNotificationKind;
  parameters: string[];
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  try {
    const labels: Record<WhatsAppNotificationKind,string>={CONFIRMATION:"Prenotazione confermata",RESCHEDULE:"Modifica appuntamento",ABSENCE:"Aggiornamento appuntamento",PROMOTION:"Nuova promozione",WAITLIST:"Posto disponibile"};
    await sendPushToCustomer({businessId:input.businessId,email:input.email,title:labels[input.kind],body:input.parameters.slice(0,3).join(" · ")});
    const [business] = await db.select({
      enabled: businesses.whatsappRemindersEnabled,
      phoneNumberId: businesses.whatsappPhoneNumberId,
      token: businesses.whatsappAccessTokenEncrypted,
      language: businesses.whatsappTemplateLanguage,
    }).from(businesses).where(eq(businesses.id, input.businessId)).limit(1);
    if (!business?.enabled || !business.phoneNumberId || !business.token) return false;
    let phone = input.phone?.trim() ?? "";
    let customerName = input.customerName?.trim() ?? "";
    if ((!phone || !customerName) && input.email) {
      const [customer] = await db.select({ phone: customerRelations.phone, name: customerRelations.name }).from(customerRelations).where(and(eq(customerRelations.businessId, input.businessId), eq(customerRelations.email, input.email.trim().toLowerCase()))).limit(1);
      phone ||= customer?.phone?.trim() ?? "";
      customerName ||= customer?.name?.trim() ?? "";
    }
    const recipient = normalizeWhatsAppRecipient(phone);
    if (!recipient) return false;
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v25.0";
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${business.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${decryptWhatsAppToken(business.token)}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: templates[input.kind],
          language: { code: business.language || "it" },
          components: [{ type: "body", parameters: [customerName || "Cliente", ...input.parameters].map(text => ({ type: "text", text })) }],
        },
      }),
    });
    if (!response.ok) console.error("WhatsApp notification failed", input.kind, response.status, (await response.text()).slice(0, 500));
    return response.ok;
  } catch (error) {
    console.error("WhatsApp notification failed", input.kind, error instanceof Error ? error.message : error);
    return false;
  }
}
