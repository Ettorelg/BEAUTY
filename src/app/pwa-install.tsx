"use client";
import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export function PwaInstallButton({ className = "ghost-button" }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", ready); window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", ready); window.removeEventListener("appinstalled", done); };
  }, []);
  if (installed) return null;
  return <button type="button" className={className} onClick={async () => {
    if (prompt) { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") setInstalled(true); setPrompt(null); return; }
    const apple = /iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(apple ? "Su iPhone/iPad: premi Condividi in Safari e poi ‘Aggiungi alla schermata Home’." : "Apri il menu del browser e scegli ‘Installa app’ o ‘Aggiungi a schermata Home’." );
  }}>⬇ Installa app</button>;
}
