import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alpha Prenota",
    short_name: "Prenota",
    description: "Agenda, clienti e prenotazioni per professionisti.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#6f5145",
    orientation: "any",
    lang: "it",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
