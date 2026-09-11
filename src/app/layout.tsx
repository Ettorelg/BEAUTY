import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaInstallButton } from "./pwa-install";

export const metadata: Metadata = {
  title: "Alpha Prenota",
  description: "Gestionale e prenotazioni per professionisti di ogni settore.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Alpha Prenota" },
  icons: { apple: "/pwa/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#6f5145" };

function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <p className="site-footer-developer">Programma sviluppato da <a href="https://alphasystemsrl.it/" target="_blank" rel="noreferrer">Alpha System S.r.l.</a></p><PwaInstallButton className="site-install-button"/>
      <nav aria-label="Informazioni legali">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Termini d’uso</a>
      </nav>
      <p className="site-footer-legal">© 2026 Alpha System S.r.l. · Sede legale: Via Rieti, 28 – Trapani · P. IVA 02299510814 · PEC: <a href="mailto:alphasystemsrl@pec.it">alphasystemsrl@pec.it</a> · Tutti i diritti riservati</p>
    </div>
  </footer>;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it"><body>{children}<SiteFooter /></body></html>;
}
