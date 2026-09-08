import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alpha Prenota",
  description: "Gestionale e prenotazioni per professionisti di ogni settore.",
};

function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <Link className="site-footer-brand" href="/" aria-label="Alpha Prenota · Torna alla pagina iniziale">
        <Image src="/icon.png" alt="" width={34} height={34}/>
        <span>Alpha Prenota</span>
      </Link>
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

function ProductBar() {
  return <header className="product-bar">
    <Link className="product-bar-brand" href="/" aria-label="Alpha Prenota · Pagina iniziale">
      <Image src="/icon.png" alt="" width={30} height={30} priority />
      <span>Alpha Prenota</span>
    </Link>
    <span className="product-bar-description">Prenotazioni e gestione attività</span>
  </header>;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it"><body><ProductBar />{children}<SiteFooter /></body></html>;
}
