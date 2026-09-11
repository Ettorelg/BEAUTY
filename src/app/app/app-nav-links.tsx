"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect,useState } from "react";
import type { BusinessModule, BusinessType } from "@/lib/business-settings";
import { terminology } from "@/lib/business-settings";
import { LogoutButton } from "./logout-button";
import { PwaInstallButton } from "../pwa-install";

const staffLinks = [
  ["/app/agenda", "▦", "Agenda"],
  ["/app/staff", "◷", "Le mie assenze"],
] as const;

export function AppNavLinks({ staffOnly,modules,businessType }: { staffOnly: boolean; modules: BusinessModule[]; businessType: BusinessType }) {
  const pathname = usePathname();
  const [open,setOpen]=useState(false);
  useEffect(()=>setOpen(false),[pathname]);
  const words=terminology(businessType);
  const ownerLinks: readonly (readonly [string,string,string,BusinessModule?])[]=[["/app","⌂","Dashboard"],["/app/agenda","▦","Agenda"],["/app/services","✦",words.services],["/app/staff","♟",words.staff,"STAFF"],["/app/customers","●",words.customers],["/app/sospesi","€","Sospesi","PAYMENTS"],["/app/fidelity","★","Fidelity","FIDELITY"],["/app/inventory","▤","Magazzino","INVENTORY"],["/app/statistics","↗","Statistiche","STATISTICS"],["/app/profile","⚙",words.profile],["/app/settings","☷","Configurazione"]];
  const links = staffOnly ? staffLinks : ownerLinks.filter(([, , ,module])=>!module||modules.includes(module));
  return <><button type="button" className="app-menu-trigger" onClick={()=>setOpen(true)} aria-expanded={open}>☰ <span>Menu</span></button>{open?<div className="app-side-menu-backdrop" onMouseDown={()=>setOpen(false)}><aside className="app-side-menu" onMouseDown={event=>event.stopPropagation()}><header><div><span className="eyebrow">Navigazione</span><strong>Alpha Prenota</strong></div><button type="button" aria-label="Chiudi menu" onClick={()=>setOpen(false)}>×</button></header><nav aria-label="Navigazione gestionale">{links.map(([href, icon, label]) => {
    const active = href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    return <Link href={href} aria-current={active ? "page" : undefined} key={href}><span aria-hidden="true">{icon}</span>{label}</Link>;
  })}</nav><footer className="app-side-menu-footer"><PwaInstallButton/><Link href="/account/connections?next=/app"><span aria-hidden="true">⚙</span>Account e Google</Link><LogoutButton/></footer></aside></div>:null}</>;
}
