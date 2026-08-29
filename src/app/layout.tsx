import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Alpha Beauty", description: "Gestionale e prenotazioni per professionisti beauty." };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="it"><body>{children}</body></html>}
