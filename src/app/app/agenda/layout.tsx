import { requireBusinessContext } from "@/lib/business-context";
import { AppNav } from "../app-nav";
import { AgendaCalendar } from "./agenda-calendar";
import "./agenda.css";

export default async function AgendaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await requireBusinessContext();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: context.timezone }).format(new Date());
  const owner = context.role === "OWNER";
  return <main className="dashboard-shell agenda-shell"><AppNav businessName={context.businessName} role={context.role} agendaAccess/><div className="page-heading"><div><p className="eyebrow">Operatività</p><h1>Agenda</h1></div><p className="muted">{owner ? "Giornata operativa per fascia oraria e membro dello staff." : "I tuoi appuntamenti e aggiornamenti operativi."}</p></div><AgendaCalendar today={today} canManage={owner}/><div className="legacy-agenda" aria-hidden="true">{children}</div></main>;
}
