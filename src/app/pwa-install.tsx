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

export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    if (standalone || sessionStorage.getItem("alpha-prenota-install-dismissed")) return;
    const timer = window.setTimeout(() => setVisible(true), 1200);
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); setVisible(true); };
    const done = () => { setInstalled(true); setVisible(false); };
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => { window.clearTimeout(timer); window.removeEventListener("beforeinstallprompt", ready); window.removeEventListener("appinstalled", done); };
  }, []);
  if (!visible || installed) return null;
  return <aside className="pwa-install-banner" role="dialog" aria-label="Installa Alpha Prenota">
    <img src="/pwa/icon-192.png" width="52" height="52" alt=""/>
    <div><strong>Installa Alpha Prenota</strong><span>Aprila rapidamente dal telefono o da Windows e ricevi le notifiche.</span></div>
    <button className="primary-button" type="button" onClick={async()=>{
      if(prompt){await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==="accepted"){setInstalled(true);setVisible(false);}setPrompt(null);return;}
      const apple=/iphone|ipad|ipod/i.test(navigator.userAgent);
      alert(apple?"In Safari premi Condividi, poi ‘Aggiungi alla schermata Home’.":"Apri il menu del browser e scegli ‘Installa Alpha Prenota’ oppure ‘Installa app’. Se la voce non compare, aggiorna la pagina e riprova.");
    }}>Installa</button>
    <button className="pwa-install-close" type="button" aria-label="Chiudi" onClick={()=>{sessionStorage.setItem("alpha-prenota-install-dismissed","1");setVisible(false);}}>×</button>
  </aside>;
}
