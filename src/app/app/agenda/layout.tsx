import { requireBusinessContext } from "@/lib/business-context";
import { AppNav } from "../app-nav";
import { AgendaCalendar } from "./agenda-calendar";
import "./agenda.css";

export default async function AgendaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await requireBusinessContext();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: context.timezone }).format(new Date());
  return <main className="dashboard-shell agenda-shell"><AppNav businessName={context.businessName} role={context.role} agendaAccess/><div className="agenda-page-heading"><h1>Agenda</h1><span>Gestione appuntamenti</span></div><AgendaCalendar today={today}/><div className="legacy-agenda" aria-hidden="true">{children}</div></main>;
}
