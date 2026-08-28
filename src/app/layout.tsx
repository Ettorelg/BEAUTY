import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beauty SaaS",
  description: "Piattaforma gestionale e prenotazioni per professionisti beauty.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
