"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { BusinessModule, BusinessType } from "@/lib/business-settings";
import { terminology } from "@/lib/business-settings";

const staffLinks = [
  ["/app/agenda", "▦", "Agenda"],
  ["/app/staff", "◷", "Le mie assenze"],
] as const;

export function AppNavLinks({ staffOnly,modules,businessType }: { staffOnly: boolean; modules: BusinessModule[]; businessType: BusinessType }) {
  const pathname = usePathname();
  const words=terminology(businessType);
  const ownerLinks: readonly (readonly [string,string,string,BusinessModule?])[]=[["/app","⌂","Dashboard"],["/app/agenda","▦","Agenda"],["/app/services","✦",words.services],["/app/staff","♟",words.staff,"STAFF"],["/app/customers","●",words.customers],["/app/sospesi","€","Sospesi","PAYMENTS"],["/app/fidelity","★","Fidelity","FIDELITY"],["/app/inventory","▤","Magazzino","INVENTORY"],["/app/statistics","↗","Statistiche","STATISTICS"],["/app/profile","⚙",words.profile],["/app/settings","☷","Configurazione"]];
  const links = staffOnly ? staffLinks : ownerLinks.filter(([, , ,module])=>!module||modules.includes(module));
  return <>{links.map(([href, icon, label]) => {
    const active = href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    return <Link href={href} aria-current={active ? "page" : undefined} key={href}><span aria-hidden="true">{icon}</span>{label}</Link>;
  })}</>;
}
