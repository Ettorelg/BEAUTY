import Link from "next/link";
import { LogoutButton } from "./logout-button";

export function AppNav({ businessName, role }: { businessName: string; role: string }) {
  return (
    <>
      <header className="app-header">
        <div><p className="eyebrow">{role}</p><strong>{businessName}</strong></div>
        <LogoutButton />
      </header>
      <nav className="app-nav" aria-label="Navigazione gestionale">
        <Link href="/app">Dashboard</Link>
        <Link href="/app/agenda">Agenda</Link>
        <Link href="/app/services">Servizi</Link>
        <Link href="/app/staff">Staff</Link>
        <span>Clienti</span>
        <span>Fidelity</span>
      </nav>
    </>
  );
}
