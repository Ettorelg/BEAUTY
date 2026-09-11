import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { businesses } from "@/db/schema";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS, MODULE_LABELS, OPTIONAL_MODULES } from "@/lib/business-settings";
import { requireBusinessContext } from "@/lib/business-context";
import { AppNav } from "../app-nav";
import { LogoutButton } from "../logout-button";
import { saveBusinessSettings, sendWhatsAppTest } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; whatsapp?: string }> }) {
  const context = await requireBusinessContext();
  if (context.role !== "OWNER") redirect("/app/agenda");
  const query = await searchParams;
  const [business] = await db.select({ whatsappRemindersEnabled: businesses.whatsappRemindersEnabled, phoneId: businesses.whatsappPhoneNumberId, hasToken: businesses.whatsappAccessTokenEncrypted, template: businesses.whatsappReminderTemplate, language: businesses.whatsappTemplateLanguage }).from(businesses).where(eq(businesses.id, context.businessId)).limit(1);
  const whatsappConfigured = Boolean(business?.phoneId && business?.hasToken && business?.template);
  return <main className="dashboard-shell"><AppNav businessName={context.businessName} role={context.role}/>
    <section className="page-heading"><div><p className="eyebrow">Personalizzazione</p><h1>Tipo di attività e funzioni</h1></div><p className="muted">Mostra solo gli strumenti utili alla tua attività.</p></section>
    {query.saved ? <p className="success-message">Configurazione salvata.</p> : null}
    {query.whatsapp === "connected" ? <p className="success-message">Account WhatsApp collegato correttamente.</p> : null}
    {query.whatsapp === "test-sent" ? <p className="success-message">Messaggio WhatsApp di prova inviato.</p> : null}
    {query.whatsapp === "test-error" ? <p className="error-message">Messaggio WhatsApp non inviato. Controlla numero, token e approvazione del template.</p> : null}
    {query.whatsapp === "error" ? <p className="error-message">Collegamento WhatsApp non completato. Riprova o controlla la configurazione Meta.</p> : null}
    <section className="panel"><form action={saveBusinessSettings} className="compact-form stacked">
      <label>Tipo di attività<select name="businessType" defaultValue={context.businessType}>{BUSINESS_TYPES.map(type => <option key={type} value={type}>{BUSINESS_TYPE_LABELS[type]}</option>)}</select></label>
      <fieldset className="compact-form stacked"><legend>Funzioni attive</legend>{OPTIONAL_MODULES.map(module => <label className="checkbox-row" key={module}><input type="checkbox" name={`module_${module}`} defaultChecked={context.modules.includes(module)}/>{MODULE_LABELS[module]}</label>)}</fieldset>
      <details className="service-category"><summary>Collega WhatsApp Business<span>{whatsappConfigured ? "Account collegato" : "Da configurare"}</span></summary><div className="compact-form stacked">
        {process.env.META_APP_ID && process.env.META_WHATSAPP_CONFIG_ID ? <a className="primary-button link-button" href="/api/integrations/meta/whatsapp/start">Collega WhatsApp con Meta</a> : null}
        <p className="muted">Il collegamento guidato associa automaticamente il numero aziendale. I campi manuali restano disponibili per assistenza e test.</p>
        <label>ID numero di telefono Meta<input name="whatsappPhoneNumberId" defaultValue={business?.phoneId ?? ""} placeholder="Phone Number ID"/></label>
        <label>Token di accesso<input name="whatsappAccessToken" type="password" autoComplete="new-password" placeholder={business?.hasToken ? "Token già salvato · lascia vuoto per mantenerlo" : "Token permanente Meta"}/></label>
        <label>Template promemoria<input name="whatsappReminderTemplate" defaultValue={business?.template ?? ""} placeholder="promemoria_prenotazione"/></label>
        <label>Lingua template<input name="whatsappTemplateLanguage" defaultValue={business?.language ?? "it"}/></label>
        <label className="checkbox-row"><input type="checkbox" name="whatsappRemindersEnabled" defaultChecked={business?.whatsappRemindersEnabled ?? false}/> Attiva i promemoria WhatsApp per questa attività</label>
        <p className="muted">Il token viene cifrato e non sarà più mostrato. Se WhatsApp non è disponibile viene utilizzata l’email.</p>
        {!process.env.WHATSAPP_CREDENTIALS_KEY ? <p className="empty-state">L’amministratore deve configurare WHATSAPP_CREDENTIALS_KEY su Railway.</p> : null}
      </div></details>
      <p className="muted">Agenda, servizi, clienti e profilo attività restano sempre disponibili.</p><button className="primary-button">Salva configurazione</button>
    </form></section>
    {whatsappConfigured ? <section className="panel"><h2>Prova il collegamento WhatsApp</h2><p className="muted">Inserisci un numero completo di prefisso internazionale. Verrà utilizzato il template configurato con dati dimostrativi.</p><form action={sendWhatsAppTest} className="compact-form form-row"><input name="recipient" type="tel" autoComplete="tel" placeholder="+39 333 1234567" required/><button className="ghost-button">Invia messaggio di prova</button></form></section> : null}
    <section className="panel"><h2>Account e accesso</h2><div className="button-row"><Link className="ghost-button link-button" href="/account/connections?next=/app/settings">Account e Google</Link><LogoutButton/></div></section>
  </main>;
}
