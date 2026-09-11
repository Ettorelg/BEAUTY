import { redirect } from "next/navigation";
import { AppNavLinks } from "./app-nav-links";
import { requireBusinessContext } from "@/lib/business-context";

export async function AppNav({businessName,role,agendaAccess=false,staffAccess=false}:{businessName:string;role:string;agendaAccess?:boolean;staffAccess?:boolean}){
  const staffOnly=role==="STAFF";
  if(staffOnly&&!agendaAccess&&!staffAccess) redirect("/app/agenda");
  const context=await requireBusinessContext();
  return <header className="app-header"><div className="app-header-identity"><AppNavLinks staffOnly={staffOnly} modules={context.modules} businessType={context.businessType}/><div><p className="eyebrow">{role === "OWNER" ? "Titolare" : "Staff"}</p><strong>{businessName}</strong></div></div></header>;
}
