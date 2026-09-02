"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ownerLinks = [
  ["/app", "⌂", "Dashboard"],
  ["/app/agenda", "▦", "Agenda"],
  ["/app/services", "✦", "Servizi"],
  ["/app/staff", "♟", "Staff"],
  ["/app/customers", "●", "Clienti"],
  ["/app/sospesi", "€", "Sospesi"],
  ["/app/fidelity", "★", "Fidelity"],
  ["/app/statistics", "↗", "Statistiche"],
  ["/app/profile", "⚙", "Profilo salone"],
] as const;

const staffLinks = [
  ["/app/agenda", "▦", "Agenda"],
  ["/app/staff", "◷", "Le mie assenze"],
] as const;

export function AppNavLinks({ staffOnly }: { staffOnly: boolean }) {
  const pathname = usePathname();
  const links = staffOnly ? staffLinks : ownerLinks;
  return <>{links.map(([href, icon, label]) => {
    const active = href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    return <Link href={href} aria-current={active ? "page" : undefined} key={href}><span aria-hidden="true">{icon}</span>{label}</Link>;
  })}</>;
}
