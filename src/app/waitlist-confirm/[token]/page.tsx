import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { businesses, serviceWaitlist, services, staffMembers } from "@/db/schema";
import { ensureServicePricingSchema } from "@/lib/ensure-service-pricing-schema";
import { hashWaitlistToken } from "@/lib/waitlist";
import { confirmWaitlistOffer } from "./actions";

export default async function WaitlistConfirmPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ confirmed?: string; error?: string }> }) {
  await ensureServicePricingSchema();
  const { token } = await params;
  const query = await searchParams;
  if (query.confirmed) return <main className="customer-shell"><section className="panel"><p className="eyebrow">Alpha Prenota · Lista d’attesa</p><h1>Posto confermato</h1><p>La prenotazione è stata creata. Riceverai anche la conferma via email.</p></section></main>;
  if (query.error) return <main className="customer-shell"><section className="panel"><p className="eyebrow">Alpha Prenota · Lista d’attesa</p><h1>Posto non disponibile</h1><p>{query.error === "expired" ? "Il tempo per confermare è scaduto e il posto è passato alla persona successiva." : "Il collegamento non è più valido oppure il posto è già stato occupato."}</p></section></main>;
  const [row] = await db.select({ business: businesses.name, timezone: businesses.timezone, service: services.name, startsAt: serviceWaitlist.startsAt, staff: staffMembers.name, expiresAt: serviceWaitlist.offerExpiresAt }).from(serviceWaitlist).innerJoin(businesses, eq(businesses.id, serviceWaitlist.businessId)).innerJoin(services, eq(services.id, serviceWaitlist.serviceId)).innerJoin(staffMembers, eq(staffMembers.id, serviceWaitlist.staffId)).where(and(eq(serviceWaitlist.offerTokenHash, hashWaitlistToken(token)), eq(serviceWaitlist.status, "OFFERED"), gt(serviceWaitlist.offerExpiresAt, new Date()))).limit(1);
  return <main className="customer-shell"><section className="panel"><p className="eyebrow">Alpha Prenota · Lista d’attesa</p>{row ? <><h1>Si è liberato un posto</h1><p><strong>{row.business}</strong><br/>{row.service} con {row.staff}<br/>{row.startsAt.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short", timeZone: row.timezone })}</p><p className="muted">Conferma entro {row.expiresAt?.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: row.timezone })}.</p><form action={confirmWaitlistOffer}><input type="hidden" name="token" value={token}/><button className="primary-button">Conferma il posto</button></form></> : <><h1>Offerta non disponibile</h1><p>Il collegamento è scaduto oppure il posto è già stato assegnato.</p></>}</section></main>;
}
