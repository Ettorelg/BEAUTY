export const standardWhatsAppTemplates = [
  {
    name: process.env.WHATSAPP_CONFIRMATION_TEMPLATE ?? "conferma_prenotazione",
    category: "UTILITY",
    text: "Ciao {{1}}, la tua prenotazione presso {{2}} per {{3}} è confermata per {{4}}.",
    examples: ["Maria Rossi", "Salone Demo", "Taglio", "12 settembre 2026 alle 10:00"],
  },
  {
    name: "promemoria_prenotazione",
    category: "UTILITY",
    text: "Ciao {{1}}, ti ricordiamo l'appuntamento presso {{2}} per {{3}}, previsto {{4}}.",
    examples: ["Maria Rossi", "Salone Demo", "Taglio", "12 settembre 2026 alle 10:00"],
  },
  {
    name: process.env.WHATSAPP_RESCHEDULE_TEMPLATE ?? "modifica_prenotazione",
    category: "UTILITY",
    text: "Ciao {{1}}, {{2}} propone di spostare {{3}} al {{4}}. Accetta o rifiuta qui: {{5}}",
    examples: ["Maria Rossi", "Salone Demo", "Taglio", "13 settembre 2026 alle 11:00", "https://prenota.alphasystemsrl.it/reschedule-request/esempio"],
  },
  {
    name: process.env.WHATSAPP_ABSENCE_TEMPLATE ?? "indisponibilita_operatore",
    category: "UTILITY",
    text: "Ciao {{1}}, l'operatore non è disponibile per l'appuntamento presso {{2}}, servizio {{3}}, previsto {{4}}. Il salone ti contatterà per concordare un nuovo orario.",
    examples: ["Maria Rossi", "Salone Demo", "Taglio", "12 settembre 2026 alle 10:00"],
  },
  {
    name: process.env.WHATSAPP_PROMOTION_TEMPLATE ?? "promozione_servizio",
    category: "MARKETING",
    text: "Ciao {{1}}, {{2}} ti offre una promozione su {{3}}: sconto {{4}}, valido {{5}}.",
    examples: ["Maria Rossi", "Salone Demo", "Taglio", "20%", "dal 12 al 20 settembre 2026"],
  },
  {
    name: process.env.WHATSAPP_WAITLIST_TEMPLATE ?? "lista_attesa",
    category: "UTILITY",
    text: "Ciao {{1}}, si è liberato un posto presso {{2}} per {{3}}, previsto {{4}}. Conferma qui: {{5}}",
    examples: ["Maria Rossi", "Salone Demo", "Taglio", "12 settembre 2026 alle 10:00", "https://prenota.alphasystemsrl.it/waitlist-confirm/esempio"],
  },
] as const;

export async function ensureStandardWhatsAppTemplates(input: { wabaId: string; accessToken: string; language?: string }) {
  const version = process.env.WHATSAPP_GRAPH_VERSION ?? "v25.0";
  const language = input.language || "it";
  const listResponse = await fetch(`https://graph.facebook.com/${version}/${input.wabaId}/message_templates?fields=name,language&limit=250`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
    cache: "no-store",
  });
  if (!listResponse.ok) throw new Error(`Meta non consente di leggere i template (${listResponse.status}).`);
  const list = await listResponse.json() as { data?: Array<{ name: string; language: string }> };
  const existing = new Set((list.data ?? []).map(item => `${item.name}:${item.language}`));
  let created = 0;
  for (const template of standardWhatsAppTemplates) {
    if (existing.has(`${template.name}:${language}`)) continue;
    const response = await fetch(`https://graph.facebook.com/${version}/${input.wabaId}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: template.name,
        language,
        category: template.category,
        components: [{ type: "BODY", text: template.text, example: { body_text: [template.examples] } }],
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 400);
      throw new Error(`Creazione ${template.name} non riuscita (${response.status}): ${detail}`);
    }
    created++;
  }
  return { created, total: standardWhatsAppTemplates.length };
}
