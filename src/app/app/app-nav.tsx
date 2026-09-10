import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { AppNavLinks } from "./app-nav-links";
import { requireBusinessContext } from "@/lib/business-context";

export async function AppNav({businessName,role,agendaAccess=false,staffAccess=false}:{businessName:string;role:string;agendaAccess?:boolean;staffAccess?:boolean}){
  const staffOnly=role==="STAFF";
  if(staffOnly&&!agendaAccess&&!staffAccess) redirect("/app/agenda");
  const context=await requireBusinessContext();
  return <><header className="app-header"><div className="app-header-identity"><AppNavLinks staffOnly={staffOnly} modules={context.modules} businessType={context.businessType}/><div><p className="eyebrow">{role}</p><strong>{businessName}</strong></div></div><div className="button-row"><Link className="ghost-button link-button" href="/account/connections?next=/app">Account e Google</Link><Link className="primary-button link-button customer-mode-button" href="/account">Accedi come cliente</Link><LogoutButton/></div></header></>;
}
