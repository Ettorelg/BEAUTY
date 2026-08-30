import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";

export function AppNav({businessName,role,agendaAccess=false}:{businessName:string;role:string;agendaAccess?:boolean}){
  const staffOnly=role==="STAFF";
  if(staffOnly&&!agendaAccess) redirect("/app/agenda");
  return <><header className="app-header"><div><p className="eyebrow">{role}</p><strong>{businessName}</strong></div><div className="button-row"><Link className="primary-button link-button customer-mode-button" href="/account">Accedi come cliente</Link><LogoutButton/></div></header><nav className="app-nav" aria-label="Navigazione gestionale">{staffOnly?<Link href="/app/agenda">Agenda</Link>:<><Link href="/app">Dashboard</Link><Link href="/app/agenda">Agenda</Link><Link href="/app/services">Servizi</Link><Link href="/app/staff">Staff</Link><Link href="/app/customers">Clienti</Link><Link href="/app/fidelity">Fidelity</Link></>}</nav></>;
}
