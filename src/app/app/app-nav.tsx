import Link from "next/link";
import { LogoutButton } from "./logout-button";

export function AppNav({businessName,role}:{businessName:string;role:string}){
  const staffOnly=role==="STAFF";
  return <><header className="app-header"><div><p className="eyebrow">{role}</p><strong>{businessName}</strong></div><div className="button-row"><Link className="ghost-button link-button" href="/account">Modalità cliente</Link><LogoutButton/></div></header><nav className="app-nav" aria-label="Navigazione gestionale">{staffOnly?<Link href="/app/agenda">Agenda</Link>:<><Link href="/app">Dashboard</Link><Link href="/app/agenda">Agenda</Link><Link href="/app/services">Servizi</Link><Link href="/app/staff">Staff</Link><Link href="/app/customers">Clienti</Link><Link href="/app/fidelity">Fidelity</Link></>}</nav></>;
}
