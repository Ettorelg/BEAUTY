import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { AppNavLinks } from "./app-nav-links";

export function AppNav({businessName,role,agendaAccess=false,staffAccess=false}:{businessName:string;role:string;agendaAccess?:boolean;staffAccess?:boolean}){
  const staffOnly=role==="STAFF";
  if(staffOnly&&!agendaAccess&&!staffAccess) redirect("/app/agenda");
  return <><header className="app-header"><div><p className="eyebrow">{role}</p><strong>{businessName}</strong></div><div className="button-row"><Link className="primary-button link-button customer-mode-button" href="/account">Accedi come cliente</Link><LogoutButton/></div></header><nav className="app-nav app-nav-manager" aria-label="Navigazione gestionale"><AppNavLinks staffOnly={staffOnly}/></nav></>;
}


