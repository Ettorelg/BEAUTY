import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { appointments, businesses, customerRelations } from "@/db/schema";
import { decryptWhatsAppToken } from "@/lib/whatsapp-credentials";
import { ensureBusinessSettingsSchema } from "@/lib/ensure-business-settings-schema";
import { sendPushToCustomer } from "@/lib/push-notifications";

let workerStarted = false;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

async function deliverReminder(row: {
  id: string;
  businessId: string;
  email: string | null;
  customerName: string;
  businessName: string;
  serviceName: string;
  startsAt: Date;
  timezone: string;
  phone: string | null;
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string | null;
  whatsappAccessTokenEncrypted: string | null;
  whatsappReminderTemplate: string | null;
  whatsappTemplateLanguage: string;
}) {
  const when = row.startsAt.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short", timeZone: row.timezone });
  const pushSent = await sendPushToCustomer({businessId:row.businessId,email:row.email,title:"Promemoria appuntamento",body:`${row.businessName} · ${row.serviceName} · ${when}`});
  let whatsappSent = false;
  if (row.whatsappEnabled && row.phone) {
    const phoneNumberId = row.whatsappPhoneNumberId, template = row.whatsappReminderTemplate;
    let recipient = row.phone.replace(/\D/g, "");
    if (recipient.startsWith("00")) recipient = recipient.slice(2);
    if (recipient.length === 10 && recipient.startsWith("3")) recipient = `${process.env.WHATSAPP_DEFAULT_COUNTRY_CODE ?? "39"}${recipient}`;
    if (row.whatsappAccessTokenEncrypted && phoneNumberId && template && recipient) {
      try {
        const token = decryptWhatsAppToken(row.whatsappAccessTokenEncrypted);
        const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v25.0";
        const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: recipient, type: "template", template: { name: template, language: { code: row.whatsappTemplateLanguage }, components: [{ type: "body", parameters: [row.customerName, row.businessName, row.serviceName, when].map(text => ({ type: "text", text })) }] } }) });
        whatsappSent = response.ok;
        if (!response.ok) console.error("WhatsApp reminder failed", response.status, (await response.text()).slice(0, 500));
      } catch {}
    }
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !row.email) return whatsappSent || pushSent;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `appointment-reminder-${row.id}`,
    },
    body: JSON.stringify({
      from,
      to: [row.email],
      subject: `Promemoria appuntamento di domani · ${row.businessName}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Il tuo appuntamento è tra circa 24 ore</h1><p>Ciao ${escapeHtml(row.customerName)},</p><p><strong>${escapeHtml(row.businessName)}</strong><br/>${escapeHtml(row.serviceName)}<br/>${escapeHtml(when)}</p></div>`,
      text: `Promemoria: il tuo appuntamento presso ${row.businessName} per ${row.serviceName} è previsto ${when}.`,
    }),
  });
  return response.ok || whatsappSent || pushSent;
}

export function getReminderWindow(now: Date) {
  const oneDay = 24 * 60 * 60_000;
  return {
    from: new Date(now.getTime() + oneDay - 10 * 60_000),
    to: new Date(now.getTime() + oneDay + 10 * 60_000),
  };
}

export async function sendDueAppointmentReminders(now = new Date()) {
  await ensureBusinessSettingsSchema();
  const { from, to } = getReminderWindow(now);
  const due = await db
    .select({
      id: appointments.id,
      businessId: appointments.businessId,
      email: customerRelations.email,
      customerName: customerRelations.name,
      businessName: businesses.name,
      serviceName: appointments.serviceName,
      startsAt: appointments.startsAt,
      timezone: appointments.timezone,
      phone: customerRelations.phone,
      whatsappEnabled: businesses.whatsappRemindersEnabled,
      whatsappPhoneNumberId: businesses.whatsappPhoneNumberId,
      whatsappAccessTokenEncrypted: businesses.whatsappAccessTokenEncrypted,
      whatsappReminderTemplate: businesses.whatsappReminderTemplate,
      whatsappTemplateLanguage: businesses.whatsappTemplateLanguage,
    })
    .from(appointments)
    .innerJoin(customerRelations, eq(customerRelations.id, appointments.customerRelationId))
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .where(and(
      inArray(appointments.status, ["BOOKED", "CONFIRMED"]),
      isNull(appointments.reminderSentAt),
      gte(appointments.startsAt, from),
      lt(appointments.startsAt, to),
    ));

  for (const row of due) {
    const [claimed] = await db
      .update(appointments)
      .set({ reminderSentAt: now })
      .where(and(eq(appointments.id, row.id), isNull(appointments.reminderSentAt)))
      .returning({ id: appointments.id });
    if (!claimed) continue;
    try {
      const sent = await deliverReminder(row);
      if (!sent) await db.update(appointments).set({ reminderSentAt: null }).where(eq(appointments.id, row.id));
    } catch {
      await db.update(appointments).set({ reminderSentAt: null }).where(eq(appointments.id, row.id));
    }
  }
  return due.length;
}

export function startAppointmentReminderWorker() {
  if (workerStarted) return;
  workerStarted = true;
  void sendDueAppointmentReminders();
  const timer = setInterval(() => void sendDueAppointmentReminders(), 5 * 60_000);
  timer.unref();
}
