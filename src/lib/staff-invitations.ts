import { createHash, randomBytes } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { staffInvitations } from "@/db/schema/staff-invitations";

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export function hashStaffInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isStaffEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

async function deliverInvitationEmail({ email, businessName, invitationUrl, idempotencyKey }: { email: string; businessName: string; invitationUrl: string; idempotencyKey: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, error: "Servizio email non configurato su Railway." };

  try {
    const safeBusinessName = escapeHtml(businessName);
    const safeUrl = escapeHtml(invitationUrl);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "User-Agent": "Beauty-SaaS/1.0",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Invito allo staff di ${businessName}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#201c1a"><h1>Sei stato invitato nello staff</h1><p><strong>${safeBusinessName}</strong> ti ha invitato ad accedere al gestionale.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#6f5145;color:#fff;text-decoration:none;font-weight:700">Completa la registrazione</a></p><p>Il link è personale, utilizzabile una sola volta e scade tra 7 giorni.</p></div>`,
        text: `${businessName} ti ha invitato ad accedere al gestionale Beauty SaaS. Completa la registrazione: ${invitationUrl}\n\nIl link scade tra 7 giorni.`,
      }),
    });
    if (response.ok) return { sent: true, error: null };
    const details = (await response.text()).slice(0, 300);
    return { sent: false, error: `Invio email non riuscito (${response.status}): ${details}` };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message.slice(0, 300) : "Invio email non riuscito." };
  }
}

export async function issueStaffInvitation({ businessId, businessName, staffId, email, createdBy }: { businessId: string; businessName: string; staffId: string; email: string; createdBy: string }) {
  const normalizedEmail = email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashStaffInvitationToken(token);
  const expiresAt = new Date(Date.now() + invitationLifetimeMs);
  await db.delete(staffInvitations).where(and(eq(staffInvitations.businessId, businessId), eq(staffInvitations.email, normalizedEmail), ne(staffInvitations.staffId, staffId)));
  const [existing] = await db.select({ id: staffInvitations.id }).from(staffInvitations)
    .where(and(eq(staffInvitations.businessId, businessId), eq(staffInvitations.email, normalizedEmail))).limit(1);
  let invitation: { id: string } | undefined;
  if (existing) {
    [invitation] = await db.update(staffInvitations).set({ staffId, email: normalizedEmail, tokenHash, expiresAt, sentAt: null, acceptedAt: null, lastError: null, createdBy, updatedAt: new Date() }).where(eq(staffInvitations.id, existing.id)).returning({ id: staffInvitations.id });
  } else {
    [invitation] = await db.insert(staffInvitations).values({ businessId, staffId, email: normalizedEmail, tokenHash, expiresAt, createdBy }).returning({ id: staffInvitations.id });
  }

  const baseUrl = (process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const invitationUrl = `${baseUrl}/staff-invite/${token}`;
  const delivery = await deliverInvitationEmail({
    email: normalizedEmail,
    businessName,
    invitationUrl,
    idempotencyKey: `staff-invite-${invitation.id}-${tokenHash.slice(0, 12)}`,
  });
  await db.update(staffInvitations).set({ sentAt: delivery.sent ? new Date() : null, lastError: delivery.error, updatedAt: new Date() })
    .where(eq(staffInvitations.id, invitation.id));
  return delivery;
}

export async function sendBookingConfirmation({email,businessName,serviceName,startsAt,timezone,address,phone}:{email:string;businessName:string;serviceName:string;startsAt:Date;timezone:string;address?:string|null;phone?:string|null}) { const apiKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL; if(!apiKey||!from)return; const when=startsAt.toLocaleString("it-IT",{dateStyle:"long",timeStyle:"short",timeZone:timezone}); const contacts=[address,phone].filter(Boolean).join(" · "); await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],subject:`Conferma prenotazione · ${businessName}`,html:`<p>La tua prenotazione è confermata.</p><p><strong>${businessName}</strong><br/>${serviceName}<br/>${when}</p>${contacts?`<p><strong>Contatti salone</strong><br/>${escapeHtml(contacts)}</p>`:""}`})}); }