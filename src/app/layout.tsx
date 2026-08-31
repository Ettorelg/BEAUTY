import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alpha Beauty",
  description: "Gestionale e prenotazioni per professionisti beauty.",
};

function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <p className="site-footer-developer">Programma sviluppato da <a href="https://alphasystemsrl.it/" target="_blank" rel="noreferrer">Alpha System S.r.l.</a></p>
      <nav aria-label="Informazioni legali">
        <a href="https://menu.alphasystemsrl.it/privacy" target="_blank" rel="noreferrer">Privacy</a>
        <a href="https://menu.alphasystemsrl.it/cookie" target="_blank" rel="noreferrer">Cookie</a>
        <a href="https://menu.alphasystemsrl.it/terms" target="_blank" rel="noreferrer">Termini d’uso</a>
      </nav>
      <p className="site-footer-legal">© 2026 Alpha System S.r.l. · Sede legale: Via Rieti, 28 – Trapani · P. IVA 02299510814 · PEC: <a href="mailto:alphasystemsrl@pec.it">alphasystemsrl@pec.it</a> · Tutti i diritti riservati</p>
    </div>
  </footer>;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it"><body>{children}<SiteFooter /></body></html>;
}
